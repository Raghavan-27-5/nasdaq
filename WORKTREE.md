# WORKTREE.md — Repository and Compute Contract

## 1. Repository root

Expected local repository:

```text
/home/raghavan/projects/nasdaq_project/
```

The supplied Phase-0 package is a template because the assistant runtime cannot write directly to the user's host filesystem.

## 2. Target repository structure

```text
nasdaq_project/
├── AGENTS.md
├── CONTEXT.md
├── PLAN.md
├── PROJECT_SPEC.md
├── RESEARCH_PROTOCOL.md
├── DATA_CONTRACT.md
├── QUALITY_GATES.md
├── WORKTREE.md
├── PHASE_LOG.md
├── README.md
├── META_PROMPT_001.md
├── .gitignore
│
├── configs/
│   ├── project.yaml
│   └── universe.yaml
│
├── src/
│   ├── data/
│   ├── features/
│   ├── targets/
│   ├── models/
│   ├── evaluation/
│   ├── risk/
│   ├── portfolio/
│   ├── attribution/
│   └── utils/
│
├── tests/
│   ├── unit/
│   ├── leakage/
│   ├── schemas/
│   └── fixtures/
│
├── notebooks/
│   ├── colab/
│   └── exploratory/
│
├── dashboard/
│   ├── app.py
│   ├── pages/
│   ├── components/
│   ├── styles/
│   └── assets/
│
├── scripts/
│   ├── local/
│   └── colab/
│
├── docs/
│   ├── UNIVERSE_METHODOLOGY.md
│   ├── methodology/
│   ├── research_notes/
│   └── submission/
│
└── artifacts/
    ├── manifests/
    └── previews/
```

Large data/model artifacts should live on Google Drive, not in Git.

## 3. Google Drive structure

Canonical Drive root:

```text
NasdaqAIQuant/
├── 00_project/
├── 01_universe/
├── 02_fundamentals/
├── 03_raw/
├── 04_clean/
├── 05_features/
├── 06_targets/
├── 07_models/
├── 08_predictions/
├── 09_risk/
├── 10_portfolios/
├── 11_backtests/
├── 12_dashboard/
├── 13_reports/
└── 99_archive/
```

## 4. Artifact naming

Use deterministic names with versions.

Examples:

```text
universe_v001.parquet
fundamentals_v001.parquet
prices_v001.parquet
features_v003.parquet
predictions_v007.parquet
covariance_v002.parquet
portfolio_weights_v004.parquet
backtest_v005.parquet
```

Do not overwrite prior research artifacts.

## 5. Local execution

Allowed:

- markdown/YAML edits;
- source-code generation;
- lightweight static analysis;
- formatting/linting if already installed;
- small unit tests;
- source inspection;
- web research.

Disallowed without explicit human exception:

- full data downloads;
- large DataFrame processing;
- LightGBM training;
- SHAP over full data;
- large optimization;
- full backtest;
- heavy package installation.

## 6. Colab execution

Every heavy notebook must:

1. mount Google Drive;
2. validate package versions;
3. load the required versioned artifacts;
4. verify checksums/manifests where available;
5. run deterministic code;
6. save outputs to versioned Drive paths;
7. emit a machine-readable run manifest.

## 7. Git policy

Commit small coherent changes.

Commit messages should identify phase/module, e.g.:

```text
phase0: lock Nasdaq AI universe
features: add leakage-safe momentum features
model: add walk-forward 21d return estimator
risk: add Ledoit-Wolf covariance pipeline
```

Never commit:

- raw market datasets;
- model binaries;
- API keys;
- credentials;
- large generated files;
- private tokens.

## 8. Environment files

The project should use a lightweight local requirements environment and a separate Colab environment specification if dependency sets diverge.

Do not force heavy ML dependencies onto the local machine merely because they are needed in Colab.

## 9. Dashboard deployment boundary

The dashboard should consume precomputed/versioned artifacts.

It must not perform full model training at page-load time.

## 10. Work-tree change safety

Before deleting/renaming an existing file, inspect it first.

Do not silently replace user-created files.

If an expected file is absent, create it only after checking the current repository state.
