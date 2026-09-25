# QUALITY_GATES.md — Acceptance and Kill Criteria

## Gate philosophy

A later phase cannot repair a failed earlier phase silently.

Hard failures stop progression.

## Gate 0A — Agent Operating System

Pass criteria:

- project context is explicit;
- local/Colab compute boundary is explicit;
- source hierarchy is explicit;
- leakage/survivorship rules are explicit;
- repository/worktree responsibilities are explicit;
- phase sequence is explicit.

Hard fail examples:

- agent believes it should run heavy computation locally;
- agent is permitted to overwrite research artifacts;
- no versioning/provenance requirement;
- no distinction between current-state and historical predictive data.

## Gate 0 — Universe Lock

Pass criteria:

- exactly 20 tickers;
- Nasdaq listing verified from authoritative source;
- company/security identity verified;
- US-domicile rule checked;
- AI category assigned;
- inclusion rationale documented;
- exclusions documented;
- historical-start limitations documented;
- universe version and verification timestamp present.

Hard fail:

- any ticker cannot be verified;
- any ticker is not Nasdaq-listed;
- duplicate ticker;
- undefined category;
- source missing.

## Gate 1 — Fundamental Dataset

Pass criteria:

- every value has source URL;
- factor definitions are documented;
- units are explicit;
- date/period is explicit;
- current-state vs historical eligibility is explicit;
- no current value is mislabeled point-in-time historical data.

Hard fail:

- undocumented analyst estimate;
- untraceable valuation number;
- source date omitted where temporal availability matters.

## Gate 2 — Raw EOD Data

Pass criteria:

- full requested download attempted;
- maximum returned date verified;
- all 20 tickers accounted for;
- benchmarks downloaded;
- raw data immutable/versioned.

Hard fail:

- silent missing ticker;
- unexpected date range;
- duplicate rows;
- mixed ticker identity.

## Gate 3 — Data Quality

Pass criteria:

- missingness report;
- duplicate report;
- date/order report;
- OHLC consistency;
- non-positive-price check;
- volume sanity;
- corporate-action checks;
- IPO/start-date audit.

Hard fail:

- unexplained corrupted observations;
- validation logic not reproducible;
- silent imputation.

## Gate 4 — Feature/Target Integrity

Pass criteria:

- feature availability timestamps established;
- target alignment tested;
- forward-looking targets verified;
- no future observations in rolling features;
- cross-sectional transforms are date-local;
- leakage tests pass.

Hard fail:

- any demonstrable target leakage;
- normalization fitted on the entire sample before split;
- future data entering features.

## Gate 5 — Walk-Forward ML

Pass criteria:

- temporal splitting;
- no random shuffling;
- overlapping labels handled appropriately;
- hyperparameters selected without touching final OOS;
- OOS predictions identified explicitly;
- reproducible seeds/configs.

Hard fail:

- test-period tuning;
- random split for temporal prediction;
- OOS contamination;
- only in-sample metrics reported.

## Gate 6 — Signal Validation

Pass criteria:

- Spearman IC;
- ICIR;
- IC decay;
- annual breakdown;
- transaction-cost test;
- quantile monotonicity;
- concentration/one-name sensitivity;
- regime analysis.

Hard fail:

- model judged solely on RMSE/R²;
- signal disappears after basic costs and is still described as robust alpha;
- results dominated by one stock/year without disclosure.

## Gate 7 — Risk / Optimization

Pass criteria:

- covariance estimation window documented;
- shrinkage documented if used;
- constraints enforced mechanically;
- turnover measured;
- transaction costs modeled;
- risk contributions calculated;
- infeasible optimization handled explicitly.

Hard fail:

- optimizer silently relaxes constraints;
- covariance uses future data;
- weights cannot be reproduced from saved inputs.

## Gate 8 — Backtest / Alpha Attribution

Pass criteria:

- OOS-only strategy returns;
- QQQ/SOXX/SPY comparisons;
- net-of-cost return;
- beta/factor attribution;
- alpha with uncertainty statistics;
- drawdown/worst-30D;
- annual/periodic breakdown.

Hard fail:

- backtest includes training-period predictions as OOS;
- benchmark alignment invalid;
- costs omitted from headline result.

## Gate 9 — Dashboard

Pass criteria:

- dashboard reads versioned artifacts;
- no heavy model training during page load;
- all headline numbers trace to stored artifacts;
- methodology/limitations visible;
- interactions do not alter historical results silently;
- dashboard can run without the local machine holding the full dataset.

Hard fail:

- dashboard computes a different metric than research notebooks;
- hidden data transformations;
- no source/version information.

## Gate 10 — Final Submission

Pass criteria:

- repository reproducible;
- runbook complete;
- research limitations disclosed;
- models and artifacts versioned;
- final dashboard works;
- final result independently re-runnable in Colab.
