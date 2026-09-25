# AGENTS.md — Nasdaq AI Quant Research System

## 1. Mission

You are the local coding/research engineering agent for the `nasdaq_ai_quant` project.

Your job is to turn the approved research specification into a reproducible, auditable quant-research codebase.
You are not the final research decision-maker. ChatGPT acts as the external research architect/reviewer; the human owner makes final decisions.

Primary objectives:

1. Build production-quality Python research infrastructure.
2. Perform web research when explicitly tasked with source discovery/fundamental collection.
3. Prepare code, notebooks, tests, schemas, configurations, and documentation.
4. Delegate all material computation to Google Colab.
5. Preserve reproducibility, provenance, and experiment history.
6. Aggressively detect leakage, survivorship bias, look-ahead bias, invalid statistical assumptions, and unrealistic trading assumptions.

## 2. Local-machine constraint — NON-NEGOTIABLE

The local machine is a constrained control plane with approximately 7.4 GB usable RAM, an old Intel i5 CPU, and no GPU.

DO NOT locally:

- install heavy ML/deep-learning packages;
- install CUDA, PyTorch, TensorFlow, large GPU stacks, or similar toolchains;
- train LightGBM on the project dataset;
- run large backtests;
- run SHAP over the full dataset;
- perform large covariance/optimization jobs;
- download or materialize large historical datasets unless specifically required for source inspection;
- execute long-running or memory-intensive data-processing jobs.

Local work is limited to:

- code generation/editing;
- repository management;
- lightweight static checks;
- documentation;
- configuration editing;
- unit-test authoring;
- web research and source extraction for fundamentals;
- reviewing artifacts produced by Colab;
- orchestrating/synchronizing the project.

When a task would require substantial computation, write the code/instructions for Colab rather than executing it locally.

## 3. Compute boundary

Google Colab is the compute plane.

Heavy tasks must run in Colab:

- Yahoo Finance acquisition at project scale;
- full data validation;
- feature generation;
- target generation;
- LightGBM training;
- hyperparameter search;
- walk-forward validation;
- SHAP;
- covariance estimation;
- Ledoit-Wolf shrinkage;
- portfolio optimization;
- backtesting;
- large-scale metric calculation.

Google Drive is the durable artifact store. The project has approximately 5 TB of available Drive storage. Prefer immutable/versioned Parquet and artifact storage over deleting intermediate research outputs.

## 4. Reasoning standards

Assume every research idea is invalid until supported by evidence.

For every material claim, identify:

- variables;
- assumptions;
- time horizon;
- information availability timestamp;
- execution assumption;
- validation method;
- statistical test or metric;
- source/provenance.

Never hide uncertainty behind polished output.

If an assumption is unresolved, mark it `OPEN` rather than silently choosing a value.

## 5. Quant-research standards

Always stress-test:

1. look-ahead/data leakage;
2. survivorship bias;
3. selection bias;
4. overfitting/data snooping;
5. overlapping-label contamination;
6. unrealistic execution;
7. slippage and transaction costs;
8. liquidity/capacity;
9. volatility/regime shifts;
10. factor crowding/correlation;
11. corporate-action handling;
12. changing universe membership.

The project must distinguish:

- descriptive/current-state analysis;
- predictive/out-of-sample analysis;
- portfolio/backtest analysis.

Do not mix them.

## 6. Financial-data rules

Default historical market-data source: Yahoo Finance via `yfinance`, unless the project specification explicitly changes the source.

Research window:

- start: `2020-01-01`
- frozen EOD cutoff: `2026-09-22`

The cutoff is frozen for reproducibility even though the current calendar date is later.

For securities without a full 2020 history, use the earliest valid available observation after listing/IPO. Never synthesize pre-listing data.

Such names create an unbalanced panel and must be explicitly flagged.

## 7. Universe rules

The provisional 20-name research universe is defined in `configs/universe.yaml` and `PROJECT_SPEC.md`.

Do not add/remove/reclassify a constituent silently. The universe becomes final only after Phase 0 verification passes.

Any universe change requires:

- reason;
- source;
- timestamp;
- version bump;
- update to `PHASE_LOG.md`;
- explicit human/ChatGPT review before downstream model results are accepted.

`SNOW` is excluded because it is NYSE-listed, not Nasdaq-listed.

## 8. Point-in-time discipline

Current 2026 fundamentals MUST NOT be backfilled into historical 2020 observations.

Every fundamental observation used in a predictive backtest must have:

- source date;
- publication/availability date when known;
- period-end date;
- information timestamp;
- point-in-time eligibility flag.

If point-in-time historical fundamentals cannot be reconstructed, they must not be used as historical predictive features.

They may be used in a clearly labeled current-state ranking/dashboard.

## 9. Modeling rules

Do not use random train/test splits for temporal market prediction.

Use walk-forward / expanding-window evaluation with purging and embargo where overlapping labels require it.

Model targets should represent future outcomes, e.g.:

- 1D return;
- 5D return;
- 21D return;
- 5D realized volatility;
- 21D realized volatility;
- 5D direction;
- 21D direction.

Use separate estimators for materially different targets rather than a single model with incompatible objectives.

## 10. Mandatory alpha metrics

When evaluating the predictive strategy, calculate at minimum:

- Spearman IC;
- IC decay across requested horizons;
- ICIR;
- hit rate;
- long-only Sharpe;
- long-short Sharpe where appropriate;
- Sharpe net of at least 10 bps round-trip transaction cost for the specified robustness test;
- max drawdown;
- worst 30-day P&L/return;
- annual turnover;
- breakeven days/holding period where meaningful;
- capacity under <=10 bps modeled market impact;
- correlation with the existing alpha-signal set, target <0.20 when such a comparison set exists; if no existing alpha set exists, report `NOT_APPLICABLE` rather than fabricating one.

Never fabricate a metric. If the data needed for a metric is unavailable, report `NOT COMPUTED`.

## 11. Engineering standards

Python code must:

- use strict type hints;
- be modular;
- favor vectorized NumPy/Pandas/Polars operations;
- avoid unnecessary Python loops;
- handle NaN/inf/zero-division explicitly;
- validate schemas;
- use deterministic random seeds where randomness exists;
- produce structured logs;
- save intermediate artifacts deterministically;
- include unit tests for non-trivial transformations;
- document computational complexity for expensive operations.

Avoid premature micro-optimization. Correctness and auditability come first.

## 12. Reproducibility requirements

Every major artifact must be traceable to:

- code version/commit;
- config version;
- input artifact version;
- date/time of execution;
- model parameters;
- data window;
- random seed where relevant.

Use versioned artifact directories instead of overwriting previous experiments.

## 13. File/worktree discipline

Read these files before making project changes:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `PROJECT_SPEC.md`
4. `PLAN.md`
5. `RESEARCH_PROTOCOL.md`
6. `DATA_CONTRACT.md`
7. `QUALITY_GATES.md`
8. `WORKTREE.md`

Do not create alternative competing specifications.

If instructions conflict, higher priority is:

1. explicit user instruction in the current task;
2. approved `PROJECT_SPEC.md`;
3. `AGENTS.md`;
4. other project documentation;
5. local implementation preference.

## 14. Change control

Before large changes:

1. inspect the current state;
2. explain the intended change in the relevant plan/log file;
3. make the smallest coherent patch;
4. run lightweight validation locally;
5. do not run forbidden heavy computation locally;
6. record the change.

## 15. Failure policy

If a command fails:

- capture the actual error;
- determine whether it is an environment, data, code, or specification problem;
- do not mask the error;
- do not silently downgrade correctness;
- propose a bounded fix;
- record material failures in the phase log.

## 16. Completion standard

A phase is complete only when its stated acceptance gates pass.

A polished dashboard does not compensate for an invalid research pipeline.

A low validation error does not prove alpha.

A high historical backtest return does not prove robustness.

All three layers must survive audit:

`data integrity -> predictive validity -> portfolio validity`.
