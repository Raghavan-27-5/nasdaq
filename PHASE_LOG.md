# PHASE_LOG.md — Research State and Decision Ledger

## Current state

- Phase 0A: `COMPLETE_AFTER_SELF_AUDIT`
- Phase 0: `IN_PROGRESS`
- Phase 1: `BLOCKED_BY_PHASE_0`

## Decision ledger

| ID | Date | Phase | Decision | Evidence | Status |
|---|---|---|---|---|---|
| D0001 | 2026-09-25 | 0A | Local laptop is control plane only; Colab is compute plane | User task specification | LOCKED |
| D0002 | 2026-09-25 | 0A | Google Drive is canonical durable artifact store | User task specification | LOCKED |
| D0003 | 2026-09-25 | 0A | Parquet is default analytical storage format | Project architecture | LOCKED |
| D0004 | 2026-09-25 | 0A | Historical window frozen at 2020-01-01 through 2026-09-22 EOD | Project specification | LOCKED |
| D0005 | 2026-09-25 | 0 | `SNOW` excluded because NYSE-listed | Nasdaq official market listing evidence | LOCKED |
| D0006 | 2026-09-25 | 0 | 20-name structural universe selected for Phase-0 verification; not yet called definitive top-20 | Phase-0 universe methodology | IN_REVIEW |

## Phase 0 tasks

- [x] verify all 20 exchange listings
- [ ] verify company identities/security classes
- [ ] verify US-domicile rule
- [ ] document AI category for each name
- [ ] document inclusion rationale
- [ ] record historical data start dates
- [ ] store source URLs
- [x] write `configs/universe.yaml`
- [x] validate universe schema
- [x] audit universe for duplicates
- [ ] freeze version `0.1.0`
- [ ] mark Phase 0 complete

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
