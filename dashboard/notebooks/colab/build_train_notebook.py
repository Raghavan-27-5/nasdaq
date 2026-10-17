#!/usr/bin/env python3
"""
build_train_notebook.py — assembles the Colab Phase 5/6 training notebook.

Kept as a builder so the cell logic is reviewable and diffable, and the
notebook can be regenerated deterministically (same pattern as
build_notebook.py for the Phase-3 acquisition notebook).

v001: feature factory (15 price/volume features, all trailing), target factory
(7 targets: 1/5/21d forward returns, 5/21d realised vol, 5/21d direction),
expanding-window walk-forward LightGBM with per-target purge/embargo and
early stopping on a rolling pre-test validation window, a metrics engine
(IC/ICIR/hit/R2/quantiles/annual/decay), a hard-failing validation suite and
versioned Drive artifacts (features_v003 / targets_v002 / predictions_v007).

Artifact names are pre-registered in dashboard/src/data/manifest.json,
dashboard/scripts/gen_demo_data.py and WORKTREE.md §4; this notebook is the
producer for the pre-registered names and does not renumber them.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "nasdaq_ai_quant_train_v001.ipynb"


def md(src: str) -> dict:
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": src.strip("\n").splitlines(keepends=True),
    }


def code(src: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": src.strip("\n").splitlines(keepends=True),
    }


CELLS = [
    md(r"""
# Nasdaq AI Quant — Phase 5/6: Feature/Target Factory + Walk-Forward LightGBM

**Purpose.** Turn the frozen clean panel (`04_clean/clean_prices_v001.parquet`) into the
project's first *real* supervised-learning artifacts: the feature matrix
(`features_v003.parquet`), the label table (`targets_v002.parquet`), the walk-forward OOS
predictions (`predictions_v007.parquet`) and the training report (`training_report_v001.json`).

**What becomes REAL.** ML Lab IC, ICIR, hit rate, walk-forward folds, per-target metrics and
feature importance stop being fixtures. **What stays SYNTHETIC.** The ML portfolio equity
curve, optimised weights and net-of-cost strategy statistics still require Phase 8–10
(covariance / portfolio / backtest). SHAP values are Phase 7 follow-up work (gain importance
only here). Fundamental factors remain Phase 1.

**Protocol.** No random split, ever. Expanding training window from 2020 with quarterly
refit (63 trading days) starting 2022-01-03 — the same out-of-sample epoch the dashboard
labels "out-of-sample". Per-target purging (labels must end before the validation window
opens, by the target horizon plus embargo) and a 5-day embargo. Early stopping uses a
rolling 126-trading-day validation window that precedes each test window; the OOS test rows
are never touched by fitting, tuning or stopping. Decision convention: daily EOD, features
through close of date *t* are the decision inputs at close *t* (`RESEARCH_PROTOCOL.md` L21);
labels start at that same close.

**Compute boundary.** Runs in Colab, never on the local control plane (`AGENTS.md` §2). The
local rehearsal (`dry_run_train.py`) executes this same notebook end-to-end on the frozen
Parquet with a stub gradient-booster (no LightGBM installed, nothing trained locally).

---

## Before you run

1. Runtime → **CPU** (LightGBM is CPU-bound here; no GPU needed).
2. Drive must contain the acquisition outputs: `NasdaqAIQuant/04_clean/clean_prices_v001.parquet`
   and `NasdaqAIQuant/03_raw/prices_v001.parquet`.
3. Run cells top to bottom. The validation cell **hard-fails by design**.
4. The final cell prints a download link for the training bundle; keep
   `run_manifest_train_v001.json` — it is the audit record of the run.
"""),
    code(r"""
# --- Cell 1: dependencies -------------------------------------------------
# Colab ships pandas/numpy. LightGBM and pyarrow are not guaranteed, so they
# are installed explicitly rather than assumed. scipy arrives with lightgbm;
# no other heavy dependency is needed (SHAP is deferred to Phase 7).
!pip -q install lightgbm pyarrow 2>&1 | tail -2

import sys, json, math, time, hashlib, os, shutil, zipfile
from datetime import datetime, timezone

import numpy as np
import pandas as pd

import warnings
warnings.filterwarnings("ignore")
pd.set_option("display.width", 200)

print("python  ", sys.version.split()[0])
print("pandas  ", pd.__version__)
print("numpy   ", np.__version__)

import lightgbm as lgb
print("lightgbm", lgb.__version__)
MODEL_ENGINE = "lightgbm" if lgb.__version__ != "dry-run-stub" else "stub (local harness)"
"""),
    md(r"""
## Cell 2 — Mount Drive and declare paths

Canonical Drive layout follows `WORKTREE.md` §3 (`05_features`, `06_targets`, `07_models`,
`08_predictions`). Artifacts are versioned and never overwritten (`WORKTREE.md` §4).
Artifact names `features_v003` / `targets_v002` / `predictions_v007` are the
**pre-registered** names from the dashboard manifest and `models.json` — this notebook is
their producer.
"""),
    code(r"""
# --- Cell 2: Drive mount + paths ------------------------------------------
from google.colab import drive
drive.mount('/content/drive')

import os

SPEC_VERSION     = "0.1.0"
UNIVERSE_VERSION = "0.1.0"
DATA_VERSION     = "v001"
FEATURE_VERSION  = "features_v003"
TARGET_VERSION   = "targets_v002"
MODEL_VERSION    = "lgbm_v001"
NOTEBOOK_NAME    = "nasdaq_ai_quant_train_v001.ipynb"

# Execution context for provenance. "colab_notebook" on a canonical Colab run;
# the local harness sets NQ_RUN_CONTEXT explicitly so a stored manifest can
# never claim a Colab run that did not happen (D0026/D0027 convention).
RUN_CONTEXT = os.environ.get("NQ_RUN_CONTEXT", "colab_notebook")

START          = "2020-01-01"
END_INCLUSIVE  = "2026-09-22"
OOS_START      = "2022-01-03"    # first walk-forward test date (dashboard OOS epoch)
REFIT_STEP     = 63              # trading days per test window (quarterly refit)
VAL_LEN        = 126             # rolling validation window for early stopping
EMBARGO        = 5               # trading days
SEED           = 20260925        # project seed (manifest / fixture convention)

DRIVE_ROOT = "NasdaqAIQuant"
DRIVE      = "/content/drive/MyDrive"
IN_CLEAN   = f"{DRIVE}/{DRIVE_ROOT}/04_clean/clean_prices_{DATA_VERSION}.parquet"
IN_RAW     = f"{DRIVE}/{DRIVE_ROOT}/03_raw/prices_{DATA_VERSION}.parquet"
F_FEATURES = f"{DRIVE}/{DRIVE_ROOT}/05_features/{FEATURE_VERSION}.parquet"
FEATURE_META_FILE = FEATURE_VERSION.replace("features_", "feature_meta_") + ".json"
F_FEATMETA = f"{DRIVE}/{DRIVE_ROOT}/05_features/{FEATURE_META_FILE}"
F_TARGETS  = f"{DRIVE}/{DRIVE_ROOT}/06_targets/{TARGET_VERSION}.parquet"
F_REPORT   = f"{DRIVE}/{DRIVE_ROOT}/07_models/training_report_v001.json"
F_PRED     = f"{DRIVE}/{DRIVE_ROOT}/08_predictions/predictions_v007.parquet"
RUN_PATH   = f"{DRIVE}/{DRIVE_ROOT}/12_dashboard/runs/run_manifest_train_{DATA_VERSION}.json"
LOCAL_BUNDLE = "/content/dashboard_training_data"
ZIP_PATH     = "/content/dashboard_training_bundle.zip"

UNIVERSE = ["NVDA","AVGO","AMD","MU","MSFT","GOOGL","AMZN","META","PLTR","MRVL",
            "LRCX","AMAT","CDNS","SNPS","PANW","CRWD","ADBE","DDOG","CRWV","QCOM"]
BENCH = "QQQ"   # market-relative features reference the Nasdaq-100 proxy

TARGETS = {
    "return_1d":    {"horizon": 1,  "objective": "regression", "label": "1D Forward Return"},
    "return_5d":    {"horizon": 5,  "objective": "regression", "label": "5D Forward Return"},
    "return_21d":   {"horizon": 21, "objective": "regression", "label": "21D Forward Return"},
    "vol_5d":       {"horizon": 5,  "objective": "regression", "label": "5D Realised Vol (ann.)"},
    "vol_21d":      {"horizon": 21, "objective": "regression", "label": "21D Realised Vol (ann.)"},
    "direction_5d": {"horizon": 5,  "objective": "binary",     "label": "5D Direction"},
    "direction_21d":{"horizon": 21, "objective": "binary",     "label": "21D Direction"},
}
FEATURES = [
    "ret_1d","ret_5d","ret_21d","ret_63d","ret_126d","momentum_12_1",
    "vol_21d","vol_63d","dist_52w_high","sma_20_50","sma_50_200","rsi_14",
    "macd_hist","vol_ratio_21","ret_21d_rel","beta_63d",
    "cs_rank_mom","cs_rank_vol21",
]

# Pre-registered model configuration (Phase 6 v1). Chosen a priori; no OOS
# tuning. Staged tuning on validation windows is future protocol work.
# deterministic/force_row_wise keep refits bit-identical across runs (the
# determinism check refits one fold and requires exactly equal predictions).
LGBM_PARAMS = {
    "regression": dict(n_estimators=600, learning_rate=0.05, num_leaves=31,
                       min_child_samples=40, colsample_bytree=0.9, subsample=0.8,
                       subsample_freq=1, reg_lambda=1.0,
                       deterministic=True, force_row_wise=True),
    "binary":     dict(n_estimators=600, learning_rate=0.05, num_leaves=31,
                       min_child_samples=40, colsample_bytree=0.9, subsample=0.8,
                       subsample_freq=1, reg_lambda=1.0,
                       deterministic=True, force_row_wise=True),
}
EARLY_STOPPING_ROUNDS = 50

print("window   ", START, "->", END_INCLUSIVE)
print("OOS from ", OOS_START, "| refit", REFIT_STEP, "d | val", VAL_LEN, "d | embargo", EMBARGO, "d")
print("features ", len(FEATURES), "| targets", len(TARGETS))
"""),
    md(r"""
## Cell 3 — Load the frozen clean panel

Input is the acquisition's clean panel: one row per (calendar date × name) with explicit
`is_tradable` / `is_valid` flags and **nulls where a name had not listed yet** (CRWV trades
from 2025-03; PLTR from 2020-09). No pre-listing observations are ever synthesised
(`PROJECT_SPEC.md` §7). Benchmark closes for the market-relative features come from the raw
parquet (the clean panel holds the 20 constituents only).
"""),
    code(r"""
# --- Cell 3: load + input integrity ---------------------------------------
import os

for p_ in (IN_CLEAN, IN_RAW):
    if not os.path.exists(p_):
        raise SystemExit(
            f"missing input {p_} — upload the acquisition bundle first "
            "(03_raw + 04_clean per WORKTREE.md §3)")

clean = pd.read_parquet(IN_CLEAN)
raw = pd.read_parquet(IN_RAW)

clean["date"] = pd.to_datetime(clean["date"])
raw = raw.reset_index()
if "Date" in raw.columns:
    raw = raw.rename(columns={"Date": "date"})
elif "index" in raw.columns:
    raw = raw.rename(columns={"index": "date"})
raw["date"] = pd.to_datetime(raw["date"])

CAL = pd.DatetimeIndex(sorted(clean["date"].unique()))
CAL = CAL[CAL <= pd.Timestamp(END_INCLUSIVE)]
NAMES = sorted(clean["ticker"].unique())

bench = (raw[raw["ticker"] == BENCH][["date", "adj_close"]]
         .set_index("date")["adj_close"].sort_index())
bench = bench.reindex(CAL).ffill()

input_stats = {
    "clean_rows": int(len(clean)), "names": len(NAMES), "calendar_days": len(CAL),
    "first_date": str(CAL[0].date()), "last_date": str(CAL[-1].date()),
    "tradable": int(clean["is_tradable"].sum()), "valid": int(clean["is_valid"].sum()),
    "bench_rows": int(bench.notna().sum()),
}
print(json.dumps(input_stats, indent=1))
"""),
    md(r"""
## Cell 4 — Feature factory (Phase 5)

18 price/volume features across the `PLAN.md` families — returns, momentum, volatility,
trend, volume, technical state, relative strength, market-relative, cross-sectional ranks.
Every feature at date *t* uses data up to and including close *t* only (the availability
rule is the decision timestamp, `RESEARCH_PROTOCOL.md` L21). Cross-sectional ranks are
computed strictly per date. Adjusted close is the price basis (`RESEARCH_PROTOCOL.md` §5);
volume is raw (volume-ratio features are scale-free; `is_valid` guarantees it is present).
"""),
    code(r"""
# --- Cell 4: feature factory ----------------------------------------------
def _logret(s):
    return np.log(s / s.shift(1))

def _rsi(series, n=14):
    d = series.diff()
    up = d.clip(lower=0.0).rolling(n).mean()
    dn = (-d.clip(upper=0.0)).rolling(n).mean()
    rs = up / dn.replace(0.0, np.nan)
    return 100.0 - 100.0 / (1.0 + rs)

def build_features(clean_df, bench_close, names, calendar):
    # Wide per-name features -> long frame [date, ticker, *FEATURES, available_at].
    qqq_r = _logret(bench_close)
    parts = []
    for tk in names:
        f = (clean_df[clean_df["ticker"] == tk]
             .set_index("date").reindex(calendar).sort_index())
        px, vol = f["adj_close"], f["volume"]
        r = _logret(px)
        out = pd.DataFrame(index=calendar)
        out["ret_1d"]    = r
        out["ret_5d"]    = np.log(px / px.shift(5))
        out["ret_21d"]   = np.log(px / px.shift(21))
        out["ret_63d"]   = np.log(px / px.shift(63))
        out["ret_126d"]  = np.log(px / px.shift(126))
        out["momentum_12_1"] = px.shift(21) / px.shift(252) - 1.0
        out["vol_21d"]   = r.rolling(21).std() * math.sqrt(252)
        out["vol_63d"]   = r.rolling(63).std() * math.sqrt(252)
        out["dist_52w_high"] = px / px.rolling(252).max() - 1.0
        out["sma_20_50"] = px.rolling(20).mean() / px.rolling(50).mean() - 1.0
        out["sma_50_200"]= px.rolling(50).mean() / px.rolling(200).mean() - 1.0
        out["rsi_14"]    = (_rsi(px) - 50.0) / 50.0
        ema12 = px.ewm(span=12, adjust=False).mean()
        ema26 = px.ewm(span=26, adjust=False).mean()
        macd  = ema12 - ema26
        sig   = macd.ewm(span=9, adjust=False).mean()
        out["macd_hist"] = (macd - sig) / px
        out["vol_ratio_21"] = vol / vol.rolling(21).mean() - 1.0
        qqq_on_cal = qqq_r.reindex(calendar)
        out["ret_21d_rel"] = out["ret_21d"] - qqq_on_cal
        cov = r.rolling(63).cov(qqq_on_cal)
        var = qqq_on_cal.rolling(63).var()
        out["beta_63d"] = cov / var
        out["ticker"] = tk
        out["date"] = calendar
        parts.append(out.reset_index(drop=True))
    long = pd.concat(parts, ignore_index=True)
    # Cross-sectional ranks: strictly date-local, over names with a defined value.
    for col, cs in (("momentum_12_1", "cs_rank_mom"), ("vol_21d", "cs_rank_vol21")):
        long[cs] = long.groupby("date")[col].rank(pct=True)
    long["available_at"] = long["date"]          # EOD close of the feature row
    long["feature_version"] = FEATURE_VERSION
    long["universe_version"] = UNIVERSE_VERSION
    return long

features_long = build_features(clean, bench, NAMES, CAL)

FEATURE_META = {
    "ret_1d": ("returns", "log(adj_close_t / adj_close_t-1)", 2),
    "ret_5d": ("returns", "log(adj_close_t / adj_close_t-5)", 6),
    "ret_21d": ("returns", "log(adj_close_t / adj_close_t-21)", 22),
    "ret_63d": ("returns", "log(adj_close_t / adj_close_t-63)", 64),
    "ret_126d": ("returns", "log(adj_close_t / adj_close_t-126)", 127),
    "momentum_12_1": ("momentum", "adj_close_t-21 / adj_close_t-252 - 1 (skips last 21d)", 273),
    "vol_21d": ("volatility", "std(daily log returns, 21d) * sqrt(252)", 22),
    "vol_63d": ("volatility", "std(daily log returns, 63d) * sqrt(252)", 64),
    "dist_52w_high": ("trend", "adj_close / rolling_max(252) - 1", 252),
    "sma_20_50": ("trend", "SMA20 / SMA50 - 1", 50),
    "sma_50_200": ("trend", "SMA50 / SMA200 - 1", 200),
    "rsi_14": ("technical", "(RSI(14, simple avg gain/loss) - 50) / 50", 15),
    "macd_hist": ("technical", "(EMA12 - EMA26 - signal(9)) / adj_close", 35),
    "vol_ratio_21": ("volume", "volume / SMA21(volume) - 1", 22),
    "ret_21d_rel": ("market-relative", "ret_21d - QQQ ret_21d (same date)", 22),
    "beta_63d": ("market-relative", "rolling 63d cov(r_i, r_QQQ) / var(r_QQQ)", 64),
    "cs_rank_mom": ("cross-sectional", "per-date percentile rank of momentum_12_1", 273),
    "cs_rank_vol21": ("cross-sectional", "per-date percentile rank of vol_21d", 22),
}
assert set(FEATURE_META) == set(FEATURES)
coverage = features_long[FEATURES].notna().mean().round(4).to_dict()
print("feature frame:", features_long.shape)
print("coverage |", json.dumps({k: v for k, v in list(coverage.items())[:6]}, indent=0))
"""),
    md(r"""
## Cell 5 — Target factory (Phase 5)

Seven targets per `PROJECT_SPEC.md` §10, emitted in the canonical long schema of
`DATA_CONTRACT.md` §7. All targets are **forward-looking labels**, defined only where the
full label window exists — the last *h* dates of a name carry no label. `label_end` is the
actual trading date at *t + h*. Vol targets are close-to-close realised vol of the next *h*
daily returns, annualised (×√252, ddof=1).
"""),
    code(r"""
# --- Cell 5: target factory -----------------------------------------------
def build_targets(clean_df, names, calendar):
    rows = []
    for tk in names:
        px = (clean_df[clean_df["ticker"] == tk]
              .set_index("date").reindex(calendar)["adj_close"].sort_index())
        r = px / px.shift(1) - 1.0
        fwd = {
            "return_1d":  px.shift(-1) / px - 1.0,
            "return_5d":  px.shift(-5) / px - 1.0,
            "return_21d": px.shift(-21) / px - 1.0,
            "vol_5d":     r.rolling(5).std().shift(-5) * math.sqrt(252),
            "vol_21d":    r.rolling(21).std().shift(-21) * math.sqrt(252),
        }
        fwd["direction_5d"]  = pd.Series(
            np.where(fwd["return_5d"].notna(), (fwd["return_5d"] > 0).astype(float), np.nan),
            index=calendar)
        fwd["direction_21d"] = pd.Series(
            np.where(fwd["return_21d"].notna(), (fwd["return_21d"] > 0).astype(float), np.nan),
            index=calendar)
        for tname, spec in TARGETS.items():
            h = spec["horizon"]
            v = fwd[tname]
            for i in range(len(calendar) - h):        # label_end must exist
                val = v.iloc[i]
                if pd.isna(val):
                    continue
                rows.append({
                    "ticker": tk, "date": calendar[i],
                    "target_name": tname, "target_value": float(val),
                    "target_horizon": h,
                    "label_start": calendar[i], "label_end": calendar[i + h],
                    "target_version": TARGET_VERSION,
                })
    return pd.DataFrame(rows)

targets_long = build_targets(clean, NAMES, CAL)
print("target rows:", len(targets_long))
print(targets_long.groupby("target_name")["target_value"].agg(["count", "mean", "std"]).round(5))
"""),
    md(r"""
## Cell 6 — Walk-forward schedule (Phase 6)

Expanding training window from 2020; test windows of 63 trading days from 2022-01-03;
refit every fold. **Purging** is per target: training rows must have `label_end` strictly
before the validation window opens (horizon *h* plus embargo), and validation rows must not
have labels extending into the test window (`val_end + max(h, embargo) < test_start`).
Early stopping watches the rolling 126-trading-day validation window; nothing after the
test start is ever read during fitting.
"""),
    code(r"""
# --- Cell 6: fold schedule -------------------------------------------------
POS = {d: i for i, d in enumerate(CAL)}

def build_folds(target_name):
    h = TARGETS[target_name]["horizon"]
    oos0 = next(i for i, d in enumerate(CAL) if d >= pd.Timestamp(OOS_START))
    folds = []
    k, t0 = 0, oos0
    while t0 < len(CAL):
        t1 = min(t0 + REFIT_STEP, len(CAL))
        val_end = t0 - 1 - max(h, EMBARGO)
        val_start = val_end - VAL_LEN + 1
        train_end = val_start - 1 - h - EMBARGO
        if train_end < 60 or val_start < 0:
            raise SystemExit(f"fold schedule degenerate for {target_name} at k={k}")
        folds.append({
            "fold": k, "train_pos": (0, train_end),
            "val_pos": (val_start, val_end), "test_pos": (t0, t1 - 1),
            "purge_days": h, "embargo_days": EMBARGO,
            "val_test_gap_days": max(h, EMBARGO),
        })
        k += 1
        t0 = t1
    return folds

FOLDS = {t: build_folds(t) for t in TARGETS}
fold_counts = {t: len(FOLDS[t]) for t in TARGETS}
print("folds per target:", json.dumps(fold_counts))
f0 = FOLDS["return_5d"][0]
print("fold0 test:", CAL[f0["test_pos"][0]].date(), "->", CAL[f0["test_pos"][1]].date(),
      "| train ends:", CAL[f0["train_pos"][1]].date(),
      "| val:", CAL[f0["val_pos"][0]].date(), "->", CAL[f0["val_pos"][1]].date())
"""),
    md(r"""
## Cell 7 — Walk-forward training

One estimator per target (materially different objectives/horizons get separate models,
`AGENTS.md` §9). Pooled cross-sectional panel of all 20 names; identity is deliberately not
a feature (pure numeric state + date-local ranks). Rows are kept only where at least 5 of
the 18 features are defined — a name enters the panel after its feature warmup (CRWV from
its ~22nd session); the validation suite proves warmup is the only cause of unpredicted
label rows. Early stopping with 50 rounds on the validation window; `best_iter` recorded
per fold. Backend note: `lightgbm` here; the local rehearsal replaces it with a
deterministic stub module — the training code path is otherwise identical.
"""),
    code(r"""
# --- Cell 7: training loop -------------------------------------------------
def make_model(objective):
    params = dict(LGBM_PARAMS[objective])
    params["random_state"] = SEED
    if objective == "binary":
        return lgb.LGBMClassifier(objective="binary", **params)
    return lgb.LGBMRegressor(objective="regression", **params)

def fold_rows(matrix, pos):
    p0, p1 = pos
    return matrix[(matrix["_pos"] >= p0) & (matrix["_pos"] <= p1)]

t_start = time.time()
prediction_rows = []
fold_records = {t: [] for t in TARGETS}
importances = {t: np.zeros(len(FEATURES)) for t in TARGETS}

matrix_base = features_long.merge(
    targets_long, left_on=["ticker", "date"], right_on=["ticker", "date"],
    how="inner", suffixes=("", "_t"))
matrix_base["_pos"] = matrix_base["date"].map(POS)
usable = matrix_base[FEATURES].notna().sum(axis=1) >= 5
matrix_base = matrix_base[usable].copy()
print(f"training matrix: {len(matrix_base):,} rows, "
      f"{matrix_base['date'].nunique()} dates, {matrix_base['ticker'].nunique()} names")

for tname, spec in TARGETS.items():
    h, objective = spec["horizon"], spec["objective"]
    tgt = matrix_base[matrix_base["target_name"] == tname]
    for fold in FOLDS[tname]:
        tr = fold_rows(tgt, fold["train_pos"])
        va = fold_rows(tgt, fold["val_pos"])
        te = fold_rows(tgt, fold["test_pos"])
        if len(tr) < 200 or len(va) < 100 or len(te) == 0:
            raise SystemExit(f"degenerate fold {fold['fold']} for {tname}")
        Xtr, ytr = tr[FEATURES].to_numpy(float), tr["target_value"].to_numpy(float)
        Xva, yva = va[FEATURES].to_numpy(float), va["target_value"].to_numpy(float)
        model = make_model(objective)
        model.fit(Xtr, ytr, eval_set=[(Xva, yva)],
                  callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False),
                             lgb.log_evaluation(0)])
        prob = model.predict_proba(te[FEATURES].to_numpy(float))[:, 1] if objective == "binary" \
            else model.predict(te[FEATURES].to_numpy(float))
        try:
            best_iter = int(model.best_iteration_)
        except Exception:
            best_iter = int(model.n_estimators)
        importances[tname] += np.asarray(
            model.booster_.feature_importance(importance_type="gain"), dtype=float)
        t0p, t1p = fold["test_pos"]
        prediction_rows.append(pd.DataFrame({
            "ticker": te["ticker"].to_numpy(),
            "prediction_date": te["date"].to_numpy(),
            "target_name": tname,
            "prediction": np.asarray(prob, dtype=float),
            "model_version": MODEL_VERSION, "feature_version": FEATURE_VERSION,
            "universe_version": UNIVERSE_VERSION,
            "train_start": CAL[fold["train_pos"][0]], "train_end": CAL[fold["train_pos"][1]],
            "validation_start": CAL[fold["val_pos"][0]], "validation_end": CAL[fold["val_pos"][1]],
            "prediction_generated_at": None,       # stamped once below
            "is_oos": True,
        }))
        fold_records[tname].append({
            "fold": fold["fold"],
            "train_start": str(CAL[fold["train_pos"][0]].date()),
            "train_end": str(CAL[fold["train_pos"][1]].date()),
            "val_start": str(CAL[fold["val_pos"][0]].date()),
            "val_end": str(CAL[fold["val_pos"][1]].date()),
            "test_start": str(CAL[t0p].date()), "test_end": str(CAL[t1p].date()),
            "n_train": int(len(tr)), "n_val": int(len(va)), "n_test": int(len(te)),
            "purge_days": fold["purge_days"], "embargo_days": fold["embargo_days"],
            "val_test_gap_days": fold["val_test_gap_days"], "best_iter": best_iter,
            "oos_ic": None, "oos_r2": None,   # filled by the metrics cell
        })
    print(f"{tname:14s} folds done: {len(fold_records[tname])}  "
          f"({time.time() - t_start:6.1f}s elapsed)")

GEN_STAMP = datetime.now(timezone.utc).isoformat()
predictions = pd.concat(prediction_rows, ignore_index=True)
predictions["prediction_generated_at"] = GEN_STAMP
predictions["is_oos"] = predictions["is_oos"].astype(bool)
print("predictions:", predictions.shape)
"""),
    md(r"""
## Cell 8 — Metrics engine (Phase 7 core)

Cross-sectional daily Spearman IC (mean/std/ICIR), hit rate, R²/RMSE/MAE, decile quantile
monotonicity, annual IC breakdown, IC decay across horizons and normalised gain importance.
ICIR here is the unannualised mean/std of the daily IC series (documented convention).
"""),
    code(r"""
# --- Cell 8: metrics engine ------------------------------------------------
MIN_NAMES_PER_DATE = 5

def _spearman(a, b):
    # Rank correlation without a scipy dependency: Spearman == Pearson on
    # average ranks (identical to scipy.stats.spearmanr including tied data).
    ra, rb = a.rank(), b.rank()
    if ra.nunique() < 2 or rb.nunique() < 2:
        return np.nan
    return float(ra.corr(rb))

def daily_ic(pred_df, tgt_df, tname):
    # Cross-sectional Spearman IC per date between a prediction frame and a label column.
    m = pred_df.merge(tgt_df[tgt_df["target_name"] == tname],
                      left_on=["ticker", "prediction_date"],
                      right_on=["ticker", "date"], how="inner")
    out = []
    for d_, g in m.groupby("prediction_date"):
        if len(g) >= MIN_NAMES_PER_DATE:
            c = _spearman(g["prediction"], g["target_value"])
            if pd.notna(c):
                out.append((d_, float(c)))
    return pd.DataFrame(out, columns=["date", "ic"]), m

def ic_series(pred_df, tgt_df, tname):
    return daily_ic(pred_df[pred_df["target_name"] == tname], tgt_df, tname)

def hit_rate(m, tname):
    if TARGETS[tname]["objective"] == "binary":
        # Direction targets: predicted class (prob > 0.5) vs realised class.
        return float(((m["prediction"] > 0.5) == (m["target_value"] > 0.5)).mean())
    if tname.startswith("return"):
        # Return targets: sign agreement.
        return float(((m["prediction"] > 0) == (m["target_value"] > 0)).mean())
    # Vol targets: relative-position agreement around OOS medians.
    pos_pred = np.sign(m["prediction"] - m["prediction"].median())
    pos_true = np.sign(m["target_value"] - m["target_value"].median())
    return float((pos_pred == pos_true).mean())

def r2_rmse_mae(m):
    y, p = m["target_value"].to_numpy(float), m["prediction"].to_numpy(float)
    ss_res, ss_tot = float(((y - p) ** 2).sum()), float(((y - y.mean()) ** 2).sum())
    return (1 - ss_res / ss_tot if ss_tot > 0 else np.nan,
            float(np.sqrt(((y - p) ** 2).mean())), float(np.abs(y - p).mean()))

def quantile_profile(m, q=10):
    try:
        bins = pd.qcut(m["prediction"], q, labels=False, duplicates="drop")
    except ValueError:
        return []
    return [float(m.loc[bins == b, "target_value"].mean()) for b in sorted(set(bins.dropna()))]

metrics = {}
for tname in TARGETS:
    ics, m = ic_series(predictions, targets_long, tname)
    ic_mean, ic_std = float(ics["ic"].mean()), float(ics["ic"].std(ddof=1))
    r2, rmse, mae = r2_rmse_mae(m)
    yearly = {str(k): round(float(v), 4) for k, v in ics.groupby(ics["date"].dt.year.astype(str))["ic"].mean().items()}
    decay = {}
    pp_t = predictions[predictions["target_name"] == tname]
    for h_t in ("return_1d", "return_5d", "return_21d"):
        d_ics = daily_ic(pp_t, targets_long, h_t)[0]
        decay[h_t] = round(float(d_ics["ic"].mean()), 4) if len(d_ics) else None
    imp = importances[tname]
    imp_norm = imp / imp.sum() if imp.sum() > 0 else imp
    importance = sorted(
        [{"feature": f_, "gain": round(float(w), 5)} for f_, w in zip(FEATURES, imp_norm)],
        key=lambda d_: -d_["gain"])[:15]
    metrics[tname] = {
        "target": tname, "label": TARGETS[tname]["label"],
        "objective": TARGETS[tname]["objective"],
        "horizon_days": TARGETS[tname]["horizon"],
        "model_version": MODEL_VERSION, "feature_version": FEATURE_VERSION,
        "target_version": TARGET_VERSION,
        "oos_ic_mean": round(ic_mean, 4), "oos_ic_std": round(ic_std, 4),
        "icir": round(ic_mean / ic_std, 3) if ic_std > 0 else None,
        "hit_rate": round(hit_rate(m, tname), 4),
        "hit_rate_convention": ("predicted-class accuracy (prob > 0.5)"
                                if TARGETS[tname]["objective"] == "binary"
                                else "sign agreement" if tname.startswith("return")
                                else "relative-position agreement (OOS medians)"),
        "r2": round(r2, 4), "rmse": round(rmse, 6), "mae": round(mae, 6),
        "n_oos_rows": int(len(m)),
        "oos_start": str(m["prediction_date"].min().date()),
        "oos_end": str(m["prediction_date"].max().date()),
        "ic_dates": int(len(ics)),
        "ic_series": [round(float(v), 4) for v in ics["ic"]],
        "annual_ic": yearly,
        "decay": decay,
        "quantiles": [round(v, 5) for v in quantile_profile(m)],
        "feature_importance": importance,
        "hyperparameters": dict(LGBM_PARAMS[TARGETS[tname]["objective"]],
                                early_stopping_rounds=EARLY_STOPPING_ROUNDS,
                                seed=SEED),
    }
    # fill per-fold OOS diagnostics
    for fr in fold_records[tname]:
        fm = m[(m["prediction_date"] >= pd.Timestamp(fr["test_start"])) &
               (m["prediction_date"] <= pd.Timestamp(fr["test_end"]))]
        fi = daily_ic(pp_t[(pp_t["prediction_date"] >= pd.Timestamp(fr["test_start"])) &
                           (pp_t["prediction_date"] <= pd.Timestamp(fr["test_end"]))],
                      targets_long, tname)[0]
        fr["oos_ic"] = round(float(fi["ic"].mean()), 4) if len(fi) else None
        fr["oos_r2"] = round(r2_rmse_mae(fm)[0], 4) if len(fm) else None
    metrics[tname]["folds"] = fold_records[tname]
    print(f"{tname:14s} IC {ic_mean:+.4f}  ICIR {metrics[tname]['icir']}  "
          f"hit {metrics[tname]['hit_rate']:.3f}  R2 {r2:+.4f}  n {len(m):,}")
"""),
    md(r"""
## Cell 9 — Validation suite and artifacts

Gate-4 leakage checks recompute sample feature/target values from raw closes using only
data up to the sample date; Gate-5 checks assert split geometry, purging and OOS labelling
on every fold; recomputation checks rebuild the headline metrics straight from the
prediction/label tables. The cell **raises on any failure** — a failing bundle is never
written.
"""),
    code(r"""
# --- Cell 9: artifacts + validation ---------------------------------------
errors, warnings_out, checks = [], [], []

def check(name, ok, detail=""):
    checks.append({"check": name, "status": "PASS" if ok else "FAIL", "detail": detail})
    if not ok:
        errors.append(f"{name}: {detail}")

# ---- artifact writes (parquet + report + manifest + bundle) --------------
def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)

feat_out = features_long[["date", "ticker"] + FEATURES + ["available_at",
                           "feature_version", "universe_version"]]
write_feature_meta = {f_: {"family": v_[0], "formula": v_[1],
                           "lookback_trading_days": v_[2],
                           "availability_rule": "close of date t (EOD decision timestamp)"}
                      for f_, v_ in FEATURE_META.items()}
write_feature_meta_meta = {"feature_version": FEATURE_VERSION,
                           "universe_version": UNIVERSE_VERSION,
                           "generated_at": GEN_STAMP, "features": write_feature_meta}
for p_ in (F_FEATURES, F_FEATMETA, F_TARGETS, F_REPORT, F_PRED, RUN_PATH):
    os.makedirs(os.path.dirname(p_), exist_ok=True)
feat_out.to_parquet(F_FEATURES, index=False)
write_json(F_FEATMETA, write_feature_meta_meta)
targets_long.to_parquet(F_TARGETS, index=False)
predictions.to_parquet(F_PRED, index=False)

PARQUET_HASHES = {}
for p_ in (F_FEATURES, F_TARGETS, F_PRED):
    with open(p_, "rb") as fh:
        PARQUET_HASHES[os.path.basename(p_)] = hashlib.sha256(fh.read()).hexdigest()

# ---- Gate 4: leakage checks ----------------------------------------------
def recompute_from_raw(tk, upto, feature):
    f = clean[clean["ticker"] == tk].set_index("date").reindex(CAL)
    px = f["adj_close"].loc[:upto]
    vol = f["volume"].loc[:upto]
    r = np.log(px / px.shift(1))
    if feature == "momentum_12_1":
        return float(px.iloc[-22] / px.iloc[-253] - 1.0)
    if feature == "rsi_14":
        d = px.diff()
        up = d.clip(lower=0).rolling(14).mean().iloc[-1]
        dn = (-d.clip(upper=0)).rolling(14).mean().iloc[-1]
        return float(((100 - 100 / (1 + up / dn)) - 50) / 50)
    if feature == "dist_52w_high":
        return float(px.iloc[-1] / px.rolling(252).max().iloc[-1] - 1.0)
    if feature == "vol_21d":
        return float(r.rolling(21).std().iloc[-1] * math.sqrt(252))
    if feature == "beta_63d":
        b = bench.loc[:upto]
        q = np.log(b / b.shift(1))
        cov = r.rolling(63).cov(q).iloc[-1]
        var = q.rolling(63).var().iloc[-1]
        return float(cov / var)
    raise SystemExit(f"unhandled feature {feature}")

LEAK_SAMPLES = [("NVDA", "2022-06-15", "momentum_12_1"),
                ("MSFT", "2023-03-10", "rsi_14"),
                ("PLTR", "2023-11-20", "vol_21d"),
                ("AVGO", "2024-05-06", "dist_52w_high"),
                ("CRWD", "2025-02-14", "beta_63d")]
leak_fail = []
for tk, dts, feat in LEAK_SAMPLES:
    d = pd.Timestamp(dts)
    stored = features_long.loc[(features_long["ticker"] == tk) &
                               (features_long["date"] == d), feat]
    if len(stored) != 1 or pd.isna(stored.iloc[0]):
        leak_fail.append(f"{tk} {dts} {feat}: no stored value")
        continue
    re_ = recompute_from_raw(tk, d, feat)
    if not math.isclose(float(stored.iloc[0]), re_, rel_tol=1e-9, abs_tol=1e-12):
        leak_fail.append(f"{tk} {dts} {feat}: stored {stored.iloc[0]} vs recompute {re_}")
check("gate4_feature_recompute_truncated", not leak_fail, "; ".join(leak_fail) or "5 samples exact")

# cross-sectional ranks date-local
d0 = CAL[len(CAL) // 2]
g = features_long[(features_long["date"] == d0) & features_long["momentum_12_1"].notna()]
check("gate4_cs_rank_date_local",
      bool(((g["cs_rank_mom"] >= 1 / len(g)) & (g["cs_rank_mom"] <= 1)).all()),
      f"{len(g)} names on {d0.date()}")

# target recompute for samples
t5 = targets_long[(targets_long["target_name"] == "return_5d") &
                  (targets_long["ticker"] == "NVDA") &
                  (targets_long["date"] == pd.Timestamp("2023-01-17"))]
if len(t5) == 1:
    px = clean[clean["ticker"] == "NVDA"].set_index("date")["adj_close"].reindex(CAL)
    i = POS[pd.Timestamp("2023-01-17")]
    expect = px.iloc[i + 5] / px.iloc[i] - 1.0
    check("gate4_target_recompute_return_5d",
          math.isclose(float(t5["target_value"].iloc[0]), expect, rel_tol=1e-12),
          f"label_end {t5['label_end'].iloc[0].date()}")
else:
    check("gate4_target_recompute_return_5d", False, "sample row missing")

# feature/target availability convention
check("gate4_availability_decision_convention",
      (features_long["available_at"] == features_long["date"]).all(),
      "features stamped at close of their row date (decision convention, PROTOCOL L21)")

# label/target structural alignment
_pos_start = targets_long["label_start"].map(POS)
_by_pos = pd.Series(CAL, index=np.arange(len(CAL)))
expected_end = _by_pos.reindex(_pos_start.to_numpy() + targets_long["target_horizon"].to_numpy()).to_numpy()
check("gate4_target_label_end_alignment",
      bool((targets_long["label_end"].to_numpy() == expected_end).all()),
      f"{len(targets_long):,} label rows; label_end == trading date at t + horizon")
check("gate4_target_horizon_config",
      all((targets_long.loc[targets_long["target_name"] == t, "target_horizon"]
           == TARGETS[t]["horizon"]).all() for t in TARGETS),
      "target_horizon matches the TARGETS config for every row")

# no pre-listing synthesis (PROJECT_SPEC §7): CRWV rows before its first
# tradable session must be entirely NaN, never a filled value.
crwv_first = clean.loc[clean["ticker"] == "CRWV", "date"].min()
pre_rows = features_long[(features_long["ticker"] == "CRWV") &
                         (features_long["date"] < crwv_first)]
check("gate4_no_pre_listing_synthesis",
      bool(pre_rows[FEATURES].isna().all().all()),
      f"{len(pre_rows):,} pre-listing CRWV rows all-NaN")
check("gate4_feature_grid_integrity",
      len(features_long) == len(CAL) * len(NAMES),
      f"{len(features_long):,} rows == {len(CAL)} dates x {len(NAMES)} names")

# ---- Gate 5: split geometry ----------------------------------------------
split_fail = []
train_fail, test_fail = [], []
oob = features_long[features_long["date"] >= pd.Timestamp(OOS_START)]
for tname, spec in TARGETS.items():
    h = spec["horizon"]
    seen = []
    for fr in FOLDS[tname]:
        tr1, va0, va1, te0 = fr["train_pos"][1], fr["val_pos"][0], fr["val_pos"][1], fr["test_pos"][0]
        if not (tr1 < va0 <= va1 < te0):
            split_fail.append(f"{tname} f{fr['fold']}: ordering")
        if te0 - va1 <= h:
            split_fail.append(f"{tname} f{fr['fold']}: val/test gap <= horizon")
        if tr1 + h >= va0:
            split_fail.append(f"{tname} f{fr['fold']}: purge insufficient")
        seen.extend(range(fr["test_pos"][0], fr["test_pos"][1] + 1))
    if seen != sorted(set(seen)):
        split_fail.append(f"{tname}: test windows overlap")
check("gate5_split_geometry", not split_fail, "; ".join(split_fail) or f"{len(TARGETS)} targets ok")
oos_first_pos = next(i for i, d in enumerate(CAL) if d >= pd.Timestamp(OOS_START))
last_pos = max(fr["test_pos"][1] for fr in FOLDS["return_5d"])
check("gate5_folds_cover_oos_to_end",
      FOLDS["return_5d"][0]["test_pos"][0] == oos_first_pos and last_pos == len(CAL) - 1,
      f"first test {CAL[oos_first_pos].date()}, last test {CAL[last_pos].date()}")

# OOS labelling
check("gate5_all_predictions_oos", bool(predictions["is_oos"].all()),
      f"{len(predictions):,} rows all is_oos=True")
check("gate5_train_end_before_test", bool(
    (pd.to_datetime(predictions["train_end"]) < predictions["prediction_date"]).all()),
    "every prediction's train window ends before its own date")
check("gate5_no_nan_predictions", not predictions["prediction"].isna().any(),
      f"{predictions['prediction'].isna().sum()} NaN")
dir_rows = predictions[predictions["target_name"].str.startswith("direction")]
check("gate5_probability_range", bool(dir_rows["prediction"].between(0, 1).all()),
      f"direction predictions in [0,1], n={len(dir_rows):,}")
check("gate5_oos_within_frozen_window", bool(
    (predictions["prediction_date"] >= pd.Timestamp(OOS_START)).all() and
    (predictions["prediction_date"] <= pd.Timestamp(END_INCLUSIVE)).all()),
    f"OOS dates span {predictions['prediction_date'].min().date()} "
    f"-> {predictions['prediction_date'].max().date()}")

# Coverage rule: every defined OOS label is predicted unless the row has fewer
# than 5 defined features (a name's warmup — e.g. CRWV's first ~22 sessions).
# This check proves that warmup is the ONLY cause of unpredicted label rows.
_t_oos = targets_long[targets_long["date"] >= pd.Timestamp(OOS_START)][["ticker", "date", "target_name"]]
_have = predictions[["ticker", "prediction_date", "target_name"]].rename(
    columns={"prediction_date": "date"})
_have["_has"] = 1
_unpred = _t_oos.merge(_have, on=["ticker", "date", "target_name"], how="left")
_unpred = _unpred[_unpred["_has"].isna()][["ticker", "date"]].drop_duplicates()
_fc = features_long.set_index(["ticker", "date"])[FEATURES].notna().sum(axis=1)
_unpred_n = (_fc.reindex(pd.MultiIndex.from_frame(_unpred)).to_numpy()
             if len(_unpred) else np.array([]))
check("gate5_coverage_rule_warmup_only",
      bool((_unpred_n < 5).all()),
      f"{len(_unpred)} unpredicted (ticker,date) rows, all <5 defined features"
      + (f"; names: {sorted(_unpred['ticker'].unique())}" if len(_unpred) else ""))

# determinism: refit one fold with the same seed and compare
tname_d = "return_5d"
spec_d = TARGETS[tname_d]
tgt_d = matrix_base[matrix_base["target_name"] == tname_d]
fr = FOLDS[tname_d][0]
tr = fold_rows(tgt_d, fr["train_pos"]); va = fold_rows(tgt_d, fr["val_pos"])
te = fold_rows(tgt_d, fr["test_pos"])
model_a = make_model(spec_d["objective"])
model_a.fit(tr[FEATURES].to_numpy(float), tr["target_value"].to_numpy(float),
            eval_set=[(va[FEATURES].to_numpy(float), va["target_value"].to_numpy(float))],
            callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False),
                       lgb.log_evaluation(0)])
model_b = make_model(spec_d["objective"])
model_b.fit(tr[FEATURES].to_numpy(float), tr["target_value"].to_numpy(float),
            eval_set=[(va[FEATURES].to_numpy(float), va["target_value"].to_numpy(float))],
            callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False),
                       lgb.log_evaluation(0)])
pa, pb = model_a.predict(te[FEATURES].to_numpy(float)), model_b.predict(te[FEATURES].to_numpy(float))
check("gate5_deterministic_refit", bool(np.array_equal(pa, pb)),
      f"identical predictions on {len(te)} rows (seed {SEED})")

# ---- metrics recomputation ------------------------------------------------
m5 = predictions[predictions["target_name"] == "return_5d"].merge(
    targets_long[targets_long["target_name"] == "return_5d"],
    left_on=["ticker", "prediction_date"], right_on=["ticker", "date"], how="inner")
rc = []
for d_, g in m5.groupby("prediction_date"):
    if len(g) >= MIN_NAMES_PER_DATE:
        c = _spearman(g["prediction"], g["target_value"])
        if pd.notna(c):
            rc.append(c)
recomputed_ic = float(np.mean(rc))
check("gate6_ic_recompute_match",
      math.isclose(recomputed_ic, metrics["return_5d"]["oos_ic_mean"], abs_tol=1e-4),
      f"recomputed {recomputed_ic:+.4f} vs report {metrics['return_5d']['oos_ic_mean']:+.4f}")
check("gate6_oos_coverage",
      all(metrics[t]["n_oos_rows"] > 10000 for t in TARGETS),
      json.dumps({t: metrics[t]["n_oos_rows"] for t in list(TARGETS)[:3]}))
check("gate6_quantile_profile",
      all(len(metrics[t]["quantiles"]) >= 8 for t in TARGETS),
      "decile profile populated for all targets")
check("gate6_ic_series_finite",
      all(len(m["ic_series"]) == m["ic_dates"] and np.isfinite(m["ic_series"]).all()
          for m in metrics.values()),
      "daily IC series length == ic_dates and all values finite")

# ---- artifacts on disk ----------------------------------------------------
check("artifact_features_written", os.path.exists(F_FEATURES), F_FEATURES)
check("artifact_targets_written", os.path.exists(F_TARGETS), F_TARGETS)
check("artifact_predictions_written", os.path.exists(F_PRED), F_PRED)

# ---- hard stop: never write a reporting bundle for a failing run ---------
if errors:
    print(f"\nvalidation: {len(checks) - len(errors)}/{len(checks)} PASS")
    for e_ in errors:
        print("  FAIL", e_)
    raise SystemExit(f"BUNDLE INVALID - {len(errors)} failing checks; do not upload")

# ---- training report + run manifest + bundle ------------------------------
report = {
    "artifact": "training_report", "version": "v001",
    "model_version": MODEL_VERSION, "feature_version": FEATURE_VERSION,
    "target_version": TARGET_VERSION, "universe_version": UNIVERSE_VERSION,
    "engine": MODEL_ENGINE,
    "generated_at": GEN_STAMP, "run_context": RUN_CONTEXT,
    "protocol": {
        "validation": "expanding-window walk-forward, quarterly refit (63d), "
                      "starting " + OOS_START,
        "purge": "per target: training label_end < validation_start (horizon + embargo)",
        "embargo_days": EMBARGO, "val_len_days": VAL_LEN,
        "early_stopping": f"{EARLY_STOPPING_ROUNDS} rounds on rolling validation window",
        "decision_convention": "daily EOD close (RESEARCH_PROTOCOL L21)",
        "tuning": "pre-registered parameters; no OOS tuning; staged validation tuning is future work",
    },
    "config": {"seed": SEED, "lgbm": LGBM_PARAMS, "oos_start": OOS_START},
    "panel": {"matrix_rows": int(len(matrix_base)),
              "matrix_dates": int(matrix_base["date"].nunique()),
              "serial_rule": ">=5 defined features per row (name warmup)"},
    "features": FEATURES,
    "targets": metrics,
    "input_stats": input_stats,
    "checks": checks,
}
write_json(F_REPORT, report)

run_manifest = {
    "artifact": "run_manifest_train", "version": "v001",
    "spec_version": SPEC_VERSION, "universe_version": UNIVERSE_VERSION,
    "feature_version": FEATURE_VERSION, "target_version": TARGET_VERSION,
    "model_version": MODEL_VERSION,
    "notebook": NOTEBOOK_NAME, "executed_at": GEN_STAMP, "run_context": RUN_CONTEXT,
    "engine": MODEL_ENGINE,
    "window": {"start": START, "end_inclusive": END_INCLUSIVE, "oos_start": OOS_START},
    "input": {"clean_prices": IN_CLEAN, "raw_prices": IN_RAW, "input_stats": input_stats},
    "parquet": PARQUET_HASHES,
    "checks": checks,
    "failures": errors,
    "artifacts": {"features_v003": F_FEATURES, "feature_meta_v003": F_FEATMETA,
                  "targets_v002": F_TARGETS, "training_report_v001": F_REPORT,
                  "predictions_v007": F_PRED},
}
write_json(RUN_PATH, run_manifest)

# bundle zip for the dashboard-wiring step (not auto-installed; the wiring is
# a separate reviewed change)
if os.path.exists(LOCAL_BUNDLE):
    shutil.rmtree(LOCAL_BUNDLE)
os.makedirs(LOCAL_BUNDLE, exist_ok=True)
for src_ in (F_FEATURES, F_FEATMETA, F_TARGETS, F_REPORT, F_PRED, RUN_PATH):
    shutil.copy(src_, os.path.join(LOCAL_BUNDLE, os.path.basename(src_)))
with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
    for fn in os.listdir(LOCAL_BUNDLE):
        z.write(os.path.join(LOCAL_BUNDLE, fn), fn)
# ---- post-write verification ----------------------------------------------
missing_artifacts = [p_ for p_ in
                     (F_FEATURES, F_FEATMETA, F_TARGETS, F_REPORT, F_PRED, RUN_PATH, ZIP_PATH)
                     if not os.path.exists(p_)]
if missing_artifacts:
    raise SystemExit(f"BUNDLE INCOMPLETE - missing {missing_artifacts}")

n_pass = sum(1 for c in checks if c["status"] == "PASS")
print(f"\nvalidation: {n_pass}/{len(checks)} PASS, {len(warnings_out)} warnings")
print("bundle written; download link below")
"""),
    md(r"""
## Cell 10 — Summary, bundle download

Writes the final summary (per-target IC / ICIR / hit / R² and fold count) and prints the
download link for `dashboard_training_bundle.zip`. The bundle is **not** installed into the
dashboard automatically: wiring `predictions_v007` / `training_report_v001` into
`models.json` and the ML portfolio surface is a separate reviewed change (Phase 9/10 work
owns the portfolio curve and net-of-cost statistics).
"""),
    code(r"""
# --- Cell 10: summary + download ------------------------------------------
summary = pd.DataFrame([
    {"target": t, "IC": metrics[t]["oos_ic_mean"], "ICIR": metrics[t]["icir"],
     "hit": metrics[t]["hit_rate"], "R2": metrics[t]["r2"],
     "n_oos": metrics[t]["n_oos_rows"], "folds": len(metrics[t]["folds"])}
    for t in TARGETS])
print(summary.to_string(index=False))

print("\nartifacts:")
for k_, v_ in run_manifest["artifacts"].items():
    print(f"  {k_:22s} {v_}")
print(f"  {'bundle_zip':22s} {ZIP_PATH}")
print(f"\nrun_context: {RUN_CONTEXT} | engine: {MODEL_ENGINE}")
print("Next: download the bundle; the dashboard-wiring change is reviewed separately.")

from google.colab import files
files.download(ZIP_PATH)
"""),
]


def build() -> dict:
    nb = {
        "nbformat": 4,
        "nbformat_minor": 0,
        "metadata": {
            "colab": {"provenance": [], "toc_visible": True},
            "kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
        },
        "cells": CELLS,
    }
    return nb


if __name__ == "__main__":
    nb = build()
    OUT.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
    n_md = sum(1 for c in CELLS if c["cell_type"] == "markdown")
    n_code = sum(1 for c in CELLS if c["cell_type"] == "code")
    print(f"wrote {OUT.name}: {len(CELLS)} cells ({n_md} md, {n_code} code)")
