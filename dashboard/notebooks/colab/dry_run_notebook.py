#!/usr/bin/env python3
"""
dry_run_notebook.py — local end-to-end rehearsal of the acquisition notebook.

Why: the notebook must run unattended in Colab; every bug found here is a bug
the user does not discover in a browser session. This harness

  1. reads nasdaq_ai_quant_acquire_v002.ipynb,
  2. neutralises Colab-only calls (!pip, drive.mount, files.download) and
     redirects /content paths to a scratch directory,
  3. replaces the three network fetchers with deterministic synthetic frames
     (including a CRWV listing gap and two corporate actions),
  4. executes every code cell in order, and
  5. audits the emitted bundle against the contracts the dashboard relies on,
     including canonical-ledger parity with gen_demo_data.py.

It does NOT prove the notebook can reach Yahoo — only a real Colab run does
that. It DOES prove: the processing chain, schemas, provenance ledger, VaR
convention, Ledoit-Wolf path, stress computation, bundle layout and cross-file
consistency all work on the real code paths, offline.

Usage:
    /tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py
    /tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py --live
    /tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py --from-parquet

Default (dry-run) mode uses stubbed fetchers. `--live` keeps the REAL network
fetchers. `--from-parquet` rebuilds the frames from the SAVED frozen acquisition
(artifacts/acquisition_v001/prices_v001.parquet + corporate_actions_v001.parquet)
so corrected analytics are recomputed without re-fetching against Yahoo (whose
adjusted history shifts as new dividends accrue). Both real modes audit the
bundle and install it into dashboard/src/data (Parquet is copied to
artifacts/acquisition_v001/, ready for Drive upload). Colab-only calls
(drive.mount, files.download, !pip) are always neutralised and /content paths
are always redirected to a scratch directory.

Exit code 0 = every check passed.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import re
import shutil
import sys
import traceback
import zlib
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
NOTEBOOK = HERE / "nasdaq_ai_quant_acquire_v002.ipynb"
GEN_DEMO = REPO_ROOT / "dashboard" / "scripts" / "gen_demo_data.py"
FIXTURE_DATA = REPO_ROOT / "dashboard" / "src" / "data"
MODE = (
    "reprocess"
    if "--from-parquet" in sys.argv
    else "live"
    if "--live" in sys.argv
    else "dry"
)
LIVE = MODE == "live"  # kept for the existing checks that key on it
REPROCESS = MODE == "reprocess"
SCRATCH = Path(
    os.environ.get(
        {"live": "LIVE_RUN_DIR", "reprocess": "REPROCESS_RUN_DIR"}.get(
            MODE, "DRY_RUN_DIR"
        ),
        {
            "live": "/tmp/opencode/live_run",
            "reprocess": "/tmp/opencode/reprocess_run",
        }.get(MODE, "/tmp/opencode/dryrun"),
    )
)
# Where Parquet artifacts are copied for the manual Drive upload (real modes).
PARQUET_OUT = REPO_ROOT / "artifacts" / "acquisition_v001"
# Saved frozen acquisition used by --from-parquet reprocessing.
RAW_PARQUET = PARQUET_OUT / "prices_v001.parquet"
ACTIONS_PARQUET = PARQUET_OUT / "corporate_actions_v001.parquet"

FAILURES: list[str] = []
_checks = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global _checks
    _checks += 1
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}{('  ' + detail) if detail else ''}")
    if not ok:
        FAILURES.append(f"{name}: {detail}")


# ---------------------------------------------------------------------------
# Deterministic synthetic market data standing in for the network fetchers
# ---------------------------------------------------------------------------

STUB_ACTIONS: dict[str, list[dict]] = {
    "NVDA": [
        {
            "type": "split",
            "date": "2021-07-20",
            "numerator": 4.0,
            "denominator": 1.0,
            "ratio": "4:1",
        }
    ],
    "MSFT": [{"type": "dividend", "date": "2024-06-13", "amount": 0.75}],
    "SOXX": [{"type": "dividend", "date": "2023-09-18", "amount": 0.42}],
    # Fallback-sourced tickers: these arrive via the yfinance stub, which now
    # mirrors the live capture of the actions table.
    "MU": [{"type": "dividend", "date": "2023-10-06", "amount": 0.13}],
    "QCOM": [{"type": "dividend", "date": "2024-05-30", "amount": 0.85}],
}

LISTING_LAG = {"PLTR": "2020-09-30", "CRWV": "2025-03-21"}

# Tickers rehearsed through the chart-429 -> yfinance fallback path, with
# frames carrying the REAL yfinance index shape (tz-aware America/New_York
# midnights -> 04:00/05:00 UTC after normalise's tz conversion). This is the
# exact shape that silently blanked every column before the `normalise()` fix;
# keep them in the stub so the regression can never come back unnoticed.
YF_FALLBACK_STUBS = {"MU", "QCOM"}


def build_stub_frames(
    universe: list[str], benchmarks: list[str], start: str, end_incl: str
) -> dict[str, pd.DataFrame]:
    bdays = pd.bdate_range(start, end_incl)
    frames: dict[str, pd.DataFrame] = {}
    for tk in universe + benchmarks:
        seed = zlib.crc32(tk.encode()) % (2**32 - 1)
        rng = np.random.default_rng(seed)
        idx = bdays
        if tk in LISTING_LAG:
            idx = bdays[bdays >= LISTING_LAG[tk]]
        n = len(idx)
        big = tk in ("NVDA", "AMD", "MU", "MRVL", "CRWV", "SOXX")
        drift = 0.0006 if big else 0.00035
        vol = 0.021 if big else 0.0135
        loglev = np.log(100.0) + np.cumsum(rng.normal(drift, vol, n))
        close = np.exp(loglev)
        spread = np.abs(rng.normal(0, vol / 2, n)) + 0.002
        open_ = close * (1 + rng.normal(0, vol / 4, n))
        high = np.maximum(open_, close) * (1 + spread)
        low = np.minimum(open_, close) * (1 - spread)
        volume = rng.integers(1_000_000, 60_000_000, n).astype(float)
        df = pd.DataFrame(
            {
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "adj_close": close,
                "volume": volume,
            },
            index=pd.Index(idx, name="date"),
        )
        frames[tk] = df
    return frames


def install_stub_fetchers(ns: dict) -> None:
    frames = build_stub_frames(
        ns["UNIVERSE"], ns["BENCHMARKS"], ns["START"], ns["END_INCLUSIVE"]
    )

    def stub_chart(ticker, tries=3):
        if ticker in YF_FALLBACK_STUBS:
            # Forced 429 exhaustion: hands off to the yfinance stub below.
            return None, "dry_run_stub:forced-429"
        ns["ACTIONS"][ticker] = [dict(e) for e in STUB_ACTIONS.get(ticker, [])]
        return frames[ticker].copy(), "dry_run_stub:attempt1"

    def stub_yf(ticker, tries=2):
        if ticker in YF_FALLBACK_STUBS:
            # Mirror the live capture of the yfinance actions table.
            ns["ACTIONS"][ticker] = [dict(e) for e in STUB_ACTIONS.get(ticker, [])]
            # Real yfinance returns a tz-aware America/New_York index at
            # midnight; the tz -> UTC conversion then yields 04:00/05:00
            # stamps. This shape is what regressed normalise().
            return frames[ticker].tz_localize("America/New_York"), "dry_run_stub:yf"
        return None, "dry_run_stub:not-called"

    def stub_stooq(ticker, tries=2):
        return None, "dry_run_stub:not-called"

    ns["fetch_chart_api"] = stub_chart
    ns["fetch_yfinance"] = stub_yf
    ns["fetch_stooq"] = stub_stooq
    ns["__stub_frames__"] = frames


def install_reprocess_fetchers(ns: dict) -> None:
    """--from-parquet mode: rebuild frames from the SAVED frozen acquisition.

    The acquisition layer was already validated by the live run; this mode
    recomputes every derived artifact on that exact frozen input (no network,
    and no data drift from Yahoo re-adjusting history for later dividends).
    Sources report the original `yfinance` provenance; the run context in the
    manifests records the reprocessing explicitly.
    """
    if not RAW_PARQUET.exists() or not ACTIONS_PARQUET.exists():
        raise SystemExit(f"reprocess input missing: {RAW_PARQUET} / {ACTIONS_PARQUET}")
    raw = pd.read_parquet(RAW_PARQUET)
    frames: dict[str, pd.DataFrame] = {}
    for tk in ns["UNIVERSE"] + ns["BENCHMARKS"]:
        df = (
            raw[raw["ticker"] == tk]
            .drop(columns=["ticker", "universe_version", "data_version"])
            .sort_index()
        )
        if df.empty:
            raise SystemExit(f"reprocess: no saved rows for {tk}")
        frames[tk] = df

    actions: dict[str, list[dict]] = {}
    act = pd.read_parquet(ACTIONS_PARQUET)
    for tk, grp in act.groupby("ticker"):
        evs: list[dict] = []
        for _, row in grp.iterrows():
            dv = row["date"]
            date_iso = dv.date().isoformat() if hasattr(dv, "date") else str(dv)
            e: dict = {"type": str(row["type"]), "date": date_iso}
            for col in ("amount", "numerator", "denominator"):
                if pd.notna(row[col]):
                    e[col] = float(row[col])
            if pd.notna(row["ratio"]):
                e["ratio"] = str(row["ratio"])
            evs.append(e)
        actions[tk] = evs

    def stub_chart(ticker, tries=3):
        return None, "reprocess:chart-skipped"

    def stub_yf(ticker, tries=2):
        ns["ACTIONS"][ticker] = [dict(e) for e in actions.get(ticker, [])]
        return frames[ticker].copy(), "reprocess:saved"

    def stub_stooq(ticker, tries=2):
        return None, "reprocess:not-called"

    ns["fetch_chart_api"] = stub_chart
    ns["fetch_yfinance"] = stub_yf
    ns["fetch_stooq"] = stub_stooq
    ns["__stub_frames__"] = frames


# ---------------------------------------------------------------------------
# Notebook loading + execution
# ---------------------------------------------------------------------------


def transform(src: str) -> str:
    src = src.replace(
        "from google.colab import drive\ndrive.mount('/content/drive')",
        "print('[dry-run] google.colab.drive.mount skipped')",
    )
    src = src.replace("from google.colab import files\n", "")
    src = src.replace(
        "files.download(zip_path)",
        "print('[dry-run] files.download skipped:', zip_path)",
    )
    lines = [
        ln for ln in src.splitlines(keepends=True) if not ln.lstrip().startswith("!pip")
    ]
    src = "".join(lines)
    src = src.replace("/content/drive/MyDrive", str(SCRATCH / "drive"))
    src = src.replace("/content/dashboard_data", str(SCRATCH / "dashboard_data"))
    src = src.replace(
        "/content/nasdaq_ai_quant_data", str(SCRATCH / "nasdaq_ai_quant_data")
    )
    return src


def exec_cell(ns: dict, src: str, label: str) -> None:
    try:
        exec(compile(src, f"<{label}>", "exec"), ns)
    except SystemExit as e:
        raise SystemExit(f"{label} raised SystemExit: {e}") from None
    except Exception:
        print(f"\n!! {label} FAILED\n")
        traceback.print_exc()
        raise


def run_notebook() -> dict:
    nb = json.loads(NOTEBOOK.read_text())
    code_cells = [c for c in nb["cells"] if c["cell_type"] == "code"]
    print(f"notebook: {NOTEBOOK.name}  code cells: {len(code_cells)}")
    print(f"scratch : {SCRATCH}\n")

    if SCRATCH.exists():
        shutil.rmtree(SCRATCH)
    (SCRATCH / "drive").mkdir(parents=True)

    if MODE == "dry":
        # Fake yfinance (network module) before Cell 1 imports it.
        import types

        fake_yf = types.ModuleType("yfinance")
        fake_yf.__version__ = "dry-run-stub"
        fake_yf.Ticker = lambda *a, **k: None
        sys.modules["yfinance"] = fake_yf

    os.environ["NQ_RUN_CONTEXT"] = {
        "dry": "dry_run (stub data)",
        "live": "local_live (dry_run_notebook.py --live, real network)",
        "reprocess": (
            "local_reprocess (from saved prices_v001.parquet; frozen "
            "acquisition 2026-10-16)"
        ),
    }[MODE]

    ns: dict = {"__name__": f"__{MODE}_run__"}
    for i, c in enumerate(code_cells):
        src = transform("".join(c["source"]))
        if "def fetch_chart_api" in src and MODE in ("dry", "reprocess"):
            marker = 'report = {"tickers": {}, "failures": [], "sources": {}}'
            head, tail = src.split(marker, 1)
            exec_cell(ns, head, f"cell{i}-fetchers")
            if REPROCESS:
                install_reprocess_fetchers(ns)
            else:
                install_stub_fetchers(ns)
            exec_cell(ns, marker + tail, f"cell{i}-acquisition")
        else:
            exec_cell(ns, src, f"cell{i}")
    return ns


# ---------------------------------------------------------------------------
# Bundle audit
# ---------------------------------------------------------------------------


def sha256_file(p: Path) -> str:
    import hashlib

    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_gen_demo():
    spec = importlib.util.spec_from_file_location("gen_demo_data_audit", GEN_DEMO)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def audit(ns: dict) -> None:
    dash = Path(ns["DASH_PATH"])
    local = Path(ns["LOCAL_DATA"])
    run = json.loads(
        (dash.parent / "runs" / f"run_manifest_{ns['DATA_VERSION']}.json").read_text()
    )

    print("\n--- artifact presence -------------------------------------------")
    for fn in (
        "market.json",
        "risk.json",
        "backtest.json",
        "fundamentals.json",
        "manifest.json",
    ):
        check(f"emitted {fn}", (dash / fn).exists())
    for fn in (
        "market.json",
        "risk.json",
        "backtest.json",
        "fundamentals.json",
        "manifest.json",
        "run_manifest.json",
    ):
        check(f"bundled {fn}", (local / fn).exists())
    zip_path = Path(str(SCRATCH / "nasdaq_ai_quant_data.zip"))
    check(
        "bundle zip created",
        zip_path.exists(),
        f"{zip_path.stat().st_size / 1024:.0f} KB" if zip_path.exists() else "",
    )

    market = json.loads((dash / "market.json").read_text())
    risk = json.loads((dash / "risk.json").read_text())
    back = json.loads((dash / "backtest.json").read_text())
    fund = json.loads((dash / "fundamentals.json").read_text())
    man = json.loads((dash / "manifest.json").read_text())

    print("\n--- provenance flags --------------------------------------------")
    check("market real", market["synthetic"] is False)
    check("risk real", risk["synthetic"] is False)
    check("backtest real", back["synthetic"] is False)
    check("fundamentals real", fund["synthetic"] is False)
    check("manifest not synthetic", man["synthetic"] is False)
    check(
        "acquisition block present",
        isinstance(man.get("acquisition"), dict),
        str(
            {
                k: man["acquisition"][k]
                for k in ("notebook", "validation", "trading_days")
            }
            if man.get("acquisition")
            else {}
        ),
    )
    check(
        "acquisition notebook is v002",
        man.get("acquisition", {}).get("notebook", "").endswith("v002.ipynb"),
    )

    print("\n--- canonical ledger parity -------------------------------------")
    gdd = load_gen_demo()
    emitted = [r["surface"] for r in man["real_vs_synthetic"]]
    check("ledger has 12 rows", len(emitted) == 12, f"{len(emitted)}")
    check(
        "ledger surfaces identical to gen_demo_data.py (order-insensitive)",
        set(emitted) == set(gdd.LEDGER_ORDER),
        ""
        if set(emitted) == set(gdd.LEDGER_ORDER)
        else f"emitted-only={set(emitted) - set(gdd.LEDGER_ORDER)} gen-only={set(gdd.LEDGER_ORDER) - set(emitted)}",
    )
    check("ledger order matches canonical order", emitted == gdd.LEDGER_ORDER)
    statuses = [r["status"] for r in man["real_vs_synthetic"]]
    check(
        "statuses use REAL/SYNTHETIC/PENDING vocabulary",
        all(s.startswith(("REAL", "SYNTHETIC", "PENDING")) for s in statuses),
        str(sorted({s.split(" ")[0] for s in statuses})),
    )
    check(
        "running with fixtures keeps portfolio/ML-curve rows synthetic",
        all(
            man["real_vs_synthetic"][i]["status"].startswith("SYNTHETIC")
            for i in (6, 10)
        ),
    )
    check(
        "ML Lab row is REAL (wired from the Phase 5/6 training run)",
        man["real_vs_synthetic"][5]["status"].startswith("REAL"),
    )

    print("\n--- risk numerics ------------------------------------------------")
    pf = risk["portfolio"]
    check(
        "VaR95 positive loss magnitude", pf["var_95_daily"] > 0, f"{pf['var_95_daily']}"
    )
    check(
        "VaR99 positive loss magnitude", pf["var_99_daily"] > 0, f"{pf['var_99_daily']}"
    )
    check("VaR99 >= VaR95", pf["var_99_daily"] >= pf["var_95_daily"])
    check("ES95 >= VaR95", pf["es_95_daily"] >= pf["var_95_daily"])
    check("ES99 >= ES95", pf["es_99_daily"] >= pf["es_95_daily"])
    cov = risk["covariance"]
    check(
        "LW shrinkage in (0, 1)",
        0 < cov["shrinkage_intensity"] < 1,
        f"{cov['shrinkage_intensity']}",
    )
    check(
        "LW was actually fitted (obs recorded)",
        cov["observations"] > 250,
        f"{cov['observations']} obs",
    )
    check(
        "shrunk condition number <= raw",
        cov["condition_number_shrunk"] <= cov["condition_number_raw"] * 1.01,
        f"{cov['condition_number_raw']:.0f} -> {cov['condition_number_shrunk']:.0f}",
    )
    check(
        "portfolio basis is the EW reference book",
        risk["portfolio_basis"] == "equal_weight_placeholder",
    )
    check(
        "reference_weights sum to ~1",
        abs(sum(risk["reference_weights"].values()) - 1.0) < 1e-6,
    )
    check(
        "correlation matrix is 20x20",
        len(risk["correlation"]) == 20
        and all(len(r) == 20 for r in risk["correlation"]),
    )
    check("per_ticker covers all 20 names", len(risk["per_ticker"]) == 20)

    print("\n--- stress scenarios ---------------------------------------------")
    stress = risk["stress"]
    check("four stress rows", len(stress) == 4)
    for s in stress[:3]:
        check(
            f"stress computed: {s['name']}",
            s["shock"] is not None and s["shock"] < 0,
            f"{s['shock']}  {s['basis'][:70]}",
        )
        check(
            f"stress labelled realised: {s['name']}",
            s["basis"].startswith("Realised") and "realised" in s["name"],
        )
    check(
        "hypothetical row explicitly labelled",
        "Hypothetical" in stress[3]["basis"] and "NOT a realised" in stress[3]["basis"],
    )

    print("\n--- market schema -------------------------------------------------")
    n_dates = len(market["dates"])
    check("trading days recorded", 1550 <= n_dates <= 1800, f"{n_dates}")
    check(
        "manifest trading_days matches", man["acquisition"]["trading_days"] == n_dates
    )
    for tk, si in market["start_idx"].items():
        lv = market["levels"][tk]
        check(
            f"{tk}: levels length == dates - start_idx",
            len(lv) == n_dates - si,
            f"len={len(lv)} start_idx={si}",
        )
    check("PLTR truncated (start_idx > 0)", market["start_idx"]["PLTR"] > 0)
    check("CRWV truncated (start_idx > 0)", market["start_idx"]["CRWV"] > 0)
    check("benchmarks present", set(market["benchmarks"]) == {"QQQ", "SOXX", "SPY"})

    print("\n--- fundamentals --------------------------------------------------")
    check(
        "fundamental_factors_pending is True",
        fund["fundamental_factors_pending"] is True,
    )
    check("20 constituent rows", len(fund["constituents"]) == 20)
    comp = {c["ticker"]: c["company"] for c in fund["constituents"]}
    check(
        "company names embedded from verification artifact",
        comp.get("NVDA") == "NVIDIA Corporation",
        f"NVDA={comp.get('NVDA')!r} CRWV={comp.get('CRWV')!r}",
    )
    check("factor_defs = 4 market-derived factors", len(fund["factor_defs"]) == 4)
    check(
        "every row has 4 factor contributions",
        all(len(c.get("factor_contributions", {})) == 4 for c in fund["constituents"]),
    )
    # Direction regressions for the signed-rank composite (fixed 2026-10-16:
    # the old zrank inverted momentum, drawdown and diversification).
    cols = fund["constituents"]
    mom_hi = max(cols, key=lambda c: c["momentum_12_1"])
    check(
        "momentum: highest 12-1 gets a positive contribution",
        mom_hi["factor_contributions"]["momentum"] > 0,
        f"{mom_hi['ticker']} {mom_hi['factor_contributions']['momentum']}",
    )
    vol_hi = max(cols, key=lambda c: c["vol_3m"])
    check(
        "volatility: highest vol gets a negative contribution",
        vol_hi["factor_contributions"]["volatility"] < 0,
        f"{vol_hi['ticker']} {vol_hi['factor_contributions']['volatility']}",
    )
    dd_lo = min(cols, key=lambda c: c["drawdown_52w"])
    check(
        "drawdown: deepest drawdown gets a negative contribution",
        dd_lo["factor_contributions"]["drawdown"] < 0,
        f"{dd_lo['ticker']} {dd_lo['factor_contributions']['drawdown']}",
    )
    corr_lo = min(cols, key=lambda c: c["avg_corr"])
    check(
        "diversification: lowest avg corr gets a positive contribution",
        corr_lo["factor_contributions"]["diversification"] > 0,
        f"{corr_lo['ticker']} {corr_lo['factor_contributions']['diversification']}",
    )
    check(
        "composite = sum of contributions",
        all(
            abs(c["composite_score"] - sum(c["factor_contributions"].values())) < 1e-9
            for c in cols
        ),
    )

    print("\n--- backtest ------------------------------------------------------")
    series = back["series"]
    check(
        "5 series keys",
        set(series) == {"ML_PORTFOLIO", "EW_UNIVERSE", "QQQ", "SOXX", "SPY"},
        str(sorted(series)),
    )
    check(
        "all series same length",
        len({len(v) for v in series.values()}) == 1,
        str(sorted({len(v) for v in series.values()})),
    )
    check("performance covers all series", set(back["performance"]) == set(series))
    check(
        "ML curve flagged synthetic",
        back["series_provenance"]["ML_PORTFOLIO"] == "synthetic",
    )
    check(
        "EW + benchmarks flagged real",
        all(
            back["series_provenance"][k] == "real"
            for k in ("EW_UNIVERSE", "QQQ", "SOXX", "SPY")
        ),
    )
    check(
        "attribution r2 in [0, 1]",
        0.0 <= back["attribution"]["r_squared"] <= 1.0,
        f"r2={back['attribution']['r_squared']}",
    )
    # Formula regressions (fixed 2026-10-16): Sharpe is annualised mean / vol
    # (rf 0), and worst_30d is a 30-trading-day cumulative return - not a
    # rolling mean of daily returns, which understated the worst month ~15x.
    # Second fix (2026-10-16 QA pass 2): the performance block must be
    # computed on the OUT-OF-SAMPLE slice only, matching every dashboard
    # label that consumes it. Recompute from the same slice here.
    oos_i = market["dates"].index(back["oos_start"])
    for k, arr in series.items():
        r = np.diff(np.log(np.asarray(arr, float)[oos_i:]))
        mu = float(np.mean(r) * 252)
        vol = float(np.std(r, ddof=1) * math.sqrt(252))
        exp_sh = round(mu / vol, 3) if vol > 0 else 0.0
        p = back["performance"][k]
        check(
            f"{k}: sharpe == annualised mean / vol",
            abs(p["sharpe"] - exp_sh) < 1e-9,
            f"{p['sharpe']} vs {exp_sh}",
        )
        w30 = (
            np.convolve(r, np.ones(30), mode="valid")
            if len(r) >= 30
            else np.array([r.sum()])
        )
        check(
            f"{k}: worst_30d == min 30-day cumulative return",
            abs(p["worst_30d"] - float(np.expm1(w30.min()))) < 5e-4,
            f"{p['worst_30d']}",
        )
    check(
        "yearly rows present", len(back["yearly"]) >= 6, f"{len(back['yearly'])} years"
    )

    print("\n--- clean panel parquet ------------------------------------------")
    cp = Path(ns["CLEAN_PATH"])
    check("clean parquet exists", cp.exists(), str(cp))
    panel = pd.read_parquet(cp)
    check(
        "panel has is_tradable / is_valid flags",
        {"is_tradable", "is_valid"} <= set(panel.columns),
    )
    check(
        "panel covers 20 names x full calendar",
        panel["ticker"].nunique() == 20 and len(panel) == 20 * n_dates,
        f"{panel['ticker'].nunique()} names x {n_dates} dates = {len(panel)} rows",
    )
    crwv_pre = panel[(panel["ticker"] == "CRWV") & (panel["date"] < "2025-03-21")]
    check(
        "CRWV pre-listing rows flagged not tradable",
        len(crwv_pre) > 0 and not crwv_pre["is_tradable"].any(),
    )
    check(
        "is_valid implies is_tradable",
        bool((panel["is_valid"] & ~panel["is_tradable"]).sum() == 0),
    )
    check(
        "tradable rows are valid (no unflagged nulls)",
        bool(panel.loc[panel["is_tradable"], "is_valid"].all()),
    )

    print("\n--- run manifest --------------------------------------------------")
    check("parquet checksums recorded", len(run["parquet"]) == 3)
    for fn, h in run["files"].items():
        check(f"sha256 matches for {fn}", sha256_file(dash / fn) == h)
    check(
        "corporate actions captured",
        run["corporate_actions"]["events"] >= 2,
        str(run["corporate_actions"]["per_ticker"]),
    )
    check(
        "validation PASS",
        run["validation"]["status"] == "PASS",
        f"{len(run['validation']['checks'])} checks",
    )
    check("no acquisition failures", run["failures"] == [])
    check(
        "run context recorded",
        isinstance(run.get("run_context"), str) and bool(run["run_context"]),
        str(run.get("run_context", "")),
    )

    if MODE == "dry":
        print("\n--- fallback shape regression (tz-aware frames) -----------------")
        for tk in sorted(YF_FALLBACK_STUBS):
            t = ns["report"]["tickers"].get(tk, {})
            check(
                f"{tk}: acquired via yfinance fallback",
                t.get("status") == "OK" and t.get("source") == "yfinance",
                f"status={t.get('status')} source={t.get('source')}",
            )
            rows = ns["frames"].get(tk)
            check(
                f"{tk}: tz-aware frame survived normalise()",
                rows is not None and len(rows) > 1000,
                f"{0 if rows is None else len(rows)} rows",
            )

    print("\n--- fixture parity check (dashboard data dir) ---------------------")
    if FIXTURE_DATA.exists():
        for fn in ("market.json", "risk.json", "backtest.json", "fundamentals.json"):
            fixture = json.loads((FIXTURE_DATA / fn).read_text())
            emitted_obj = {
                "market.json": market,
                "risk.json": risk,
                "backtest.json": back,
                "fundamentals.json": fund,
            }[fn]
            # `generator`/`seed` are fixture-only provenance markers; real
            # artifacts carry `synthetic: false` + manifest.acquisition instead.
            missing = set(fixture) - set(emitted_obj) - {"generator", "seed"}
            check(
                f"{fn}: emitted covers fixture top-level keys",
                not missing,
                f"missing={sorted(missing)}" if missing else "",
            )

    print("\n--- cross-file consistency ----------------------------------------")
    check("risk as_of is last market date", risk["as_of"] == market["dates"][-1])
    check(
        "fundamentals as_of is last market date", fund["as_of"] == market["dates"][-1]
    )
    check(
        "oos window inside research window",
        market["dates"][0]
        <= back["oos_start"]
        <= back["oos_end"]
        == market["dates"][-1],
    )


def install_bundle(ns: dict) -> None:
    """Real modes (--live / --from-parquet): install the audited bundle into
    dashboard/src/data and copy the Parquet artifacts to a stable local folder
    for the Drive upload."""
    local = Path(ns["LOCAL_DATA"])
    FIXTURE_DATA.mkdir(parents=True, exist_ok=True)
    copied = []
    for fn in (
        "market.json",
        "risk.json",
        "backtest.json",
        "fundamentals.json",
        "manifest.json",
        "run_manifest.json",
        "universe.json",
    ):
        src = local / fn
        if src.exists():
            shutil.copy2(src, FIXTURE_DATA / fn)
            copied.append(fn)
    print(f"\ndashboard/src/data <- {', '.join(copied)}")

    PARQUET_OUT.mkdir(parents=True, exist_ok=True)
    for key in ("RAW_PATH", "CLEAN_PATH", "ACTIONS_PATH"):
        p_ = Path(ns[key])
        if p_.exists():
            shutil.copy2(p_, PARQUET_OUT / p_.name)
    print("Parquet artifacts (upload to Drive, see paths below):")
    print(f"  local : {PARQUET_OUT}/")
    for key in ("RAW_PATH", "CLEAN_PATH", "ACTIONS_PATH"):
        p_ = Path(ns[key])
        rel = p_.relative_to(SCRATCH / "drive")
        print(f"  Drive : MyDrive/{rel.parent}/  <- {p_.name}")


def main() -> int:
    print("=" * 72)
    print(
        {
            "live": "LIVE acquisition — real fetchers, real network",
            "reprocess": (
                "REPROCESS — rebuilding from the saved frozen acquisition "
                f"({RAW_PARQUET.name}; no network)"
            ),
            "dry": "dry-run rehearsal — synthetic fetchers, real processing code",
        }[MODE]
    )
    print("=" * 72)
    ns = run_notebook()
    print("\n" + "=" * 72)
    print("auditing the emitted bundle")
    print("=" * 72)
    audit(ns)
    label = {"live": "LIVE RUN", "reprocess": "REPROCESS RUN", "dry": "DRY RUN"}[MODE]
    print("\n" + "=" * 72)
    if FAILURES:
        print(f"{label} FAILED — {len(FAILURES)} of {_checks} checks failed:")
        for f in FAILURES:
            print("  -", f)
        return 1
    print(f"{label} PASSED — {_checks}/{_checks} checks green.")
    if MODE in ("live", "reprocess"):
        install_bundle(ns)
    else:
        print(f"stub bundle (for UI experiments only): {SCRATCH / 'dashboard_data'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
