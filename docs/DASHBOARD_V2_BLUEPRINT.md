# Dashboard V2 Blueprint — Terminal-Class Analytics for the Nasdaq AI Quant Research Terminal

- **Purpose**: define the v2 information architecture, widget inventory, and priority roadmap for the project dashboard, grounded in a survey of professional terminal/quant-platform UX and analytics patterns.
- **Scope**: front-end IA + panel inventory for the existing React/Vite dashboard; data mapping to current artifacts (`market.json`, `risk.json`, `backtest.json`, `fundamentals.json`, `models.json`, `portfolio.json`, `universe.json`, `run_manifest.json`, `clean_prices` parquet). No backend, no real-time feeds. Planning only: every item still requires owner/ChatGPT review before build.
- **Date**: 2026-10-16. **Status**: DRAFT (v2 planning). Does not override `PROJECT_SPEC.md`, `AGENTS.md`, or `DATA_CONTRACT.md`. If this document conflicts with them, they win.
- **Assumed constraints**: 20 Nasdaq names + QQQ/SOXX/SPY, daily EOD adjusted-close data 2020-01-01 → 2026-09-22 (frozen cutoff), computation on Colab, artifacts immutable/versioned, `clean_prices` columns `ticker/date/open/high/low/close/adj_close/volume/is_tradable/is_valid`.

## 1. Research findings

### 1.1 Bloomberg Terminal patterns analysts rely on

| Pattern | What it is | Implication for v2 | Source |
|---|---|---|---|
| Function-code command line | Applications are mnemonics typed into a command line and activated with `<GO>`; typing keywords surfaces matching functions. | The existing command palette becomes the primary nav: mnemonic-style aliases, deep links, recent list. | [Columbia guide](https://guides.library.columbia.edu/bloomberg/basic); [terminal manual excerpt](https://www.scribd.com/document/519532908/Bloomberg-Terminal-Manual) |
| Multi-panel workspace (Launchpad) | Saved workspaces of tabbed panels: monitors with editable columns, news panels, charts, chart grids; panels can be linked so changing a security updates the others; views are saved/shared. | Persistent layouts + linked "current ticker/date" context; URL-addressable state so views are bookmarkable/shareable. | [Launchpad guide](https://www.readkong.com/page/getting-started-on-bloomberg-launchpad-start-your-day-8978557) |
| Monitors, watchlists, alerts | Watchlists are live monitors; condition-based alerting is a first-class workflow (e.g. trade-signal alerts). | Our alerting is EOD/artifact-driven, not streaming: design it as a "research change feed" (new artifact, gate failure, threshold breach). | [Bloomberg Pro Tips: trade signal alerts](https://www.bloomberg.com/professional/insights/markets/bloomberg-pro-tips-create-trade-signal-alerts-on-the-terminal/) |
| Screeners and calendars | Equity screening for idea generation; market/corporate-action calendars; most-active and index-mover functions. | The 20-name table is the screener: add filter/sort/column presets and change columns; calendars are P2 (needs new data). | [CFI function list](https://corporatefinanceinstitute.com/resources/equities/bloomberg-functions-shortcuts-list/); [EQS screening guide](https://unibocconi.libguides.com/c.php?g=706997&p=5101015) |
| Fundamentals + earnings workflow | Company description, financial analysis, earnings summary/estimates, recommendations; earnings-season toolkits centered on calendars and surprise history. | Once Phase 1 lands: earnings strip + revision context; until point-in-time (PIT) fundamentals exist these stay CURRENT-STATE labeled, never predictive. | [CFI list](https://corporatefinanceinstitute.com/resources/equities/bloomberg-functions-shortcuts-list/); [Bloomberg earnings tools](https://www.bloomberg.com/professional/insights/markets/five-tools-to-enhance-your-earnings-season-analysis/) |
| Portfolio & risk analytics (PORT) | Multi-asset portfolio analytics: tracking-error volatility, VaR, performance attribution, factor risk models; stress testing via scenario analysis advertised with four types (factor-based, full-valuation, macroeconomic, climate). | Template for Risk Terminal + Portfolio Optimizer: TE/VaR first, attribution second, scenario builder (historical replay + hypothetical shocks). | [Bloomberg PORT](https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/); [PORT risk webinar](https://professional.content.cirrus.bloomberg.com/professional2023/insights/webinar/analysing-risk-characteristics-with-port/) |
| Enterprise risk (MARS) | Pre/post-trade scenario analysis and stress testing across portfolios; market/credit/counterparty suites. | Confirms scenario/stress belongs to portfolio analysis; we adopt a bounded subset with explicit model-basis labels. | [Bloomberg MARS](https://professional.bloomberg.com/products/risk/mars/) |
| Data extraction / export | Data pulled into Excel via add-in and Bloomberg Query Language (BQL); PORT workspaces support cached analysis and sharing. | Every table exportable (CSV/JSON) stamped with artifact version + as-of; "cached analysis" maps to our immutable versioned artifacts. | [BQL overview](https://michael-mao.gitbook.io/bloomberg/bql/bloomberg-query-language-bql); [BQL in Excel webinar](https://www.bloomberg.com/professional/insights/webinar/bloomberg-query-language-bql-as-a-tool-to-retrieve-data-for-analysis-in-excel/) |
| Daily research rhythm | Practitioners describe a loop: monitor market direction → screen to narrow → fundamentals/valuation checks → earnings expectations → watchlists/alerts to keep coverage current. | The IA roughly follows this loop already; v2 makes the flow explicit and cross-linked (one pivot per page). | [Gillier: terminal functions for analysts](https://oliviergillier.com/harnessing-bloomberg-terminal-key-functions-for-market-analysts/) |
| Cross-asset monitors (category) | Rate/FX/commodity/bond monitors exist as separate market-sector workspaces. | Out of scope here (single equity universe, no data) — see §4. Category described; no specific mnemonics asserted. | [CFI list](https://corporatefinanceinstitute.com/resources/equities/bloomberg-functions-shortcuts-list/) |

### 1.2 Comparable modern tools

| Tool | Observed pattern | Source |
|---|---|---|
| Koyfin | Alerts across watchlists/portfolios (price, valuation, technicals, news) on desktop/email/mobile with custom thresholds; reusable custom column views; custom dashboards; screener advertised with 5,900+ filters. | [Koyfin features](https://www.koyfin.com/features/) |
| TradingView | Multi-chart layouts with synchronized symbol/interval/crosshair; synchronized bar replay across all charts; watchlist alerts spanning multiple symbols with conditional operators. | [Multi-chart layouts](https://www.tradingview.com/support/solutions/43000629990-leveraging-multi-chart-layouts-in-your-analysis/); [synchronized replay](https://www.tradingview.com/blog/en/synchronized-bar-replay-45933/); [watchlist alerts](https://www.tradingview.com/support/solutions/43000739708-watchlist-alerts-your-trading-edge/) |
| LSEG Workspace | "Trusted data, market-moving news, analytics and AI in one connected experience"; data guide documents a Search app (discovery by asset class/market/geography), Quote app, chains, and a Python data library. | [LSEG Workspace](https://www.lseg.com/en/data-analytics/products/workspace); [LSEG Data Guide Ch.1](https://developers.lseg.com/content/dam/devportal/en_us/product-docs/lseg-data-guide/chapter01/) |
| FactSet | Performance measurement & attribution uniting front/middle office; multi-asset-class risk analytics; SPAR (style/performance/risk) engine exposed as an API. | [FactSet performance](https://www.factset.com/solutions/portfolio-analytics/performance); [FactSet risk](https://www.factset.com/solutions/portfolio-analytics/risk-analytics); [SPAR API](https://developer.factset.com/api-catalog/style-performance-and-risk-analysis-spar-engine-api) |
| S&P Capital IQ Pro | Single-company tearsheets ("historical profitability → future growth") plus screening/reporting; deep feature detail is paywalled (UNCERTAIN). | [CIQ tearsheet](https://pages.marketintelligence.spglobal.com/TD-Bank-Tearsheet-and-Financials-CIQ.html); [G2 reviews](https://www.g2.com/products/s-p-capital-iq-pro/reviews) |
| Portfolio Visualizer | Free toolkit: factor analysis/regression, factor performance attribution, efficient frontier, Black-Litterman, rolling optimization, Monte Carlo, CVaR/drawdown-based optimization. | [Portfolio Visualizer](https://www.portfoliovisualizer.com/analysis) |
| QuantConnect | Cloud research notebooks over curated datasets; backtest analysis; optimization analysis; applied-research templates include PCA and pairs trading. | [QC research](https://www.quantconnect.com/docs/v2/cloud-platform/research); [research engine](https://www.quantconnect.com/docs/v2/research-environment/key-concepts/research-engine) |
| Numerai | Scoring rewards correlation (CORR), meta-model contribution (MMC: covariance with target after neutralizing to the meta model) and feature-neutral correlation — "unique contribution after removing what already exists". | [CORR](https://docs.numer.ai/numerai-tournament/scoring/correlation-corr); [MMC](https://docs.numer.ai/numerai-tournament/scoring/meta-model-contribution-mmc) |
| Composer | No-code strategy backtesting; docs cover backtest period, initial investment, fees & slippage, benchmarks, and performance metrics. | [Composer backtests](https://www.composer.trade/learn/how-do-backtests-work-in-composer) |
| Sharpe.ai | "Sharpe Terminal" is a crypto-trading intelligence product (OI/funding/liquidation analytics); equities relevance limited (UNCERTAIN). | [Sharpe.ai](https://www.sharpe.ai/products) |

### 1.3 Quant analytics patterns worth copying

| Pattern | What it is | Source |
|---|---|---|
| Factor tear sheet | Alphalens surfaces returns, information coefficient, turnover, and grouped (sector) analysis from signal + prices. | [Alphalens](https://github.com/quantopian/alphalens) |
| IC as core metric | IC measures an alpha factor's predictive power; used to rank signals and track signal quality. | [PyQuant News on IC](https://www.pyquantnews.com/the-pyquant-newsletter/information-coefficient-measure-your-alpha) |
| Signal uniqueness | MMC subtracts the component already captured by the meta model; adapted here as correlation vs existing factor set + incremental IC. | [Numerai MMC](https://docs.numer.ai/numerai-tournament/scoring/meta-model-contribution-mmc) |
| PCA / statistical risk | Turns correlated returns into uncorrelated components ordered by variance; first PC usually ≈ market risk; limitations: regimes, non-linearity. | [QuestDB PCA](https://questdb.com/glossary/principal-component-analysis-pca-for-portfolio-risk/) |
| Correlation regimes | Correlations are regime-dependent and spike toward 1 in crises (2022: 60/40's worst year since 1937); diversification silently disappears. | [eco3min regimes](https://eco3min.fr/en/market-regimes-liquidity-real-rates-financial-dynamics/asset-class-correlations-regime-shifts/) |
| Stress & scenarios | Two families: historical replay (realized windows) and hypothetical shocks; PORT advertises factor/macro/full-valuation/climate scenario types; MARS markets pre/post-trade stress. | [PORT](https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/); [MARS](https://professional.bloomberg.com/products/risk/mars/) |
| Event studies | Estimation window (normal-return model, e.g. market model OLS) → event window → abnormal returns → CAR/CAAR tests; contaminated estimation windows bias results. | [EventStudyTools](https://www.eventstudytools.com/introduction-event-study-methodology); [MacKinlay 1997](https://banksandmarkets.files.wordpress.com/2024/03/1997_mackinlay-eventstudieseconomics.pdf) |
| Execution & capacity | Implementation shortfall = paper gain − actual gain (commissions, impact, delay, opportunity cost vs decision price); participation rate ≈ order/market volume with institutional caps ≈5–10% ADV; capacity set by liquidity/turnover, not backtests. | [Implementation shortfall](https://ryanoconnellfinance.com/implementation-shortfall/); [capacity/impact](https://linitics.com/quant-liquidity/) |
| Benchmark-relative & attribution | Up/down capture separates rising vs falling-market behavior; Brinson decomposes active return into allocation, selection, interaction (BF vs BHB variants). | [Capture ratios](https://ryanoconnellfinance.com/up-capture-down-capture/); [Brinson](https://ryanoconnellfinance.com/brinson-attribution-model/) |
| Point-in-time discipline | Backtests break via restatements, reporting lag, and survivorship; PIT data timestamps when information became available, not when the period ended. | [StockFit PIT](https://developer.stockfit.io/blog/point-in-time-data-backtesting) |
| Breadth / internals | Advance-decline ratios, % of names above moving averages, and 52-week highs/lows measure participation "under the hood" of an index. | [BuildAlpha breadth](https://www.buildalpha.com/market-breadth/); [StockCharts AD%](https://chartschool.stockcharts.com/table-of-contents/market-indicators/advance-decline-percent) |
| Factor risk models | Barra-style equity models measure factor exposures, manage risk, and attribute performance through a factor lens (market/sector/style families). | [MSCI equity factor models](https://www.msci.com/data-and-analytics/factor-investing/equity-factor-models) |

### 1.4 What is realistically buildable here

- Gating reality: daily EOD only; 20 names (PLTR and CRWV have partial history — `market.json.start_idx` 188 and 1316); frozen cutoff 2026-09-22; artifacts static JSON hashed in `run_manifest.json`; no streaming, no order-book, no vendor feeds.
- Buildable now (P0): navigation shell (command palette, linked context, as-of), screener density upgrades, regime/breadth monitors from `clean_prices`, benchmark-relative stats (TE/IR/capture), PCA decomposition, liquidity/capacity tables, richer backtest diagnostics, scenario builder v1, audit upgrades, exports.
- Buildable after pending phases (P1): real signal tear sheets (`models.json` already defines `ic_series`, `decay`, `quantiles`, `feature_importance`, `folds` per target), real portfolio-weight views, Brinson-category attribution, PIT-gated fundamentals UI.
- Only with new data (P2): earnings event studies, full PIT fundamentals, macro-calibrated scenarios, clustering/regime models.
- Misleading if forced: options analytics, tick TCA, streaming, cross-asset monitors, full Barra-style factor model on 20 names (sparsity) — see §4.

## 2. Proposed information architecture

**Guiding rules** (all pages): (1) every panel declares data source, as-of, and REAL/SYNTHETIC/PENDING status — no unlabeled numbers; (2) global context is (as-of date, focused ticker, benchmark); any click updates it and any URL encodes it; (3) EOD-honest language — "as of", "latest available", "artifact vX", never implied real-time; (4) one page = one job, cross-link rather than duplicate; (5) client-side math only for display transforms — anything material is computed on Colab and shipped as a versioned artifact.

### 2.0 Shell (all pages)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| SH-1 | Command palette v2 | Global search/launch: mnemonic aliases (PORT→Risk, EQS→Universe, DES→Stock, MLL→ML Lab, BT→Backtest, AUDIT→Audit), ticker/date jump, recent-visited list. | Terminal muscle memory: keyboard-first navigation; mnemonics make the IA learnable. | Existing routes; new: route registry with aliases. |
| SH-2 | Global as-of selector | Date context bounded per artifact `as_of` (default 2026-09-22); panels disable ranges they don't cover. | Prevents accidental look-ahead in reviews; enables reproducing historical states. | Existing `market.json.dates`, `risk.json.as_of`, `backtest.json.oos_end`; new: uniform `as_of` across artifacts. |
| SH-3 | Linked context / ticker focus | Click a ticker anywhere → linked panels pivot (price, factors, risk, liquidity). | Launchpad-style component linking: one click answers "how does this name look everywhere". | Existing artifacts are keyed by ticker. |
| SH-4 | Provenance badges + footer | Per-panel badge REAL/SYNTHETIC/PENDING + artifact file/version + short SHA; footer = run manifest, cutoff, generated_at. | Auditability is a project gate; synthetic files must never read as research output. | `manifest.json.real_vs_synthetic`, `run_manifest.json.ledger`, file hashes. |
| SH-5 | Export menu | Copy as TSV / download CSV or JSON of current view, stamped with as-of, filters, artifact version. | Reviewers take views into Colab/Excel with provenance intact. | Existing panel data; new serializer with provenance header. |
| SH-6 | Watchlist rail | Pinned tickers (localStorage): last price, 1d/21d change, flag state; feeds SH-3. | Persistent coverage without re-searching. | `market.json.levels/returns`. |

### 2.1 Command Center (modified)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| CC-1 | Regime strip | Vol regime (QQQ realized-vol percentile), correlation regime (63d avg pairwise ρ with bands), breadth (% names > 50/200d MA), drawdown state, cross-sectional dispersion. | Single-glance context before analysis; correlation/breadth are early warnings of diversification failure. | `market.json` + `clean_prices`; **needs new data: `regimes.json` derivative artifact (Colab, light)**. |
| CC-2 | Change/research feed | Chronological events: new artifact version, gate pass/fail, universe decisions, threshold breaches (vol/corr/drawdown), phase completions. | Turns alerting (terminal staple) into an EOD "what changed since I last looked" feed. | `run_manifest.json.validation/ledger`, PHASE_LOG; **needs new data: `events.json` appended by build/CI**. |
| CC-3 | KPI row (upgrade) | CAGR/vol/Sharpe/Sortino/maxDD: EW_UNIVERSE vs QQQ/SOXX/SPY; ML placeholder visibly flagged; basis labels (gross/net, book identity). | Existing strength; labels remove ambiguity about what is being measured. | `backtest.json.performance`. |
| CC-4 | Performance + drawdown (upgrade) | Cumulative curves (log toggle), underwater drawdown, benchmark overlays, event markers (artifact versions, regime dates). | Drawdown anatomy is the first review question; markers tie P&L to research events. | `backtest.json.series`; markers from CC-2. |
| CC-5 | AI theme tape (upgrade) | 20-name tape sorted by 1d/21d move with category tags (SEMI/HYPER/SOFT), click-through to Stock Intelligence. | Keeps the "what moved" loop; now wired into linked context. | `market.json.returns`; category map from `universe.json` (prefer) or `portfolio.json.sector_of` (synthetic — flag). |

### 2.2 AI Universe (modified screener)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| UNI-1 | Screener table v2 | Existing factor scores + liquidity block (UNI-2), relative strength vs QQQ/SOXX, rolling β/σ, history-window badge for PLTR/CRWV. | Terminal screener density: one row per name, everything comparable and sortable; partial history must be visible (unbalanced panel = known bias vector). | `fundamentals.json.constituents`, `risk.json.per_ticker`, `market.json.start_idx`; **needs new data: `liquidity.json`, `stock_stats.json` (Colab)**. |
| UNI-2 | Liquidity block | ADV20/ADV60 in $, days-to-liquidate at 5%/10% participation for a reference notional, capacity flag. | Every strategy dies on capacity; participation caps ≈5–10% ADV are standard practice. | `clean_prices.volume/close` → **needs new data: `liquidity.json`**. |
| UNI-3 | Percentile heat + column presets | Within-column percentile coloring; presets Momentum / Risk / Liquidity / (P1) Fundamentals; visibility saved. | 20×N matrices become readable; presets mirror Koyfin custom views. | Client-side + localStorage. |
| UNI-4 | Filter builder | Predicate list (category, vol/beta ranges, score percentile, liquidity floor). | EQS-style narrowing; essential once fundamentals land. | P0: existing numeric fields; P1: gated fundamentals. |
| UNI-5 | Factor detail drawer | Per-name expanded: factor contributions, rank, percentile, definitions/weights from `factor_defs`. | Prevents the composite score from being a black box. | `fundamentals.json`. |
| UNI-6 | Fundamental columns (P1) | Revenue growth, FCF quality, revisions, fwd P/E, AI exposure — shown only when `fundamental_factors_pending=false`, with CURRENT-STATE label. | Phase-1 payoff; PIT eligibility must gate any historical/predictive use. | `fundamentals.json` nulls; **needs new data: sourced PIT fundamentals**. |

### 2.3 Stock Intelligence (modified)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| SI-1 | Price context + events (existing, upgrade) | Levels vs benchmarks, drawdown panels, markers for dividends/splits and flagged gaps. | Sanity checks before modeling; corporate actions explain jumps. | `market.json`; **needs new data: `corporate_actions.json` exported from parquet (light script)**. |
| SI-2 | Rolling risk panel | Rolling β/σ (63/126/252d) vs QQQ & SOXX, R² drift; current values anchored to `risk.json.per_ticker`. | Static betas hide regime changes. | `clean_prices` → **needs new data: `stock_stats.json`**. |
| SI-3 | Relative-strength panel | RS ratio vs QQQ/SOXX over 21/63/126/252d + percentile vs own history. | Faster read of leadership/rotation than raw price. | `market.json.benchmarks` → `stock_stats.json`. |
| SI-4 | Drawdown anatomy | Top-5 drawdowns: depth, length, recovery time; current drawdown age. | "How long underwater" matters for mandates and capacity, not just depth. | Existing series; client-side + `stock_stats.json`. |
| SI-5 | Liquidity panel | ADV, days-to-liquidate at 5/10%, volume percentile, exit horizon. | Per-name capacity view; links to RT-10. | `clean_prices.volume` → `liquidity.json`. |
| SI-6 | Peer correlation top-5 | Highest/lowest five pairwise correlations from the matrix, cluster hint. | Natural pairs for diversification vs concentration risks. | `risk.json.correlation`. |
| SI-7 | Distribution stats | Skew, kurtosis, best/worst days, gap stats, per-name VaR/ES from returns. | Fat tails and gaps break Gaussian assumptions in models and VaR. | `market.json.returns`, `risk.json`; client-side. |
| SI-8 | Event study panel (P2) | CAR around earnings/announcement dates with estimation/event windows (MacKinlay design). | Standard event inference; requires reliable event dates. | **needs new data: earnings/event dates + announcement timestamps**. |
| SI-9 | History-window badge | "Full (1689d)" vs "Partial (PLTR from 188, CRWV from 1316)". | Makes the unbalanced panel explicit wherever stats are shown. | `market.json.start_idx`. |

### 2.4 Risk Terminal (modified; add tabs)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| RT-1 | Correlation matrix (existing) | 20×20, clustering-order toggle, hover pair detail, Δ vs previous artifact. | Core tool; deltas show correlation drift between artifacts. | `risk.json.correlation`; Δ needs prior artifact version. |
| RT-2 | Vol/beta map (existing) | Vol vs beta scatter colored by category; benchmark toggle (QQQ/SOXX/SPY). | Positioning: cheap vs expensive risk at a glance. | `risk.json.per_ticker`. |
| RT-3 | VaR/ES panel (existing, upgrade) | Portfolio VaR/ES 95/99 daily, Gaussian vs historical comparison, worst historical windows. | Surfaces tail-model risk; non-Gaussian tails are the norm. | `risk.json.portfolio`, `backtest.json.series`; client-side. |
| RT-4 | Covariance diagnostics (existing) | Ledoit-Wolf shrinkage intensity, condition numbers raw vs shrunk, window/observations, note. | The estimator explains optimizer instability; it is itself a research artifact. | `risk.json.covariance`. |
| RT-5 | Risk budget (existing, upgrade) | MCTR/CCTR table + risk-per-unit-weight; effective-names/Herfindahl trend. | Hidden risk concentration; EW baseline: HHI 0.05, 20 effective names. | `risk.json.mctr/cctr/portfolio`; trend needs `regimes.json`. |
| RT-6 | Benchmark-relative panel | TE vs each benchmark, IR, up/down capture + asymmetry, β/R², active-return stats. | The institutional scorecard beyond raw Sharpe. | `market.json`/`backtest.json` → **needs new data: `benchmark_rel.json`**. |
| RT-7 | Correlation regime monitor | Rolling 63d avg + max pairwise ρ vs historical bands; dispersion; "diversification stress" flag when avg ρ > P90. | Correlations spike in crises; EW diversification is regime-dependent. | `clean_prices` → `regimes.json`. |
| RT-8 | PCA / statistical decomposition tab | Variance explained PC1–PC5, loading heatmap, PC1≈market interpretation, portfolio PC exposures. | With 20 names and no full factor model, PCA is the honest statistical decomposition. | `clean_prices`/covariance → **needs new data: `pca_risk.json` (Colab + methodology note)**. |
| RT-9 | Scenario builder v2 | (a) Historical replay: realized factor moves from named windows (COVID 2020, 2022 drawdown, custom) applied to the current book; (b) hypothetical: benchmark ±X% mapped via betas + single-name ±2σ shocks; P&L and post-shock stats; labeled as β/covariance approximation, not full revaluation. | PORT-style scenario analysis is the most-requested risk feature; basis must be explicit. | `risk.json.stress/betas/covariance`; v1 client-side, optional `stress_v2.json`. |
| RT-10 | Liquidity / capacity panel | Portfolio days-to-liquidate at 5/10% participation (binding name), capacity at 10%, largest liquidity-weighted position. | Capacity is a hard constraint backtests ignore. | `liquidity.json` + `risk.json.reference_weights`. |

### 2.5 ML Lab (P1 — replace placeholder with real signal research)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| ML-1 | Target scorecard | Per target (1d/5d/21d return, 5d/21d vol, 5d/21d direction): OOS IC mean/std, ICIR, hit rate, R², RMSE/MAE, OOS rows, REAL/SYNTHETIC badge. | Makes the 7-target matrix comparable at a glance. | `models.json.targets` (synthetic until real signals ship). |
| ML-2 | IC decay chart | IC by forecast horizon (1/5/21d) + full decay curve per signal. | Alphalens-style decay defines the viable rebalance horizon. | `models.json.targets[*].decay/ic_series`. |
| ML-3 | Quantile spread | Mean forward return by prediction quantile (Q1..Q5), Q5−Q1 spread, monotonicity score, hit rate by quantile. | Monotone quantiles = usable ranking; flat = noise. | `models.json.targets[*].quantiles`. |
| ML-4 | Turnover diagnostics | Turnover of top-quantile portfolio per rebalance; turnover-adjusted IC; implied cost drag at 10bps round trip. | IC without turnover is meaningless; cost drag kills paper alpha. | `models.json` + `backtest.json.cost_bps_round_trip`; needs per-rebalance signal turnover series (P1). |
| ML-5 | Fold stability | Walk-forward fold table: train/val/test windows, per-fold IC, degradation val→test. | Guards against data snooping and unstable edges. | `models.json.targets[*].folds`. |
| ML-6 | Feature importance | Importance per feature + stability across folds. | Explains signal behavior; flags leakage candidates. | `models.json.targets[*].feature_importance`. |
| ML-7 | Signal correlation & uniqueness | Pairwise corr of candidate signals; corr vs existing market-derived factors (momentum/vol/drawdown/diversification) and benchmarks; incremental IC vs factor set (Numerai-MMC analog); gate target corr <0.20 where a comparison set exists. | New alpha must not re-skin existing factors. | `models.json` + `fundamentals.json` scores; needs per-name signal history artifact (P1). |
| ML-8 | Regime-conditional IC | IC split by vol/correlation/drawdown regimes. | Distinguishes a regime bet from a robust edge. | `regimes.json` + signal history (P1). |
| ML-9 | Methodology & leakage card | Purged + embargoed walk-forward statement, label horizons, feature-cutoff conventions, relevant quality-gate results. | The model card reviewers need before trusting numbers. | `models.json.validation`, `QUALITY_GATES.md`, `run_manifest.json.validation`. |

### 2.6 Portfolio Optimizer (P1 — real weights)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| PO-1 | Weight construction view | Optimized vs unconstrained vs equal-weight bars; active weights vs EW book; per-name contribution to predicted return/vol. | Shows what constraints cost (unconstrained→constrained gap). | `portfolio.json.weights/unconstrained_weights/equal_weight` (synthetic now), `risk.json.reference_weights`. |
| PO-2 | Constraint diagnostics | The 12 constraints with enforced/binding status + impact note per binding constraint. | Binding constraints explain optimizer surprises. | `portfolio.json.constraints`. |
| PO-3 | Category exposure bars | SEMI/HYPER/SOFT exposures vs reference; style mini-map (factor scores weighted by portfolio weights). | Theme concentration is the main risk in a 20-name AI universe. | `portfolio.json.category_exposures/sector_of` + `fundamentals.json` scores. |
| PO-4 | Turnover & cost timeline | Turnover per rebalance (26 dates), annualized turnover, cost bps per rebalance, cumulative drag, breakeven holding period. | Turnover is the silent strategy killer; cost must be visible at weight selection. | `portfolio.json.rebalance_dates/turnover/cost_bps/annual_turnover`. |
| PO-5 | Predicted vs realized | Predicted μ/σ inputs vs subsequent realized 21d return/vol per rebalance. | Closes the prediction→outcome loop. | `portfolio.json.prediction_inputs` + `market.json.returns`; tracking needs accumulated artifacts. |
| PO-6 | Weight stability | Rank correlation of weights vs previous rebalance; name-level churn heatmap. | High churn without signal change = optimizer noise. | Needs weight history — **needs new data: per-rebalance weight artifact**. |
| PO-7 | Risk budget for real book | MCTR/CCTR computed for optimized weights (not just EW). | Aligns RT-5 with the actual book. | **needs new data: risk.json variant keyed to portfolio weights**. |
| PO-8 | Optimization provenance | Objective/optimizer/solver versions, constraints version, inputs hash, generated_at. | Reproducibility of the portfolio artifact itself. | `portfolio.json.optimizer_version/objective_version/portfolio_version` + manifest. |

### 2.7 Backtest (modified)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| BT-1 | Equity curves (existing, upgrade) | Log toggle, net-of-cost overlay (10bps), benchmark set, regime shading; ML_PORTFOLIO labeled SYNTHETIC in-chart. | Core chart; shading + net overlay prevent misreads. | `backtest.json.series/performance`. |
| BT-2 | Rolling metrics | Rolling 126d Sharpe, vol, β to QQQ; rolling TE once RT-6 lands. | Averages hide regime decay; point-in-time robustness. | `backtest.json.series`; client-side or `benchmark_rel.json`. |
| BT-3 | Underwater + drawdown table | Underwater curve + top-5 drawdowns (depth/length/recovery) per series and benchmark. | Reviewers ask "when was it worst, how long". | Existing series; client-side. |
| BT-4 | Worst periods | Worst 30d/63d windows with top-3 name contributions. | Converts a scary number into names for post-mortem. | `backtest.json.series`, `market.json.returns`; client-side contribution math. |
| BT-5 | Benchmark-relative | TE, IR, up/down capture, active-return distribution, β stability. | Institutional scorecard complementing CC-3 Sharpe. | `benchmark_rel.json` (shared with RT-6). |
| BT-6 | Factor attribution (existing, upgrade) | OLS vs QQQ+SOXX (r² 0.8995, t-stats, residual alpha/vol) + rolling t-stat view; states it describes the EW book, not ML. | Existing strength; rolling view tests alpha stability. | `backtest.json.attribution`; rolling needs recompute artifact. |
| BT-7 | Brinson category attribution (P1) | Allocation/selection/interaction across SEMI/HYPER/SOFT (BF variant), portfolio vs EW-universe benchmark. | Separates theme bets from stock picking once real weights exist. | **needs new data: real weights + category benchmark returns**. |
| BT-8 | Cost & capacity sensitivity | Net Sharpe at 5/10/20bps round trip; strategy capacity at 5/10% participation. | Stress-tests execution assumptions before anyone believes the curve. | `backtest.json.cost_bps_round_trip`, `portfolio.json.turnover`, `liquidity.json`. |
| BT-9 | Yearly + monthly matrix | Yearly returns by series (exists) + year×month heat matrix + best/worst months. | Seasonality/streak analysis; monthly matrix is a terminal classic. | `backtest.json.yearly` + monthly recompute from series. |

### 2.8 Research Audit (modified)

| ID | Widget | What it shows | Why a quant cares | Data requirements |
|---|---|---|---|---|
| AU-1 | Surface ledger (existing, upgrade) | REAL/SYNTHETIC/PENDING per data surface with source links; searchable; PENDING shows blocking phase. | Single source of truth for what may be cited as research output. | `manifest.json.real_vs_synthetic`, `run_manifest.json.ledger/pending_real_artifacts`. |
| AU-2 | Quality-gate board | Gate → status (PASS/FAIL/OPEN) → evidence → timestamp; failures highlighted. | Gates are project acceptance criteria; the dashboard must not silently pass. | `run_manifest.json.validation`, `QUALITY_GATES.md` (sync needed). |
| AU-3 | Artifact registry | File → version → short SHA256 → rows → window → generated_at; diff vs previous version. | Reviewer can verify exact bytes behind any number. | `run_manifest.json.files/parquet/clean_panel`. |
| AU-4 | Lineage sketch | Small DAG: artifact ← generator notebook/script ← input artifacts (2–3 levels). | Answers "what produced this file" without git archaeology. | Manifest + PHASE_LOG; new lineage block in manifest. |
| AU-5 | Decision log (existing, upgrade) | Dated decisions with rationale/source and affected surfaces; links to PHASE_LOG. | Project history for future re-reviews. | PHASE_LOG.md (sync mechanism needed). |
| AU-6 | Pending-phase tracker | Phase → status → expected artifacts; mirrors `pending_real_artifacts`. | Honest expectations for what the dashboard can show. | `run_manifest.json.pending_real_artifacts`. |

## 3. Priority roadmap

Effort scale (front-end effort; Colab artifact work noted separately): **S** ≈ ≤1 dev-day, **M** ≈ 2–5 dev-days, **L** ≈ 1+ week.

### P0 — buildable now from existing data (plus light Colab derivative artifacts)

| # | Item (widget IDs) | Effort | Dependencies |
|---|---|---|---|
| P0-1 | Shell: command palette v2, as-of selector, linked context, provenance badges, export menu, watchlist rail (SH-1..SH-6) | M | None; consumes all artifacts. |
| P0-2 | `regimes.json`: rolling 63d avg/max pairwise ρ, realized-vol percentiles, breadth (% > 50/200d MA), dispersion, drawdown state, effective-names trend | S (Colab) + M (UI: CC-1, RT-7) | `clean_prices`; define eligible-name logic for partial histories (SI-9). |
| P0-3 | `liquidity.json`: ADV20/60 in $, days-to-liquidate @5/10% participation, capacity for reference notional | S (Colab) + S (UI: UNI-2, SI-5, RT-10, BT-8) | `clean_prices.volume`; reference notional is OQ-3. |
| P0-4 | `stock_stats.json`: rolling β/σ (63/126/252d), RS vs QQQ/SOXX (21/63/126/252d) | S (Colab) + S (UI: UNI-1, SI-2, SI-3) | `clean_prices`, `market.json.benchmarks`. |
| P0-5 | `benchmark_rel.json`: TE, IR, up/down capture + asymmetry, active-return stats for EW book + benchmarks | S (Colab) + M (UI: RT-6, BT-5) | `market.json`/`backtest.json` series. |
| P0-6 | `pca_risk.json`: eigendecomposition, variance explained PC1–5, loadings, PC1≈market note, portfolio PC exposures | M (Colab + methodology note) + M (UI: RT-8) | `risk.json.covariance` or fresh window; document regime/non-linearity limitations. |
| P0-7 | `corporate_actions.json` from parquet for event markers | S | Parquet already hashed in run manifest. |
| P0-8 | Scenario builder v1: historical replay + β-mapped hypothetical shocks (RT-9) | M | `risk.json.stress/betas/covariance`; label approximation basis in UI. |
| P0-9 | Backtest upgrades: rolling metrics, underwater/top drawdowns, worst periods w/ name contributions, monthly matrix (BT-2, BT-3, BT-4, BT-9) | M | Existing series; client-side math with unit tests. |
| P0-10 | Command Center upgrades: regime strip, change-feed skeleton, KPI basis labels (CC-1..CC-4) | M | P0-2; CI hook for `events.json` (OQ-8). |
| P0-11 | Research Audit upgrades: gate board, artifact registry w/ SHAs, lineage sketch, pending tracker (AU-2..AU-4, AU-6) | M | Manifest; small sync format for QUALITY_GATES/PHASE_LOG. |
| P0-12 | Table polish: percentile heat, column presets, history badges, client-side distribution stats (UNI-3, SI-7, SI-9) | S | Client-side only. |

### P1 — after pending phases (fundamentals / signals / weights)

| # | Item (widget IDs) | Effort | Dependencies |
|---|---|---|---|
| P1-1 | Real signal tear sheets: scorecard, IC decay, quantiles, turnover, folds, importance, methodology card (ML-1..ML-6, ML-9) | L | Real trained-signal artifact replacing synthetic `models.json`; per-signal turnover series. |
| P1-2 | Signal correlation/uniqueness matrix incl. incremental IC vs factor set (ML-7) | M | P1-1 + factor scores (`fundamentals.json`). |
| P1-3 | Regime-conditional IC (ML-8) | S/M | P0-2 + P1-1. |
| P1-4 | Portfolio Optimizer page complete (PO-1..PO-8) | L | Real `portfolio.json` + weight history + risk variant keyed to real weights. |
| P1-5 | Brinson category attribution + rolling factor attribution (BT-6, BT-7) | M | Real weights + category benchmark returns. |
| P1-6 | Valuation/fundamental screener + filter builder (UNI-4, UNI-6) | M | PIT fundamentals; gate historical contexts, CURRENT-STATE label otherwise. |
| P1-7 | In-app alert rules v1: threshold breaches (vol/corr/drawdown/turnover), artifact/gate events, PENDING→REAL transitions | M | P0-2/P0-3 + events feed; EOD cadence. |
| P1-8 | Weight stability + predicted-vs-realized loop (PO-5, PO-6) | M | Accumulated weight history. |
| P1-9 | Persona layouts via URL state (Risk Reviewer / PM / Data Auditor) | S/M | SH-2; localStorage persistence. |

### P2 — needs new data sources / research

| # | Item (widget IDs) | Effort | Dependencies |
|---|---|---|---|
| P2-1 | Earnings calendar + event studies (SI-8): CAR with estimation/event windows | L | **needs new data: earnings dates + announcement timestamps (PIT)**; methodology per MacKinlay. |
| P2-2 | Full PIT fundamentals pipeline feeding UNI-6/PO-3 | L | **needs new data: sourced PIT dataset (availability timestamps)**. |
| P2-3 | Macro-calibrated scenarios (PORT macro-type analog) | L | **needs new data: macro/rates series + calibration method**; label model risk. |
| P2-4 | Statistical clustering / dendrogram + hierarchical risk parity preview | M | Correlation-distance clustering on top of P0-6. |
| P2-5 | Turnover-cost calibration per name (spread/volume-based impact) | M | **needs new data: spread estimates** (OHLC-only proxy as labeled fallback). |
| P2-6 | Earnings/event overlays in backtests and factor tests | M | P2-1. |

**Sequencing notes (draft).** Recommended P0 order: P0-1 → P0-7 → P0-4 → P0-2 → P0-10 → P0-9 → P0-5/P0-6 → P0-8 → P0-11 → P0-12 → P0-3 (mostly independent once artifacts exist). Standardize artifact conventions before P0-2..P0-6: `<name>_v001.json` with `as_of`, `version`, `generated_at`, `generator`, and `inputs{}` hashes registered in the run manifest — this keeps AU-3 automatic. Every new UI stat ships with a fixture-based unit test and a provenance badge.

## 4. What NOT to build

Context: single 20-name Nasdaq equity universe, daily EOD adjusted close, frozen 2020→2026-09-22 window, no tick data, no options/FX/bonds/futures/commodities. Therefore:

1. **Options analytics** — no chains, IV, or greeks data; anything shown would be fabricated. Out.
2. **Tick-level TCA / microstructure** — no bid/ask or order book. P2-5 (spread proxy, clearly labeled) is the only bounded exception.
3. **Real-time / streaming monitors** — data is EOD with a frozen cutoff; no blinking "live" UIs, no intraday clocks, no streaming sockets.
4. **Cross-asset monitors (rates/FX/credit/commodities)** — no instruments or data; AI-theme risk is expressed via QQQ/SOXX only.
5. **Options-flow, short-interest, borrow, institutional-holdings screens** — no data in scope; do not proxy with unreliable scrapes.
6. **News sentiment, transcripts, social feeds** — no licensed feed; AI-written commentary without sources violates project rules (no fabricated claims).
7. **OMS / execution management / paper trading / broker connections** — this is a research terminal, not a trading system.
8. **Multi-user collaboration, chat, sharing/permissions** — single-owner research tool; URL-shareable views are the ceiling.
9. **Mobile app** — desktop-first dense analytic tables; not a scope target.
10. **Monte Carlo "wealth projection" as headline analytics** — misleading without validated return models; if ever added, only as a clearly labeled simulation (P2+), never on the Command Center.
11. **Full Barra-style fundamental factor risk model on 20 names** — industry/style cross-sectional estimation on 20 observations is statistically dishonest; use the existing Ledoit-Wolf covariance + PCA (P0-6) and say so.
12. **Features that visually elevate synthetic files** — while `models.json`, `portfolio.json`, and the ML_PORTFOLIO curve are synthetic, no feature may present them as research conclusions; watermarks/badges only.
13. **Universe scope creep** — no 100+ name screens, no generic market pages; the 20-name universe is the product.

## 5. Open questions for the owner

1. **OQ-1 As-of default**: latch the dashboard to the frozen cutoff (2026-09-22), or default to "latest artifact" when Colab refreshes? (Suggested: display cutoff, allow artifact-version selection.)
2. **OQ-2 Artifact layout**: extend `risk.json` for new stats, or adopt per-domain artifacts (`regimes.json`, `liquidity.json`, `pca_risk.json`)? (Suggested: per-domain, versioned, manifest-registered.)
3. **OQ-3 Liquidity reference book**: capacity needs a notional — pick e.g. $25M/$50M sleeve for days-to-liquidate; participation cap 5% or 10%?
4. **OQ-4 Benchmark primacy**: QQQ, SOXX, or a blended policy benchmark for TE/IR and Brinson comparisons?
5. **OQ-5 PCA presentation**: which window (single trailing vs rolling 63d), and how much interpretation of PCs (PC1 "market", PC2 sector) is acceptable before it overclaims? UNCERTAIN pending methodology review.
6. **OQ-6 Alert delivery**: in-app feed/badges only, or also email/webhook? Is EOD cadence acceptable (it must be)?
7. **OQ-7 Fundamentals gating**: confirm CURRENT-STATE labeling and exclusion from predictive panels until a PIT policy is approved (AGENTS §8).
8. **OQ-8 Events feed mechanics**: generate `events.json` in CI from `run_manifest.json` + gate results, or require manual curation per event?
9. **OQ-9 Scenario loss units**: percent P&L, dollar P&L on a reference book, or both? ($ depends on OQ-3.)
10. **OQ-10 Mnemonics**: adopt alias map (PORT/EQS/DES/MLL/BT/AUDIT) or use plain page names to avoid imitating Bloomberg?
11. **OQ-11 State persistence**: shareable URL state only, or also per-user localStorage persistence (single-owner environment)?
12. **OQ-12 Page set**: confirm v2 keeps the current 8 pages with no new top-level pages (recommended), or approve a separate Monitor/Watchlist page.

---

*End of draft. Change control: any accepted items move into `PLAN.md` / `PHASE_LOG.md` with a version bump per `AGENTS.md` §14 before implementation.*
