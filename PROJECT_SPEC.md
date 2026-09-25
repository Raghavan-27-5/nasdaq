# PROJECT_SPEC.md — Version 0.1 — Phase 0 Lock

## 1. Project identity

**Project:** Nasdaq AI Quant Research System

**Specification version:** `0.1.0`

**Specification status:** `PHASE_0_IN_PROGRESS`

**Current date:** `2026-09-25`

**Frozen market-data cutoff:** `2026-09-22` EOD

## 2. Objective

Build a reproducible quantitative research system for a 20-stock Nasdaq-listed AI-exposed US equity universe.

The system will:

1. establish and document the research universe;
2. perform a current-state quantitative factor ranking;
3. acquire 2020–2026 EOD market data;
4. engineer strictly time-consistent predictive features;
5. train walk-forward LightGBM models for future return/volatility/direction;
6. estimate risk and factor exposures;
7. construct a constrained portfolio;
8. backtest and attribute performance;
9. expose the results through an interactive premium dashboard.

## 3. Interpretation of “Nasdaq AI stock”

For this project, a constituent must satisfy all baseline criteria:

1. common equity or ordinary listed equity security traded/listed on Nasdaq at the universe-freeze date;
2. material AI economic exposure through one or more of:
   - AI compute;
   - AI semiconductor/memory/networking infrastructure;
   - AI data-center infrastructure;
   - AI-enabled hyperscaler platform economics;
   - enterprise AI software;
   - generative AI software;
   - AI-enabled cybersecurity;
   - AI/EDA semiconductor design infrastructure;
3. sufficient public financial information and market-data availability for the research task;
4. adequate liquidity for portfolio research, subject to later explicit capacity tests.

“AI exposure” is an economic classification, not a statement that AI is the company’s only business.

## 4. Universe lock

The initial locked research universe is 20 names.

The 20-name universe is designed to cover the major AI value chain while avoiding a one-layer-only sample.

| Ticker | Company | AI category | Historical note |
|---|---|---|---|
| NVDA | NVIDIA | AI Compute | Full-period history available |
| AVGO | Broadcom | Custom Silicon / Networking | Full-period history available |
| AMD | Advanced Micro Devices | AI Compute | Full-period history available |
| MU | Micron Technology | AI Memory | Full-period history available |
| MSFT | Microsoft | Hyperscaler / AI Platform | Full-period history available |
| GOOGL | Alphabet Class A | Hyperscaler / AI Platform | Full-period history available |
| AMZN | Amazon | Hyperscaler / AI Platform | Full-period history available |
| META | Meta Platforms Class A | AI Platform / Infrastructure | Full-period history available |
| PLTR | Palantir Technologies Class A | Enterprise AI | Public-history begins after 2020-01-01; use actual observations only |
| MRVL | Marvell Technology | AI Networking / Custom Silicon | Full-period history available |
| LRCX | Lam Research | Semiconductor Equipment / AI Capex | Full-period history available |
| AMAT | Applied Materials | Semiconductor Equipment / AI Capex | Full-period history available |
| CDNS | Cadence Design Systems | EDA / AI Semiconductor Design | Full-period history available |
| SNPS | Synopsys | EDA / AI Semiconductor Design | Full-period history available |
| PANW | Palo Alto Networks | AI Cybersecurity | Full-period history available |
| CRWD | CrowdStrike Class A | AI Cybersecurity | Full-period public history available inside the research window |
| ADBE | Adobe | Generative AI Software | Full-period history available |
| DDOG | Datadog Class A | AI / Cloud Observability | Full-period public history available inside the research window |
| CRWV | CoreWeave Class A | AI Cloud Infrastructure | IPO/post-2020 history only |
| QCOM | QUALCOMM | AI Compute / Edge AI | Full-period history available |

### Explicit exclusions from the prior candidate set

- `SNOW` — excluded because Snowflake is NYSE-listed, not Nasdaq-listed.
- `ARM` — excluded from the frozen US-company universe because it is a UK-domiciled foreign issuer; this project uses US-domiciled operating companies for the “US AI stocks” definition.

### Why the universe is 20 rather than 15

The assignment permits 15–20 names. A 20-name universe provides sufficient cross-sectional breadth for a pooled ML model while retaining a manageable manual fundamental-research burden.

The eventual portfolio may hold fewer than 20 names if the optimization framework produces zero/minimal positions under its constraints.

## 5. Source hierarchy for Phase 0

Exchange/listing status:

1. Nasdaq official pages;
2. SEC/company filing where necessary;
3. company investor-relations material as secondary confirmation.

Fundamental/company facts:

1. SEC filings;
2. company investor relations;
3. official annual/quarterly reports;
4. high-quality financial databases/news only as secondary evidence.

Historical market data:

1. Yahoo Finance via `yfinance` for the assignment dataset.

## 6. Historical market-data window

Frozen window:

```text
START = 2020-01-01
END   = 2026-09-22 inclusive EOD
```

Implementation note:

`yfinance` commonly treats the `end` argument as exclusive, so downloader code should use an exclusive endpoint after the desired final trading date and then verify the returned maximum date explicitly.

Do not assume the downloader returned the requested endpoint.

## 7. Security/history availability rule

If a security did not trade during part of the research window:

- keep the security in the universe;
- preserve its actual earliest valid date;
- never forward-fill prices into the pre-listing period;
- never create synthetic observations;
- mark pre-listing observations as structurally unavailable;
- exclude the name from a portfolio/backtest at times when it was not tradable.

## 8. Survivorship-bias disclosure

Because the 20-stock universe is selected using 2026 information and then examined backward, historical portfolio results are subject to survivorship/selection bias.

This limitation must be visible in the dashboard and final report.

A fully point-in-time historical universe reconstruction is outside this assignment unless explicitly added later.

## 9. Current/as-of-cutoff quantitative ranking layer

The ranking layer will evaluate the 20-name universe using current or as-of-cutoff information as defined by each factor. Some factors are market-derived rather than fundamental:

1. AI revenue exposure;
2. revenue growth;
3. FCF growth/quality;
4. valuation;
5. AI-capex exposure;
6. earnings revisions;
7. momentum;
8. volatility;
9. drawdown;
10. correlation/diversification value.

Scores must be standardized within the 20-name universe using a documented method.

No subjective “winner” labels may be added to the research output.

## 10. Predictive targets

Initial targets:

- `return_1d`
- `return_5d`
- `return_21d`
- `vol_5d`
- `vol_21d`
- `direction_5d`
- `direction_21d`

Exact target formulas will be specified in `DATA_CONTRACT.md` and implemented in the target factory.

## 11. Feature families

Initial features:

- lagged returns;
- momentum;
- moving-average/trend state;
- realized volatility;
- range/ATR-type measures;
- volume/liquidity proxies;
- technical indicators;
- relative strength to QQQ/SOXX/SPY;
- cross-sectional ranks;
- market-regime features.

Point-in-time availability is mandatory.

## 12. ML method

Primary estimator:

`LightGBM`

Use separate estimators for materially different target definitions/horizons.

The default training design is a pooled cross-sectional time-series dataset with ticker/category identifiers represented in a manner documented and validated for the LightGBM implementation.

## 13. Temporal validation

No random train/test split for market prediction.

Use walk-forward evaluation.

Where forward labels overlap, apply a purged/embargoed methodology appropriate to the label horizon.

Every OOS prediction must carry:

- prediction date;
- training period;
- validation period;
- model version;
- feature version;
- target version.

## 14. Portfolio baseline

Initial portfolio family:

- long-only;
- fully invested or explicitly cash-aware;
- position bounds;
- category concentration limits;
- covariance-aware risk penalty;
- turnover penalty;
- transaction-cost model;
- factor exposure constraints.

The illustrative constraints from planning are not yet numeric locks except where explicitly frozen later.

## 15. Required benchmarks

At minimum:

- QQQ;
- SOXX;
- SPY.

## 16. Required portfolio/risk metrics

At minimum:

- annualized return/CAGR;
- annualized volatility;
- Sharpe;
- Sortino;
- maximum drawdown;
- worst 30-day return;
- VaR;
- expected shortfall;
- annual turnover;
- transaction-cost-adjusted return;
- QQQ beta;
- SOXX beta;
- factor betas;
- pairwise correlations;
- marginal contribution to risk;
- component contribution to volatility.

## 17. Alpha attribution

At minimum, estimate a regression/attribution of portfolio returns to systematic factors including QQQ/Nasdaq exposure and SOXX/semiconductor exposure.

Additional factors must be explicitly documented.

Residual alpha must be reported with uncertainty statistics where appropriate.

## 18. Dashboard

The dashboard must provide:

1. Command Center;
2. AI Universe ranking;
3. Stock Intelligence;
4. ML Lab;
5. Portfolio Optimizer;
6. Risk Terminal;
7. Backtest;
8. Research Audit.

## 19. Compute/storage constraints

Local execution is restricted to lightweight engineering and research orchestration.

All material compute occurs in Colab.

Google Drive is the canonical artifact store.

Parquet is the default analytical storage format.

CSV should only be used where interoperability requires it.

## 20. Versioning

Current versions:

```text
SPEC_VERSION      = 0.1.0
UNIVERSE_VERSION  = 0.1.0
DATA_SCHEMA       = 0.1.0
FEATURE_SCHEMA    = 0.1.0
MODEL_SCHEMA      = 0.1.0
PORTFOLIO_SCHEMA  = 0.1.0
```

Any change affecting historical comparability requires a version increment and phase-log entry.

## 21. Phase-0 acceptance

Phase 0 is complete only when:

- all 20 names are exchange-verified;
- inclusion rationale exists for every name;
- exclusions are documented;
- historical-start limitations are documented;
- data window is frozen;
- survivorship limitation is explicitly acknowledged;
- universe artifact passes schema validation;
- `PHASE_LOG.md` records evidence and sources.
