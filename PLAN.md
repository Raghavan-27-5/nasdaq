# PLAN.md — Master Execution Plan

## Status legend

- `LOCKED` — decision is frozen.
- `IN_PROGRESS` — current phase is being executed.
- `BLOCKED` — cannot proceed without resolving a dependency.
- `REVIEW` — work exists but requires audit.
- `COMPLETE` — phase acceptance gates passed.

## Phase map

### Phase 0A — Agent Operating System

Status: `COMPLETE_AFTER_SELF_AUDIT`.

Goal: provide the local coding agent with the project context, role, quality standards, worktree contract, data contract, research protocol, and execution instructions.

Outputs:

- `AGENTS.md`
- `CONTEXT.md`
- `PLAN.md`
- `PROJECT_SPEC.md`
- `RESEARCH_PROTOCOL.md`
- `DATA_CONTRACT.md`
- `QUALITY_GATES.md`
- `WORKTREE.md`
- `PHASE_LOG.md`
- `README.md`
- `.gitignore`
- `configs/project.yaml`
- `configs/universe.yaml`
- `META_PROMPT_001.md`
- `docs/UNIVERSE_METHODOLOGY.md`

### Phase 0 — Project Specification + Universe Lock

Status: `IN_PROGRESS`

Goal:

1. freeze the research period and data conventions;
2. define what “Nasdaq AI stock” means;
3. lock a 20-name research universe;
4. verify listing/exchange status;
5. define AI categories;
6. document inclusion/exclusion rules;
7. record known historical-coverage limitations;
8. produce the first versioned universe artifact.

Universe-lock output:

- exactly 20 research tickers;
- exchange verification;
- company name;
- category;
- rationale;
- listing/IPO start information;
- source URLs;
- version and timestamp.

### Phase 1 — Research Source / Fundamental Dataset

Goal:

Create a sourced current-state factor dataset for the selected universe.

Factors:

- AI revenue exposure;
- revenue growth;
- FCF growth/quality;
- valuation;
- AI-capex exposure;
- earnings revisions;
- momentum;
- volatility;
- drawdown;
- correlation/diversification metrics.

Important:

Current-state factor scores are not automatically valid historical model features.

### Phase 2 — Colab + Drive Compute Infrastructure

Goal:

Create a reproducible compute environment in Google Colab and a durable Google Drive artifact structure.

Local machine remains control plane only.

### Phase 3 — Yahoo Finance EOD Acquisition

Window:

`2020-01-01` → `2026-09-22` EOD.

Targets:

- OHLCV;
- adjusted price convention;
- actions metadata where available;
- benchmark series: QQQ, SOXX, SPY.

### Phase 4 — Data Validation

Check:

- duplicates;
- missingness;
- date ordering;
- trading-calendar consistency;
- non-positive prices;
- impossible OHLC relationships;
- abnormal volume;
- corporate actions;
- stock-specific start dates;
- benchmark coverage.

### Phase 5 — Feature / Target Factory

Build reproducible vectorized feature and target generators.

Features include:

- returns;
- momentum;
- volatility;
- trend;
- volume;
- technical state;
- relative strength;
- market-relative features;
- cross-sectional ranks.

Targets include:

- forward returns;
- forward realized volatility;
- direction.

### Phase 6 — Walk-Forward LightGBM

Separate models by target/horizon.

Use temporal splits, purging/embargo where necessary, fixed evaluation protocol, and deterministic experiment configuration.

### Phase 7 — Model Validation / Explainability

Calculate:

- MAE;
- RMSE;
- R²;
- Spearman IC;
- Pearson IC;
- ICIR;
- IC decay;
- hit rate;
- calibration where applicable;
- feature importance;
- SHAP.

### Phase 8 — Covariance / Factor / Risk Engine

Estimate:

- covariance;
- Ledoit-Wolf shrinkage;
- correlation;
- QQQ beta;
- SOXX beta;
- factor exposures;
- marginal contribution to risk;
- component contribution to risk;
- expected shortfall.

### Phase 9 — Portfolio Optimizer

Optimize predicted returns under explicit risk and concentration constraints.

Initial constraint framework:

- fully invested long-only baseline;
- position bounds;
- semiconductor cap;
- hyperscaler cap;
- software/security cap;
- beta/risk limits;
- turnover limit;
- transaction-cost penalty;
- factor concentration penalty.

Exact numbers must be confirmed in the final portfolio specification rather than silently assumed from an illustrative prototype.

### Phase 10 — Backtest / Alpha Attribution

Compare:

- ML portfolio;
- equal-weight AI universe;
- QQQ;
- SOXX;
- optionally SPY.

Calculate:

- CAGR;
- annualized volatility;
- Sharpe;
- Sortino;
- maximum drawdown;
- worst 30-day return;
- turnover;
- transaction-cost-adjusted return;
- alpha;
- beta;
- factor attribution;
- residual return.

### Phase 11 — Dashboard

Build premium interactive dashboard with pages:

1. Command Center
2. AI Universe
3. Stock Intelligence
4. ML Lab
5. Portfolio Optimizer
6. Risk Terminal
7. Backtest
8. Research Audit

### Phase 12 — Final QA / Mentor Submission

Run the full quality-gate suite.

Deliver:

- source-backed research report;
- reproducible Colab notebooks/scripts;
- versioned model artifacts;
- portfolio/backtest outputs;
- dashboard;
- methodology document;
- known-limitations document;
- reproducibility instructions.

## Phase transition rule

Never advance because the code “runs.”

Advance only after the phase acceptance criteria in `QUALITY_GATES.md` pass and `PHASE_LOG.md` records the evidence.
