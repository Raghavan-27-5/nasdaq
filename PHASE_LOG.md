# PHASE_LOG.md — Research State and Decision Ledger

## Current state

- Phase 0A: `COMPLETE`
- Phase 0: `COMPLETE`
- Phase 1: `READY`

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
