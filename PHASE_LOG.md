# PHASE_LOG.md — Research State and Decision Ledger

## Current state

- Phase 0A: `COMPLETE`
- Phase 0: `COMPLETE`
- Phase 1: `READY`
- Phase 3: `IN REVIEW` — first real market-data bundle acquired via live mode (23/23 series, validation PASS, audit 103/103); installed into dashboard (partial-real). Parquet awaiting Drive upload.
- Phase 11 (Dashboard): `IN REVIEW` — frontend complete and provenance-driven; consuming synthetic fixtures until Phase 3-10 artifacts land

## Decision ledger

| ID | Date | Phase | Decision | Evidence | Status |
|---|---|---|---|---|---|
| D0001 | 2026-09-25 | 0A | Local laptop is control plane only; Colab is compute plane | User task specification | LOCKED |
| D0002 | 2026-09-25 | 0A | Google Drive is canonical durable artifact store | User task specification | LOCKED |
| D0003 | 2026-09-25 | 0A | Parquet is default analytical storage format | Project architecture | LOCKED |
| D0004 | 2026-09-25 | 0A | Historical window frozen at 2020-01-01 through 2026-09-22 EOD | Project specification | LOCKED |
| D0005 | 2026-09-25 | 0 | `SNOW` excluded because NYSE-listed | Nasdaq official market listing evidence | LOCKED |
| D0006 | 2026-09-25 | 0 | `ARM` excluded because UK-domiciled foreign issuer | SEC EDGAR CIK 0001973239, jurisdiction England and Wales | LOCKED |
| D0007 | 2026-09-25 | 0 | 20-name universe verified: all Nasdaq-listed, all US-domiciled, all AI-categorized | `artifacts/manifests/universe_verification_v001.json`; 131/131 schema validation tests passed | LOCKED |
| D0008 | 2026-09-25 | 0 | Universe version 0.1.0 frozen | Validation script `scripts/local/validate_universe.py` exit 0 | LOCKED |
| D0009 | 2026-09-25 | 0 | MSFT incorporated in Washington (not Delaware); valid US domicile | SEC filing / company IR | NOTED |
| D0010 | 2026-09-25 | 0 | MRVL redomiciled from Bermuda to Delaware April 2021; current entity is US-domiciled | SEC EDGAR CIK 1835632 | NOTED |
| D0011 | 2026-09-25 | 0 | DDOG redomiciled from Delaware to Nevada April 2026; remains US-domiciled | SEC filing / investor relations | NOTED |
| D0012 | 2026-09-25 | 0 | AVGO redomiciled from Singapore to Delaware April 2018; current entity is US-domiciled | SEC filing, Certificate of Incorporation | NOTED |
| D0013 | 2026-09-25 | 0 | PLTR transferred listing from NYSE to Nasdaq November 2022; confirmed Nasdaq-listed | Nasdaq official page | NOTED |
| D0014 | 2026-10-10 | 11 | Dashboard frontend built as a standalone React/Vite/TypeScript SPA rather than the suggested Streamlit + Plotly | `CONTEXT.md` §"Dashboard vision" permits a separate frontend when justified. Streamlit cannot produce the institutional-terminal visual quality this deliverable requires. Recorded as a documented deviation; `WORKTREE.md` directory contract preserved (`dashboard/pages/`, `dashboard/components/`, `dashboard/styles/`), only `app.py` → `App.tsx`. | LOCKED |
| D0015 | 2026-10-10 | 11 | Dashboard currently renders SYNTHETIC demo fixtures, not research output | `dashboard/scripts/gen_demo_data.py`, seed 20260925, deterministic. Real content limited to `universe_verification_v001.json`. Every synthetic artifact carries `synthetic: true` + disclaimer; Research Audit carries a full real-vs-simulated ledger and a persistent DEMO badge. Gate 9 is therefore `IN REVIEW`, not `PASS`. | NOTED |
| D0016 | 2026-10-10 | 11 | Synthetic market data is internally consistent by construction, not hand-authored | Correlations, betas, volatilities, drawdowns and the equal-weight benchmark are computed from the generated price series; only unobservable quantities (LightGBM IC, SHAP, fundamentals, optimiser output) are authored placeholders. Regime structure mirrors RESEARCH_PROTOCOL §18 (2020 crash, 2022 drawdown, 2023-24 AI-capex, 2025 unwind, 2026 continuation). | NOTED |
| D0017 | 2026-10-16 | 3 | Acquisition notebook corrected as v002 bug-fix release: VaR/ES quantile+sign convention fixed (emitted as positive loss magnitudes), real Ledoit-Wolf shrinkage, stress scenarios from realised benchmark drawdowns, splits/dividends captured, checksummed clean Parquet, canonical provenance ledger written into the bundle | `dashboard/notebooks/colab/build_notebook.py`; offline dry run 103/103 checks green | LOCKED |
| D0018 | 2026-10-16 | 11 | Dashboard provenance is fully artifact-driven; all hardcoded synthetic/demo badges removed. Surfaces resolve from artifact `synthetic` flags + `manifest.real_vs_synthetic` ledger (REAL… / SYNTHETIC… / else PENDING) | `dashboard/src/lib/provenance.ts`; all pages consume it | LOCKED |
| D0019 | 2026-10-16 | 3/11 | Canonical 12-row provenance ledger is a shared contract between the acquisition notebook and `gen_demo_data.py`: identical surface keys in identical order | Notebook Cell 9 `LEDGER` ⇄ `gen_demo_data.py` `LEDGER`; dry-run parity check | LOCKED |
| D0020 | 2026-10-16 | 11 | `gen_demo_data.py` never overwrites `synthetic:false` artifacts; manifest merge preserves real-run metadata. `--force` is an explicit full fixture reset. Partial-real trees are the supported upgrade path | Guard/merge tested: stub real bundle installed → 4 files skipped, acquisition block + REAL rows preserved | LOCKED |
| D0021 | 2026-10-16 | 3/11 | Pre-Phase-9 risk statistics describe an equal-weight reference book (`portfolio_basis: "equal_weight_placeholder"` + `reference_weights`), not a fitted portfolio; UI suppresses MCTR/CCTR when requested weights ≠ reference book | risk.json contract; PortfolioOptimizer suppression; dry-run checks | NOTED |
| D0022 | 2026-10-16 | 3 | Stooq proof-of-work solver disabled (`ALLOW_STOOQ_POW=False`): Yahoo is the designated source, and building anti-bot circumvention into the pipeline is not worth it for a redundant fallback | `build_notebook.py`; colab README §Stooq | LOCKED |
| D0023 | 2026-10-16 | 3 | Offline dry-run harness is the pre-flight gate for the acquisition notebook; bundle-contract changes must pass it before a Colab run | `dashboard/notebooks/colab/dry_run_notebook.py` — exits 0 on 103/103 checks | LOCKED |
| D0024 | 2026-10-16 | 3 | First real acquisition executed from the control plane under explicit owner instruction (`dry_run_notebook.py --live`: same processing code as the notebook, real fetchers, scratch-redirected Colab paths). 23/23 series, 1,689 trading days 2020-01-02 → 2026-09-22, validation PASS (26 checks), audit 103/103, 320 corporate-action events, 0 failures. Two v002 defects found and fixed en route: (a) `normalise()` built the frame at `idx.normalize()` while columns carried the raw tz-converted index — pandas aligned on the mismatch, NaNed every column and dropped complete frames from tz-aware sources (this is what killed the live Colab attempt); (b) the yfinance fallback fetched with `actions=False`, so a throttled chart API left splits/dividends unrecorded. Both regression-covered; dry run extended to 107/107. Boundary note: `AGENTS.md` §3 expects Yahoo acquisition in Colab; this bounded run (few MB, I/O-bound) executed locally because the Colab path was IP-throttled and the owner instructed it. Bundle installed to `dashboard/src/data`; Parquet copied to `artifacts/acquisition_v001/` for the Drive upload. Yahoo 429-throttled the chart API on both Colab and local IPs; the (fixed) yfinance fallback carried all 23 series | `artifacts/acquisition_v001/live_run.log`; installed `run_manifest.json`; dry run 107/107 | LOCKED |
| D0025 | 2026-10-16 | 11 | Acquisition bundle committed to the public repository so GitHub Pages renders the real data; `dashboard/src/data/` removed from `.gitignore`. CI relies on the `gen_demo_data.py` guard: synthetic:false artifacts are never overwritten; fixture surfaces (models, portfolio, universe) are regenerated deterministically at build time. Accepted trade-off (owner-approved): Yahoo EOD prices become publicly downloadable from the repo | `.gitignore`, `.github/workflows/deploy-dashboard.yml`, `dashboard/src/data/`; Pages deploy | LOCKED |

| D0026 | 2026-10-16 | 3 | End-to-end QA audit of pipeline + dashboard under explicit owner instruction (recompute-everything-from-Parquet + full code read). Six confirmed defects fixed: (a) factor z-rank sign inversion — momentum, drawdown and diversification were silently inverted in the AI-Universe composite (top-5 changed: PANW/GOOGL/AMD/DDOG/MU); (b) `momentum_12_1` was plain 12-month momentum, now true 12-1 (skips the last ~21 trading days); (c) "Sharpe" was CAGR/vol in notebook, fixtures and StockIntelligence — now annualised mean/vol (rf 0); (d) `worst_30d` was a 21-day rolling MEAN of daily returns, understating the worst month ~15x (−1.97% vs −30.56% actual) — now min 30-trading-day cumulative return; (e) StockIntelligence annualised CAGR over the nominal range for truncated names — now over the observed window; (f) Backtest chart title vs rebased units. Shipped by reprocessing the FROZEN acquisition: new harness mode `--from-parquet` rebuilds frames from `artifacts/acquisition_v001/prices_v001.parquet` (no re-fetch; avoids Yahoo re-adjusting historical prices for later dividends), reprocess audit 119/119, market/risk JSON byte-identical to pre-fix bundle, Parquet logically identical. `run_context` now recorded in manifest.json + run_manifest.json for every execution path. Dry run extended 107 → 123 checks | docs/QA_REVIEW_2026-10-16.md; dry 123/123; reprocess 119/119; recomputation battery | LOCKED |

| D0027 | 2026-10-16 | 3/11 | Round-2 visual QA over the rebuilt dashboard (tall-viewport capture of every surface) — 18 confirmed findings, all fixed. Public-numbers change: strategy performance statistics moved out-of-sample (2022-01-03 → frozen cutoff) in notebook `perf()` + fixtures + dashboard, matching the "out-of-sample" labelling — ML CAGR 28.4 → 20.18%, vol 28.47%, Sharpe 0.645 (rf 0), maxDD −36.68%, worst-30d −21.85%; same-slice benchmarks EW 24.59%, QQQ 14.84%, SOXX 28.29%, SPY 12.31%; drawdown-mode legend chips qualified "stats: out-of-sample" when the window is full. Fixture repair: constrained projection renormalised to gross 1.0 (NVDA 12.0% binds the cap, SEMI 34.0%, HYPER 32.77%, SOFT 33.23%; "2 binding · 10 slack"); unconstrained book normalised (NVDA 13.5%) with the 12%-cap difference explained; caps unified at 34/34/34. Manifest flavour convergence: `--from-parquet` reprocess writes the notebook flavour, `gen_demo_data.py` (also run by CI) normalises fixture surfaces; `run_manifest.json` keeps the notebook flavour (D0026 precedent); final manifest diff vs committed bundle = timestamps only. UI: Delta sign inference for formatted strings, risk-terminal beta-map bubbles, AI-Universe scatter sizing + uppercase sort headers, Command-Center mode-aware titles + chart heights + MiniBar reference maxima + drawdown x-axis dates, Backtest YTD chip, MLLab ICIR adjacency + quantile precision, ResearchAudit source-truncation + checklist retitle + unified gate status, StockIntelligence since-first-trade windowing, PortfolioOptimizer capped-badge scoping | docs/QA_REVIEW_2026-10-16.md §6.1; dry 123/123; reprocess 119/119; full re-shoot | LOCKED |

| D0028 | 2026-10-17 | 11 | Owner QA round: (a) brand renamed "Nasdaq AI Quant" → "NASDAQ AI EQUITIES PORTFOLIO" (sidebar, document title, meta); (b) audit-mode toggle removed entirely — the overlay rendered REAL panels as SIM whenever a panel passed no `provenance` prop, and the owner judged the toggle misleading; button + command-palette action + store state deleted (artifact-resolved fixture badges and the audit ledger remain); (c) delta-chip defect: the SVG arrow paths were swapped since the component was written (positive deltas drew ▼, negative ▲) — exposed once round-2 restored sign tone — fixed, positive = ▲ / negative = ▼; (d) Command-Center Universe-ranking dead space root-caused: a fixed `max-h-[330px]` table cap inside a grid-stretched panel left the remainder of the panel body blank — the scroll region now fills the body; (e) AI-Universe header metrics and the Stock-Intelligence fundamental-snapshot panel filled from a new descriptive artifact `dashboard/src/data/current_snapshot.json`: market cap + forward P/E from Yahoo Finance (fetched 2026-10-17), AI/capex exposure from a manual research pass v1 with per-name basis notes + documented rubric — median cap $327.55B, median fwd P/E 22.43x (n=19; CRWV not meaningful on negative forward EPS), mean AI exposure 28%, mean capex exposure 43%; strict median now used for even counts. Snapshot is current-state descriptive-only: not point-in-time, never joined to historical observations or predictive computation (AGENTS.md §8); the Phase-1 sourced factor dataset remains pending | docs/QA_REVIEW_2026-10-16.md §6.2; re-shoot verification; tsc + vite build green; current_snapshot.json | LOCKED |

| D0029 | 2026-10-17 | 5/6 | Phase 5/6 training notebook built and rehearsed offline: `nasdaq_ai_quant_train_v001.ipynb` (builder `build_train_notebook.py`, harness `dry_run_train.py`). Feature factory: 18 trailing price/volume features (returns 1–126d, momentum 12-1, realised vols, trend ratios, RSI-14, MACD histogram, volume ratio, QQQ-relative return + beta, date-local cross-sectional ranks) — every value uses data through close t only (decision timestamp, PROTOCOL L21). Target factory: 7 targets per PROJECT_SPEC §10 in the DATA_CONTRACT §7 long schema with per-row label_start / label_end (label_end = actual trading date at t+h); vol targets are forward h-day realised vol of daily returns (annualised, ddof 1). Training: expanding-window walk-forward from 2022-01-03, 63-day test windows (19 folds), rolling 126-day pre-test validation window for early stopping (never test data), per-target purge (horizon h) + 5-day embargo on both boundaries, one pre-registered LightGBM config per objective (deterministic + force_row_wise ⇒ bit-identical refits), no OOS tuning. Metrics: per-date cross-sectional Spearman IC (rank-Pearson implementation, no scipy dependency), ICIR, hit rate (per-family conventions recorded in the report), R²/RMSE/MAE, decile profile, annual IC, per-model IC decay vs 1/5/21d return labels, normalised gain importance, per-fold diagnostics; report shape mirrors dashboard models.json for the later wiring step. 24 hard-failing checks incl. truncated-history feature recomputation, no pre-listing synthesis (CRWV all-NaN before 2025-03-28), label_end alignment, split geometry + OOS fold coverage on every fold, deterministic-refit equality, independent IC recomputation, and a warmup-only coverage proof (≥5 defined features; every unpredicted label row satisfies it by construction verification). Pre-registered artifact names emitted as-is: features_v003.parquet + feature_meta_v003.json, targets_v002.parquet, predictions_v007.parquet, training_report_v001.json, run_manifest_train_v001.json with per-parquet SHA-256 and run_context. Local rehearsal runs the real pipeline on the frozen acquisition parquet with a deterministic stub booster (LightGBM neither installed nor trained locally per AGENTS §2): 24/24 in-notebook checks + all harness audits PASS. Colab run pending owner Drive upload of 03_raw + 04_clean | dry_run_train.py; README §Phase 5/6; 24/24 checks green | LOCKED |

| D0030 | 2026-10-17 | 5/6 | Phase 5/6 canonical Colab training run executed (owner-run; `run_context: colab_notebook`, engine LightGBM; 24/24 notebook checks, 0 failures; all three parquet SHA-256 verified against the run manifest on the control plane). Bundle archived at `artifacts/training_v001/` (local, git-ignored; the Drive copies in 05_features/06_targets/07_models/08_predictions are canonical). Results on the frozen 2020→2026 panel, 19 walk-forward folds, OOS 2022-01-03→: **vol targets strongly predictable** — vol_5d IC +0.455 / ICIR +2.11 / R² +0.181 with monotone deciles, vol_21d IC +0.518 / ICIR +1.94 / R² +0.239, annual IC stable (0.25–0.65; consistent with volatility clustering, not leakage). **Return and direction targets show no OOS edge** — return_1d IC −0.008 (t −0.99), return_5d −0.006 (t −0.82), return_21d −0.014 (t −1.68), direction_5d +0.012 (t +1.64), direction_21d −0.010 (t −1.30); pooled R² mildly negative (−0.005 to −0.057); early stopping terminates at best_iter 1–5 for these folds (no learnable signal at this feature/config regime); return deciles non-monotone; hit rates ≈ or below the OOS P(up) base rates (direction_5d 0.524 vs 0.537 base; direction_21d 0.546 vs 0.564 base) ⇒ no directional skill. Interpretation recorded: honest null for return timing with price-only v1 features — the mildly negative pooled R² is the expected penalty for adding noise to the constant-mean forecast, not a pipeline defect; vol predictability is the expected robust result and is useful for risk sizing, not alpha. Next: dashboard wiring of the real metrics (honest display), Phase 7 feature work + PIT fundamentals (OI-0001), Phase 8–10 portfolio/backtest; correlation-with-existing-alpha NOT_APPLICABLE (no real alpha set exists) | artifacts/training_v001/run_manifest_train_v001.json + training_report_v001.json; 24/24 checks; SHA-256 verified locally | LOCKED |

## Phase 0 tasks

- [x] verify all 20 exchange listings — all confirmed via `nasdaq.com/market-activity/stocks/{ticker}`
- [x] verify company identities/security classes — verified from Nasdaq page titles and SEC 10-K cover pages
- [x] verify US-domicile rule — all 20 US-incorporated (19 Delaware, 1 Washington); DDOG redomiciled to Nevada 2026
- [x] document AI category for each name — in `universe_verification_v001.json`
- [x] document inclusion rationale — sourced rationale in manifest with SEC/company URLs
- [x] record historical data start dates — flagged PLTR (post-2020 listing) and CRWV (2025 IPO); exact dates deferred to Phase 3 data acquisition
- [x] store source URLs — 2–3 authoritative URLs per constituent in manifest
- [x] write `configs/universe.yaml`
- [x] validate universe schema — 131/131 tests passed via `scripts/local/validate_universe.py`
- [x] audit universe for duplicates — 20 unique tickers confirmed
- [x] freeze version `0.1.0`
- [x] mark Phase 0 complete

## Phase 0 evidence policy

Every completed checkbox should have evidence recorded in the decision ledger or a linked research artifact.

Do not mark a task complete based solely on agent memory.

## Open issues

### OI-0001 — historical point-in-time fundamentals

Status: `OPEN`

Need to determine which fundamental fields can be reconstructed historically with valid information-available dates. Current-state values must not be backfilled into the 2020–2026 predictive dataset.

### OI-0002 — benchmark/factor source

Status: `OPEN`

Need to finalize historical factor-data sources for QQQ, SOXX, SPY, and any additional factor model used in alpha attribution.

### OI-0003 — exact transaction-cost model

Status: `OPEN`

10 bps round-trip is a required robustness test, but the baseline execution/cost model must be specified before portfolio backtesting.

### OI-0004 — rebalance cadence

Status: `OPEN`

Candidate cadences: daily, weekly, or monthly. Select using research justification, not convenience.

### OI-0005 — portfolio constraint numerics

Status: `OPEN`

The previously discussed 12% single-name and category limits are research defaults, not yet final locks.

## Change rule

If an open issue changes the methodology materially, increment the relevant specification version and record the decision before downstream experiments continue.
