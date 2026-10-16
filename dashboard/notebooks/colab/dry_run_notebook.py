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

Exit code 0 = every check passed.
"""

from __future__ import annotations

import importlib.util
import json
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
SCRATCH = Path(os.environ.get("DRY_RUN_DIR", "/tmp/opencode/dryrun"))

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
}

LISTING_LAG = {"PLTR": "2020-09-30", "CRWV": "2025-03-21"}


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
        ns["ACTIONS"][ticker] = [dict(e) for e in STUB_ACTIONS.get(ticker, [])]
        return frames[ticker].copy(), "dry_run_stub:attempt1"

    def stub_yf(ticker, tries=2):
        return None, "dry_run_stub:not-called"

    def stub_stooq(ticker, tries=2):
        return None, "dry_run_stub:not-called"

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

    # Fake yfinance (network module) before Cell 1 imports it.
    import types

    fake_yf = types.ModuleType("yfinance")
    fake_yf.__version__ = "dry-run-stub"
    fake_yf.Ticker = lambda *a, **k: None
    sys.modules["yfinance"] = fake_yf

    ns: dict = {"__name__": "__dry_run__"}
    for i, c in enumerate(code_cells):
        src = transform("".join(c["source"]))
        if "def fetch_chart_api" in src:
            marker = 'report = {"tickers": {}, "failures": [], "sources": {}}'
            head, tail = src.split(marker, 1)
            exec_cell(ns, head, f"cell{i}-fetchers")
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
        "running with fixtures keeps ML/portfolio rows synthetic",
        all(
            man["real_vs_synthetic"][i]["status"].startswith("SYNTHETIC")
            for i in (5, 6, 10)
        ),
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


def main() -> int:
    print("=" * 72)
    print("dry-run rehearsal — synthetic fetchers, real processing code")
    print("=" * 72)
    ns = run_notebook()
    print("\n" + "=" * 72)
    print("auditing the emitted bundle")
    print("=" * 72)
    audit(ns)
    print("\n" + "=" * 72)
    if FAILURES:
        print(f"DRY RUN FAILED — {len(FAILURES)} of {_checks} checks failed:")
        for f in FAILURES:
            print("  -", f)
        return 1
    print(f"DRY RUN PASSED — {_checks}/{_checks} checks green.")
    print(f"stub bundle (for UI experiments only): {SCRATCH / 'dashboard_data'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
