# CONTEXT.md — Project Context and Operating Model

## Project

**Name:** Nasdaq AI Quant Research System

**Purpose:** Build a rigorous research platform for a locked universe of Nasdaq-listed US AI-exposed equities, combining current-state fundamental ranking, Yahoo Finance EOD history, walk-forward LightGBM prediction, constrained portfolio construction, factor attribution, risk analysis, and an interactive premium dashboard.

## Assignment

The assignment has six connected deliverables:

1. Select 15–20 materially AI-exposed US equities listed on Nasdaq.
2. Quantitatively rank the selected names on AI exposure, growth, FCF growth/quality, valuation, AI-capex exposure, earnings revisions, momentum, volatility, drawdown, and correlation.
3. Retrieve 2020–2026 EOD market data from Yahoo Finance for the selected universe.
4. Train walk-forward LightGBM models for future returns, volatility, and direction.
5. Construct and evaluate a constrained portfolio using model outputs and risk/factor constraints.
6. Deliver an interactive, visually premium research dashboard.

## Known design decisions

### Research window

- `2020-01-01` through frozen EOD cutoff `2026-09-22`.
- The cutoff is frozen for reproducibility.

### Data source

Primary historical EOD source: `yfinance` / Yahoo Finance.

### Compute architecture

**Local laptop:** control plane only.

- approximately 7.4 GB RAM;
- old Intel i5 CPU;
- no GPU.

**Oh My Pi local agent:** software engineer + research web-research assistant.

- writes code;
- edits docs/configs;
- performs targeted web research;
- builds notebooks and tests;
- does not perform heavy computation.

**Google Colab:** compute plane.

- downloads large datasets;
- feature engineering;
- model training;
- walk-forward validation;
- SHAP;
- covariance estimation;
- optimization;
- backtesting.

**Google Drive:** durable artifact store with approximately 5 TB available storage.

Store:

- raw data;
- cleaned data;
- feature matrices;
- target matrices;
- trained models;
- predictions;
- covariance matrices;
- optimization outputs;
- backtests;
- reports;
- experiment metadata.

**ChatGPT:** external quant architect/reviewer.

Primary use:

- research design;
- source verification;
- methodology;
- quantitative reasoning;
- adversarial review;
- leakage audit;
- portfolio/risk critique;
- code review;
- dashboard architecture;
- interpretation of generated artifacts.

## Research separation

Three analytical layers must remain distinct:

### A. Current-state descriptive layer

Answers questions such as:

> Which current Nasdaq AI stocks score highest under the specified factor model?

Current 2026 fundamentals can be used here, provided every value is sourced and timestamped.

### B. Historical predictive layer

Answers:

> Given only information available at time `t`, can we predict `t+h` return/volatility/direction?

This layer requires point-in-time discipline.

### C. Portfolio layer

Answers:

> Do out-of-sample model signals produce useful risk-adjusted portfolio outcomes after costs and systematic-factor controls?

These layers must not be merged into a single score without explicitly documenting the information flow.

## Critical biases already identified

### Survivorship bias

The universe is selected using information known in 2026, then historical data from 2020 onward are analyzed. This is a **current-universe historical study**, not a fully survivorship-bias-free historical universe study.

The dashboard and report must disclose this.

### IPO/listing-entry truncation

Some current constituents did not trade publicly for the full 2020–2026 window. Do not synthesize pre-listing prices.

These securities contribute observations only from their valid trading start date.

### Fundamental look-ahead risk

Current fundamental data must not be inserted into historical observations.

### Target overlap

5D/21D forward targets overlap across adjacent rows. Validation therefore requires temporal/purged treatment appropriate to overlapping labels.

## Intended model family

Separate LightGBM estimators for distinct targets:

- 1D return;
- 5D return;
- 21D return;
- 5D realized volatility;
- 21D realized volatility;
- 5D direction;
- 21D direction.

The initial architecture is a pooled cross-sectional model across the stock universe rather than one independent model per stock, subject to empirical validation.

## Core portfolio concept

Predicted returns provide expected returns `mu`.

Predicted volatility and historical return structure provide risk estimates.

Covariance is estimated and shrunk using Ledoit-Wolf or an equally defensible documented alternative.

Portfolio optimization then incorporates:

- position limits;
- category concentration limits;
- factor exposure limits;
- beta limits;
- turnover constraints;
- transaction costs;
- risk aversion;
- factor/correlation concentration penalties.

## Required attribution

Portfolio performance must be decomposed against systematic benchmarks/factors, at minimum:

- QQQ/Nasdaq exposure;
- SOXX/semiconductor exposure;
- momentum;
- size;
- value where measurable;
- other explicitly selected factors.

The key test is whether residual alpha remains after controlling for these systematic exposures.

## Dashboard vision

The final product should resemble an institutional quant-research terminal rather than a generic student dashboard.

Design goals:

- dark, premium, restrained visual language;
- high information density without clutter;
- excellent typography and hierarchy;
- interactive tables and charts;
- drill-down from universe → stock → model → portfolio → risk;
- explicit research-audit section.

Suggested implementation: Streamlit + Plotly initially, unless a later engineering decision justifies a separate frontend.

## Human roles

### Human owner

- final research decisions;
- acceptance/rejection of hypotheses;
- mentor communication;
- final presentation.

### ChatGPT

- architecture and quantitative review;
- factual web research;
- adversarial validation;
- interpretation.

### Oh My Pi

- coding and repository operations;
- structured web research;
- test/documentation generation;
- orchestration.

### Colab

- heavy execution.

No agent should silently assume another agent has already completed a task.
