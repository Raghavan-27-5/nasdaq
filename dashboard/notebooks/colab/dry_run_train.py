#!/usr/bin/env python3
"""
dry_run_train.py — local end-to-end rehearsal of the training notebook
(nasdaq_ai_quant_train_v001.ipynb) against the FROZEN acquisition parquet.

Why: the notebook must run unattended in Colab; every bug found here is a bug
the user does not discover in a browser session. This harness

  1. reads the training notebook and asserts it is in sync with
     build_train_notebook.py (no stale .ipynb can pass this harness),
  2. neutralises Colab-only calls (!pip, drive.mount, files.download) and
     redirects /content paths to a scratch Drive tree,
  3. seeds that scratch tree with the frozen acquisition outputs
     (clean_prices_v001.parquet + prices_v001.parquet) — the REAL data the
     Colab run will consume,
  4. injects a deterministic stub `lightgbm` module (LGBMRegressor /
     LGBMClassifier / early_stopping / log_evaluation) so the full training,
     metric and artifact pipeline executes WITHOUT installing or running
     LightGBM on the local control plane (AGENTS.md §2),
  5. executes every code cell, and
  6. audits the emitted bundle: validation checks all PASS, prediction/label
     coverage, parquet round-trip schemas, bundle zip contents, run-context
     provenance, and that dashboard/src/data stayed byte-identical.

It does NOT prove LightGBM can be installed in Colab — only the real Colab run
does that. It DOES prove the feature/target factories, fold geometry,
predictions assembly, metrics engine, contract checks and Drive bundle layout
all work on the real code paths, offline.

Usage:
    /tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_train.py
    NQ_TRAIN_SCRATCH=/tmp/opencode/nq_train_dry   # override scratch dir
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import sys
import types
import zlib
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
ARTIFACTS = REPO_ROOT / "artifacts" / "acquisition_v001"
NOTEBOOK = HERE / "nasdaq_ai_quant_train_v001.ipynb"
BUILDER = HERE / "build_train_notebook.py"
DASHBOARD_DATA = REPO_ROOT / "dashboard" / "src" / "data"

DRIVE = "NasdaqAIQuant"
RUN_CONTEXT = "local_harness (dry, stub model)"


# ---------------------------------------------------------------------------
# notebook hygiene
# ---------------------------------------------------------------------------


def assert_notebook_current() -> None:
    """The .ipynb must be exactly what build_train_notebook.py generates."""
    spec = importlib.util.spec_from_file_location("_btnb", BUILDER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    fresh = mod.build()
    onfile = json.loads(NOTEBOOK.read_text())
    if fresh != onfile:
        raise SystemExit(
            "notebook out of sync with builder — run: "
            "python dashboard/notebooks/colab/build_train_notebook.py"
        )


# ---------------------------------------------------------------------------
# colab neutralisation + path redirect
# ---------------------------------------------------------------------------


def transform(src: str, scratch: Path) -> str:
    src = src.replace(
        "from google.colab import drive\ndrive.mount('/content/drive')",
        "print('[dry-run] google.colab.drive.mount skipped')",
    )
    src = src.replace("from google.colab import files\n", "")
    src = src.replace(
        "files.download(ZIP_PATH)",
        "print('[dry-run] files.download skipped:', ZIP_PATH)",
    )
    lines = [
        ln for ln in src.splitlines(keepends=True) if not ln.lstrip().startswith("!pip")
    ]
    src = "".join(lines)
    src = src.replace(
        "/content/dashboard_training_bundle.zip",
        str(scratch / "dashboard_training_bundle.zip"),
    )
    src = src.replace("/content/dashboard_training_data", str(scratch / "data"))
    src = src.replace("/content/drive/MyDrive", str(scratch / "drive"))
    return src


# ---------------------------------------------------------------------------
# deterministic stub gradient booster (no lightgbm on the local machine)
# ---------------------------------------------------------------------------


def make_stub_lightgbm() -> types.ModuleType:
    class _Booster:
        def __init__(self, w: np.ndarray) -> None:
            self._w = np.asarray(w, dtype=float)

        def feature_importance(self, importance_type: str = "split") -> np.ndarray:
            return np.abs(self._w)

    class _Callback:
        pass

    class _BaseModel:
        def __init__(self, **params: object) -> None:
            self._params = dict(params)

        @property
        def n_estimators(self) -> int:
            return int(self._params.get("n_estimators", 100))

        def fit(self, X, y, eval_set=None, callbacks=None, **kw):
            X = np.asarray(X, dtype=float)
            y = np.asarray(y, dtype=float)
            # Deterministic, target-varying weights: same params + same label
            # digest + same feature count => bit-identical refits (the
            # notebook's determinism check must pass); different targets get
            # different weights via the label digest.
            digest = np.round(
                [
                    len(y),
                    float(np.nanmean(y)),
                    float(np.nanstd(y)),
                    float(np.nansum(y) % 9973.0),
                ],
                6,
            ).tobytes()
            seed = (int(self._params.get("random_state", 0)) + zlib.crc32(digest)) % (
                2**31 - 1
            )
            rs = np.random.RandomState(seed)
            self._w = rs.normal(0.05, 1.0, size=X.shape[1])
            self.booster_ = _Booster(self._w)
            self.best_iteration_ = max(20, self.n_estimators // 3)
            return self

        def _raw(self, X) -> np.ndarray:
            X = np.asarray(X, dtype=float)
            return np.where(np.isnan(X), 0.0, X) @ self._w

    class LGBMRegressor(_BaseModel):
        def predict(self, X, **kw) -> np.ndarray:
            return self._raw(X)

    class LGBMClassifier(_BaseModel):
        def predict_proba(self, X, **kw) -> np.ndarray:
            p = 1.0 / (1.0 + np.exp(-self._raw(X)))
            return np.column_stack([1.0 - p, p])

        def predict(self, X, **kw) -> np.ndarray:
            return (self.predict_proba(X)[:, 1] > 0.5).astype(int)

    mod = types.ModuleType("lightgbm")
    mod.__version__ = "dry-run-stub"
    mod.LGBMRegressor = LGBMRegressor
    mod.LGBMClassifier = LGBMClassifier
    mod.early_stopping = lambda *a, **k: _Callback()
    mod.log_evaluation = lambda *a, **k: _Callback()
    return mod


# ---------------------------------------------------------------------------
# scratch Drive tree seeded with the frozen acquisition outputs
# ---------------------------------------------------------------------------


def prepare_inputs(scratch: Path) -> None:
    clean_src = ARTIFACTS / "clean_prices_v001.parquet"
    raw_src = ARTIFACTS / "prices_v001.parquet"
    missing = [p for p in (clean_src, raw_src) if not p.exists()]
    if missing:
        raise SystemExit(f"frozen acquisition input missing: {missing}")
    root = scratch / "drive" / DRIVE
    (root / "04_clean").mkdir(parents=True, exist_ok=True)
    (root / "03_raw").mkdir(parents=True, exist_ok=True)
    shutil.copy(clean_src, root / "04_clean" / clean_src.name)
    shutil.copy(raw_src, root / "03_raw" / raw_src.name)


# ---------------------------------------------------------------------------
# execution
# ---------------------------------------------------------------------------


def exec_cell(ns: dict, src: str, label: str) -> None:
    try:
        exec(compile(src, f"<{label}>", "exec"), ns)
    except SystemExit as e:
        raise SystemExit(f"{label} raised SystemExit: {e}")


def run_notebook(ns: dict, scratch: Path) -> None:
    nb = json.loads(NOTEBOOK.read_text())
    for i, cell in enumerate(nb["cells"]):
        if cell["cell_type"] != "code":
            continue
        exec_cell(ns, transform("".join(cell["source"]), scratch), f"cell{i}")


# ---------------------------------------------------------------------------
# audit
# ---------------------------------------------------------------------------

PREDICTION_COLUMNS = [
    "ticker",
    "prediction_date",
    "target_name",
    "prediction",
    "model_version",
    "feature_version",
    "universe_version",
    "train_start",
    "train_end",
    "validation_start",
    "validation_end",
    "prediction_generated_at",
    "is_oos",
]


def dir_digest(path: Path) -> dict[str, str]:
    dig: dict[str, str] = {}
    if not path.exists():
        return dig
    for p in sorted(path.rglob("*")):
        if p.is_file():
            dig[str(p.relative_to(path))] = hashlib.sha256(p.read_bytes()).hexdigest()
    return dig


def audit(ns: dict, scratch: Path, pre_dashboard: dict[str, str]) -> list[str]:
    fails: list[str] = []

    def require(cond: bool, msg: str) -> None:
        if not cond:
            fails.append(msg)

    # 1. in-notebook validation suite must be complete and green
    checks = ns.get("checks", [])
    require(
        isinstance(checks, list) and len(checks) >= 20,
        f"expected >=20 in-notebook checks, got {len(checks) if isinstance(checks, list) else 'none'}",
    )
    for c in checks:
        require(
            c.get("status") == "PASS",
            f"in-notebook check FAIL: {c.get('check')}: {c.get('detail')}",
        )

    # 2. required objects
    for name in (
        "features_long",
        "targets_long",
        "predictions",
        "metrics",
        "run_manifest",
        "report",
        "F_FEATURES",
        "F_TARGETS",
        "F_PRED",
    ):
        require(name in ns, f"namespace missing {name}")
    if fails:
        return fails

    features_long: pd.DataFrame = ns["features_long"]
    targets_long: pd.DataFrame = ns["targets_long"]
    predictions: pd.DataFrame = ns["predictions"]
    run_manifest: dict = ns["run_manifest"]
    report: dict = ns["report"]

    # 3. predictions contract schema + row sanity
    require(
        PREDICTION_COLUMNS == list(predictions.columns)[: len(PREDICTION_COLUMNS)]
        or set(PREDICTION_COLUMNS) <= set(predictions.columns),
        f"prediction columns mismatch: {list(predictions.columns)}",
    )
    require(predictions["prediction"].notna().all(), "NaN predictions present")
    require(predictions["is_oos"].all(), "non-OOS prediction rows present")
    require(
        (predictions["prediction_date"] >= pd.Timestamp(ns["OOS_START"])).all(),
        "predictions before OOS start",
    )
    require(
        (pd.to_datetime(predictions["prediction_generated_at"]).notna()).all(),
        "prediction_generated_at not stamped",
    )

    # 4. per-target OOS coverage: predictions must exactly equal the usable
    #    training matrix restricted to OOS. The documented >=5-defined-features
    #    warmup rule shapes that matrix; the notebook separately proves that
    #    warmup is the only cause of unpredicted label rows.
    oos = pd.Timestamp(ns["OOS_START"])
    mb = ns["matrix_base"]
    for tname in ns["TARGETS"]:
        pred_keys = set(
            map(
                tuple,
                predictions.loc[
                    predictions["target_name"] == tname, ["ticker", "prediction_date"]
                ].itertuples(index=False),
            )
        )
        exp_keys = set(
            map(
                tuple,
                mb.loc[
                    (mb["target_name"] == tname) & (mb["date"] >= oos),
                    ["ticker", "date"],
                ].itertuples(index=False),
            )
        )
        require(
            pred_keys == exp_keys,
            f"{tname}: predictions vs usable matrix mismatch "
            f"(missing {len(exp_keys - pred_keys)}, extra {len(pred_keys - exp_keys)})",
        )

    # 5. parquet round-trip
    for frame_name, path, keys in (
        ("features", ns["F_FEATURES"], ["date", "ticker"]),
        ("targets", ns["F_TARGETS"], ["ticker", "date", "target_name"]),
        ("predictions", ns["F_PRED"], ["ticker", "prediction_date", "target_name"]),
    ):
        got = pd.read_parquet(path)
        require(
            len(got)
            == len(
                ns[
                    {
                        "features": "features_long",
                        "targets": "targets_long",
                        "predictions": "predictions",
                    }[frame_name]
                ]
            ),
            f"{frame_name} parquet row count differs from in-memory frame",
        )
        require(
            set(keys) <= set(got.columns), f"{frame_name} parquet missing keys {keys}"
        )

    # 6. bundle zip contents
    import zipfile

    zip_path = scratch / "dashboard_training_bundle.zip"
    require(zip_path.exists(), "bundle zip missing")
    if zip_path.exists():
        with zipfile.ZipFile(zip_path) as z:
            names = set(z.namelist())
        for fname in (
            "features_v003.parquet",
            "feature_meta_v003.json",
            "targets_v002.parquet",
            "training_report_v001.json",
            "predictions_v007.parquet",
            "run_manifest_train_v001.json",
        ):
            require(fname in names, f"bundle zip missing {fname}")

    # 7. provenance + report consistency
    require(
        run_manifest.get("run_context") == RUN_CONTEXT,
        f"run_context not recorded: {run_manifest.get('run_context')!r}",
    )
    require(
        report.get("run_context") == RUN_CONTEXT,
        f"report run_context wrong: {report.get('run_context')!r}",
    )
    require(
        report.get("feature_version") == "features_v003"
        and report.get("target_version") == "targets_v002",
        "report version identifiers drifted from the pre-registered names",
    )
    require(
        report.get("engine") == "stub (local harness)",
        f"engine should record the stub, got {report.get('engine')!r}",
    )
    require(len(run_manifest.get("failures", [])) == 0, "run manifest records failures")
    require(
        len(run_manifest.get("parquet", {})) == 3, "run manifest missing parquet hashes"
    )

    # 8. metric ranges are sane (stub predictions, real data)
    for tname, m in report["targets"].items():
        require(
            m["icir"] is None or np.isfinite(m["icir"]), f"{tname}: non-finite ICIR"
        )
        require(len(m["folds"]) >= 15, f"{tname}: too few folds ({len(m['folds'])})")
        require(0.0 <= m["hit_rate"] <= 1.0, f"{tname}: hit rate out of range")
        require(
            len(m["feature_importance"]) == 15, f"{tname}: importance table wrong size"
        )

    # 9. dashboard data untouched
    post_dashboard = dir_digest(DASHBOARD_DATA)
    require(
        post_dashboard == pre_dashboard,
        "dashboard/src/data changed during the training rehearsal",
    )

    # 10. output layout of the scratch drive
    root = scratch / "drive" / DRIVE
    for rel in (
        "05_features/features_v003.parquet",
        "05_features/feature_meta_v003.json",
        "06_targets/targets_v002.parquet",
        "07_models/training_report_v001.json",
        "08_predictions/predictions_v007.parquet",
        "12_dashboard/runs/run_manifest_train_v001.json",
    ):
        require((root / rel).exists(), f"scratch Drive missing {rel}")

    return fails


def print_summary(ns: dict) -> None:
    checks = ns.get("checks", [])
    n_pass = sum(1 for c in checks if c.get("status") == "PASS")
    print(f"\nin-notebook checks: {n_pass}/{len(checks)} PASS")
    metrics = ns.get("metrics", {})
    if metrics:
        rows = [
            {
                "target": t,
                "IC": m["oos_ic_mean"],
                "ICIR": m["icir"],
                "hit": m["hit_rate"],
                "R2": m["r2"],
                "folds": len(m["folds"]),
                "n_oos": m["n_oos_rows"],
            }
            for t, m in metrics.items()
        ]
        print(pd.DataFrame(rows).to_string(index=False))
    feats = ns.get("features_long")
    tgts = ns.get("targets_long")
    preds = ns.get("predictions")
    if feats is not None:
        print(
            f"\nfeatures: {feats.shape[1] - 5} columns x {len(feats):,} rows | "
            f"targets: {len(tgts):,} rows | predictions: {len(preds):,} rows"
        )
    rm = ns.get("run_manifest", {})
    for k_, v_ in rm.get("parquet", {}).items():
        print(f"  sha256 {k_:26s} {v_[:16]}...")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="offline rehearsal of the training notebook"
    )
    ap.add_argument(
        "--scratch", default=None, help="scratch dir (default NQ_TRAIN_SCRATCH)"
    )
    args = ap.parse_args(argv)

    assert_notebook_current()

    scratch = Path(
        args.scratch or os.environ.get("NQ_TRAIN_SCRATCH", "/tmp/opencode/nq_train_dry")
    )
    if scratch.exists():
        shutil.rmtree(scratch)
    scratch.mkdir(parents=True, exist_ok=True)

    pre_dashboard = dir_digest(DASHBOARD_DATA)

    os.environ["NQ_RUN_CONTEXT"] = RUN_CONTEXT
    prepare_inputs(scratch)

    sys.modules["lightgbm"] = make_stub_lightgbm()
    print(f"[dry-run] scratch {scratch}")
    print(f"[dry-run] run_context {RUN_CONTEXT!r}; stub lightgbm injected")

    ns: dict = {"__name__": "__main__"}
    try:
        run_notebook(ns, scratch)
    except SystemExit as e:
        print(f"\n[dry-run] notebook aborted: {e}")
        return 1

    fails = audit(ns, scratch, pre_dashboard)
    print_summary(ns)

    if fails:
        print(f"\n[dry-run] {len(fails)} AUDIT FAILURES:")
        for f in fails:
            print("  -", f)
        return 1
    print(
        f"\n[dry-run] ALL CHECKS PASS — bundle assembled at {scratch / 'drive' / DRIVE}"
    )
    print(
        "[dry-run] note: LightGBM itself is NOT exercised locally (stub trainer); "
        "the real fit happens in Colab."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
