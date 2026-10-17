#!/usr/bin/env python3
"""wire_training_results.py - install the Colab training bundle into the dashboard.

Deterministic transformer: reads the canonical training artifacts
(`artifacts/training_v001/`, Drive-canonical) and writes the dashboard data
surfaces:

  - `dashboard/src/data/models.json`   (synthetic: false; real OOS metrics)
  - `dashboard/src/data/manifest.json` (ML Lab ledger row -> REAL, delivered
                                        checklist marks, `training` provenance)

Design rules (AGENTS.md section 6/12; decisions D0018/D0020/D0030):
  - The bundle is verified BEFORE anything is written: run_context, engine,
    check statuses, parquet SHA-256 against the run manifest, and an
    independent recomputation of every wired metric straight from
    predictions_v007.parquet + targets_v002.parquet using the notebook's own
    conventions (rank-Pearson IC, >=5 names/date, per-family hit rate).
  - Nothing is invented. Every dashboard field maps 1:1 from
    training_report_v001.json, except three derived fields:
      (a) `ic_dates` - exact per-date IC dates (the report keeps only a count);
      (b) `hit_rate_base` - the trivial-model base rate per family, emitted so
          the UI never shows a bull-market sign rate as if it were skill;
      (c) fold numbers shifted 0-based -> 1-based for display only.
  - Re-runnable and idempotent; safe to run after every new training bundle.
  - NOT run by CI. CI only re-runs gen_demo_data.py, whose real-artifact guard
    leaves `synthetic: false` files untouched.

Usage:
    python3 dashboard/scripts/wire_training_results.py          # wire
    python3 dashboard/scripts/wire_training_results.py --check  # verify only

Requires pandas + pyarrow (control plane: /tmp/opencode/venv).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "artifacts" / "training_v001"
DATA = ROOT / "dashboard" / "src" / "data"
MIN_NAMES_PER_DATE = 5  # identical to the notebook's metrics engine
SURFACE_MODELS = "ML Lab - IC, ICIR, hit rate, folds, feature importance"
LEDGER_SOURCE = "models.json - Colab walk-forward run 2026-10-17 (24/24 checks)"
DECAY_HORIZONS = {"return_1d": 1, "return_5d": 5, "return_21d": 21}
PENDING_REAL_ARTIFACTS = [
    "universe_verification_v001.json (DELIVERED)",
    "fundamentals_v001.parquet (Phase 1)",
    "prices_v001.parquet (DELIVERED)",
    "features_v003.parquet (Phase 5, DELIVERED)",
    "predictions_v007.parquet (Phase 6, DELIVERED)",
    "covariance_v002.parquet (Phase 8)",
    "portfolio_weights_v004.parquet (Phase 9)",
    "backtest_v005.parquet (Phase 10)",
]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def spearman(a: pd.Series, b: pd.Series) -> float:
    """Spearman == Pearson on average ranks (notebook's rank-Pearson)."""
    ra, rb = a.rank(), b.rank()
    if ra.nunique() < 2 or rb.nunique() < 2:
        return float("nan")
    return float(ra.corr(rb))


def daily_ic(
    pred_t: pd.DataFrame, tgt: pd.DataFrame, tname: str
) -> tuple[pd.DataFrame, pd.DataFrame]:
    m = pred_t.merge(
        tgt[tgt["target_name"] == tname],
        left_on=["ticker", "prediction_date"],
        right_on=["ticker", "date"],
        how="inner",
    )
    rows = []
    for d_, g in m.groupby("prediction_date"):
        if len(g) >= MIN_NAMES_PER_DATE:
            c = spearman(g["prediction"], g["target_value"])
            if pd.notna(c):
                rows.append((d_, float(c)))
    return pd.DataFrame(rows, columns=["date", "ic"]), m


def near(a: float | None, b: float | None, atol: float) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(float(a) - float(b)) <= atol


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    args = ap.parse_args()

    print("wire_training_results - Colab training bundle -> dashboard")
    print(f"  bundle: {BUNDLE.relative_to(ROOT)}")

    # ---- bundle presence + run manifest ------------------------------------
    run_man = json.loads((BUNDLE / "run_manifest_train_v001.json").read_text())
    report = json.loads((BUNDLE / "training_report_v001.json").read_text())

    if run_man.get("run_context") != "colab_notebook":
        fail(
            f"run_context is {run_man.get('run_context')!r}, expected 'colab_notebook'"
        )
    if run_man.get("engine") != "lightgbm" or report.get("engine") != "lightgbm":
        fail("engine mismatch - this is not a real LightGBM run")
    if run_man.get("failures"):
        fail(f"run manifest records failures: {run_man['failures']}")
    checks = run_man.get("checks") or []
    n_pass = sum(1 for c in checks if c.get("status") == "PASS")
    if not checks or n_pass != len(checks) or len(checks) < 24:
        fail(f"check suite not green: {n_pass}/{len(checks)}")

    for fn, want in run_man.get("parquet", {}).items():
        got = sha256(BUNDLE / fn)
        if got != want:
            fail(f"sha256 mismatch for {fn}: got {got[:16]}..., want {want[:16]}...")
    print(
        f"  run context ok | engine=lightgbm | checks {n_pass}/{len(checks)} | sha256 verified"
    )

    # ---- load + independent metric recomputation ----------------------------
    pred = pd.read_parquet(BUNDLE / "predictions_v007.parquet")
    tgt = pd.read_parquet(BUNDLE / "targets_v002.parquet")
    pred["prediction_date"] = pd.to_datetime(pred["prediction_date"])
    tgt["date"] = pd.to_datetime(tgt["date"])

    targets_out: dict[str, dict] = {}
    n_folds_seen: set[int] = set()
    for tname, mrep in report["targets"].items():
        pp_t = pred[pred["target_name"] == tname]
        if pp_t.empty:
            fail(f"no predictions for {tname}")
        ics, mm = daily_ic(pp_t, tgt, tname)

        # -- recomputed vs reported (report rounds: IC 4dp, ICIR 3dp, R2 4dp,
        #    RMSE/MAE 6dp, quantiles 5dp, hit 4dp) ------------------------------
        got_ic = ics["ic"].to_numpy(float)
        rep_ic = np.asarray(mrep["ic_series"], float)
        if len(got_ic) != len(rep_ic):
            fail(f"{tname}: IC series length {len(got_ic)} != report {len(rep_ic)}")
        dmax = float(np.max(np.abs(np.round(got_ic, 4) - rep_ic)))
        if dmax > 5e-5:
            fail(f"{tname}: IC series mismatch (max |diff| {dmax:.2e})")

        ic_mean, ic_std = float(got_ic.mean()), float(got_ic.std(ddof=1))
        if not near(ic_mean, mrep["oos_ic_mean"], 5e-5):
            fail(f"{tname}: IC mean {ic_mean:.6f} != {mrep['oos_ic_mean']}")
        if not near(ic_std, mrep["oos_ic_std"], 5e-5):
            fail(f"{tname}: IC std {ic_std:.6f} != {mrep['oos_ic_std']}")
        if not near(ic_mean / ic_std, mrep["icir"], 5e-4):
            fail(f"{tname}: ICIR mismatch")

        if len(mm) != mrep["n_oos_rows"]:
            fail(f"{tname}: n_oos_rows {len(mm)} != {mrep['n_oos_rows']}")
        if str(mm["prediction_date"].min().date()) != mrep["oos_start"]:
            fail(f"{tname}: oos_start mismatch")
        if str(mm["prediction_date"].max().date()) != mrep["oos_end"]:
            fail(f"{tname}: oos_end mismatch")

        y = mm["target_value"].to_numpy(float)
        p = mm["prediction"].to_numpy(float)
        ss_res, ss_tot = float(((y - p) ** 2).sum()), float(((y - y.mean()) ** 2).sum())
        r2 = 1 - ss_res / ss_tot
        rmse = float(np.sqrt(((y - p) ** 2).mean()))
        mae = float(np.abs(y - p).mean())
        if not near(r2, mrep["r2"], 5e-5):
            fail(f"{tname}: R2 {r2:.6f} != {mrep['r2']}")
        if not near(rmse, mrep["rmse"], 6e-7):
            fail(f"{tname}: RMSE mismatch")
        if not near(mae, mrep["mae"], 6e-7):
            fail(f"{tname}: MAE mismatch")

        # hit rate + trivial-model base rate (same rows as the report)
        if mrep["objective"] == "binary":
            hit = float(((mm["prediction"] > 0.5) == (mm["target_value"] > 0.5)).mean())
            base = float((mm["target_value"] > 0.5).mean())
        elif tname.startswith("return"):
            hit = float(((mm["prediction"] > 0) == (mm["target_value"] > 0)).mean())
            base = float((mm["target_value"] > 0).mean())
        else:
            pos_pred = np.sign(mm["prediction"] - mm["prediction"].median())
            pos_true = np.sign(mm["target_value"] - mm["target_value"].median())
            hit = float((pos_pred == pos_true).mean())
            base = 0.5  # median split: a coin flip is the trivial model
        if not near(hit, mrep["hit_rate"], 5e-5):
            fail(f"{tname}: hit rate {hit:.6f} != {mrep['hit_rate']}")

        # quantile decile profile
        try:
            bins = pd.qcut(mm["prediction"], 10, labels=False, duplicates="drop")
            prof = [
                float(mm.loc[bins == b, "target_value"].mean())
                for b in sorted(set(bins.dropna()))
            ]
        except ValueError:
            prof = []
        if len(prof) != len(mrep["quantiles"]) or any(
            not near(a, b, 5e-6) for a, b in zip(prof, mrep["quantiles"])
        ):
            fail(f"{tname}: quantile profile mismatch")

        # annual IC breakdown
        yearly = {
            str(k): round(float(v), 4)
            for k, v in ics.groupby(ics["date"].dt.year.astype(str))["ic"]
            .mean()
            .items()
        }
        if yearly != mrep["annual_ic"]:
            fail(f"{tname}: annual IC mismatch: {yearly} != {mrep['annual_ic']}")

        # IC decay against 1/5/21d return labels
        decay_out = []
        for h_name, h_days in DECAY_HORIZONS.items():
            d_ics = daily_ic(pp_t, tgt, h_name)[0]
            d_mean = float(d_ics["ic"].mean()) if len(d_ics) else None
            if not near(d_mean, mrep["decay"].get(h_name), 5e-5):
                fail(
                    f"{tname}: decay[{h_name}] {d_mean} != {mrep['decay'].get(h_name)}"
                )
            decay_out.append({"horizon": h_days, "ic": mrep["decay"][h_name]})

        n_folds = len(mrep["folds"])
        n_folds_seen.add(n_folds)
        if not near(mrep["ic_dates"], len(got_ic), 0):
            fail(f"{tname}: ic_dates count mismatch")

        targets_out[tname] = {
            "target": tname,
            "label": mrep["label"],
            "objective": mrep["objective"],
            "horizon_days": mrep["horizon_days"],
            "model_version": mrep["model_version"],
            "oos_ic_mean": mrep["oos_ic_mean"],
            "oos_ic_std": mrep["oos_ic_std"],
            "icir": mrep["icir"],
            "hit_rate": mrep["hit_rate"],
            "hit_rate_convention": mrep["hit_rate_convention"],
            "hit_rate_base": round(base, 4),
            "r2": mrep["r2"],
            "rmse": mrep["rmse"],
            "mae": mrep["mae"],
            "n_oos_rows": mrep["n_oos_rows"],
            "oos_start": mrep["oos_start"],
            "oos_end": mrep["oos_end"],
            "folds": [{**f, "fold": f["fold"] + 1} for f in mrep["folds"]],
            "ic_dates": [str(d.date()) for d in ics["date"]],
            "ic_series": mrep["ic_series"],
            "annual_ic": mrep["annual_ic"],
            "decay": decay_out,
            "quantiles": {
                "labels": [f"D{i + 1}" for i in range(len(mrep["quantiles"]))],
                "mean_forward_return": mrep["quantiles"],
            },
            "feature_importance": {
                f["feature"]: f["gain"] for f in mrep["feature_importance"]
            },
            "hyperparameters": mrep["hyperparameters"],
        }
        print(
            f"  {tname:14s} IC {mrep['oos_ic_mean']:+.4f}  ICIR {mrep['icir']:+.3f}  "
            f"hit {mrep['hit_rate']:.3f} (base {base:.3f})  R2 {mrep['r2']:+.4f}  "
            f"dates {len(got_ic):5d}  folds {n_folds}"
        )

    if len(n_folds_seen) != 1:
        fail(f"inconsistent fold counts: {sorted(n_folds_seen)}")

    models_doc = {
        "synthetic": False,
        "disclaimer": (
            "REAL out-of-sample model metrics. Source: NasdaqAIQuant training run via "
            "nasdaq_ai_quant_train_v001.ipynb (Colab, "
            f"{run_man['executed_at']}; {n_pass}/{len(checks)} contract checks; "
            "parquet SHA-256 verified against run_manifest_train_v001.json)."
        ),
        "model_version": report["model_version"],
        "engine": run_man["engine"],
        "run_context": run_man["run_context"],
        "executed_at": run_man["executed_at"],
        "checks": {"passed": n_pass, "total": len(checks)},
        "sources": {
            "notebook": run_man["notebook"],
            "report": "training_report_v001.json",
            "predictions": "predictions_v007.parquet",
            "targets": "targets_v002.parquet",
            "features": "features_v003.parquet",
            "run_manifest": "run_manifest_train_v001.json",
        },
        "feature_version": report["feature_version"],
        "target_version": report["target_version"],
        "universe_version": report["universe_version"],
        "protocol": {
            "oos_start": run_man["window"]["oos_start"],
            "folds": next(iter(n_folds_seen)),
            "test_window_days": 63,
            "validation_window_days": 126,
            "purge": "label horizon h on both split boundaries",
            "embargo_days": 5,
        },
        "validation": (
            "Expanding-window walk-forward, purged + embargoed; rolling validation window "
            "for early stopping; the OOS test folds were never touched by tuning. "
            "ICIR is the unannualised mean/std of the daily cross-sectional IC series. "
            "Hit-rate conventions differ by family (see hit_rate_convention)."
        ),
        "targets": targets_out,
    }

    manifest = json.loads((DATA / "manifest.json").read_text())
    row = next(
        (r for r in manifest["real_vs_synthetic"] if r["surface"] == SURFACE_MODELS),
        None,
    )
    if row is None:
        fail(f"ledger row not found: {SURFACE_MODELS!r}")
    row["status"] = "REAL"
    row["source"] = LEDGER_SOURCE
    manifest["pending_real_artifacts"] = PENDING_REAL_ARTIFACTS
    training_block = {
        "notebook": run_man["notebook"],
        "executed_at": run_man["executed_at"],
        "run_context": run_man["run_context"],
        "engine": run_man["engine"],
        "checks": f"{n_pass}/{len(checks)}",
        "artifacts": [
            "features_v003.parquet",
            "targets_v002.parquet",
            "predictions_v007.parquet",
            "training_report_v001.json",
        ],
    }
    ordered: dict = {}
    for k, v in manifest.items():
        ordered[k] = v
        if k == "acquisition":
            ordered["training"] = training_block
    if "training" not in ordered:
        ordered["training"] = training_block
    manifest = ordered

    n_real = sum(
        1 for r in manifest["real_vs_synthetic"] if r["status"].startswith("REAL")
    )
    print(
        f"  ledger: ML Lab row -> REAL | {n_real}/{len(manifest['real_vs_synthetic'])} surfaces real"
    )

    if args.check:
        print("CHECK-ONLY: bundle verified; nothing written.")
        return

    (DATA / "models.json").write_text(
        json.dumps(models_doc, separators=(",", ":"), allow_nan=False)
    )
    (DATA / "manifest.json").write_text(
        json.dumps(manifest, separators=(",", ":"), allow_nan=False)
    )
    print(
        f"  wrote models.json ({(DATA / 'models.json').stat().st_size / 1024:.1f} KB)"
    )
    print(
        f"  wrote manifest.json ({(DATA / 'manifest.json').stat().st_size / 1024:.1f} KB)"
    )


if __name__ == "__main__":
    main()
