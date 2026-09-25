# RESEARCH_PROTOCOL.md — Quant Research Protocol

## 1. Principle

The project is an empirical financial-forecasting study.

The burden of proof is on the signal.

Do not treat predictive performance as evidence of economic value until it survives transaction costs, factor controls, regime tests, and realistic portfolio constraints.

## 2. Information-time rule

For every feature `X(t)` used to predict target `Y(t+h)`:

```text
information_available_timestamp(X) <= decision_timestamp(t)
```

No feature may depend on information released after the decision timestamp.

For daily EOD research, the default decision timestamp is the close associated with the feature row unless a different execution convention is explicitly specified.

## 3. Current-state versus historical data

Current 2026 fundamental scores are descriptive unless reconstructed point-in-time.

Do not backfill today's:

- AI revenue exposure;
- valuation;
- earnings revisions;
- capex exposure;
- analyst estimates;
- market capitalization;

into 2020–2025 rows.

## 4. Universe construction

The universe is fixed in `configs/universe.yaml` for the current experiment family.

The project is therefore a current-universe historical study.

Survivorship bias must be disclosed.

## 5. Return convention

Unless a model specification says otherwise, use adjusted/economic total-return-consistent price data for return calculations where possible.

Document whether dividends and splits are reflected through adjusted prices.

Do not mix adjusted and unadjusted series within the same return definition.

## 6. Feature design

Feature families should be modular and independently testable.

Examples:

### Return/momentum

- 1D, 2D, 5D, 10D, 21D, 63D, 126D, 252D returns;
- moving-average distances;
- trailing relative strength.

### Volatility

- rolling standard deviation;
- Parkinson-style range metrics where justified;
- ATR/range features;
- volatility-of-volatility where justified.

### Volume/liquidity

- volume z-score;
- dollar volume;
- rolling volume ratios;
- turnover/liquidity proxies.

### Market-relative

- stock minus QQQ;
- stock minus SOXX;
- beta estimates;
- relative-strength ratios.

### Cross-sectional

At each timestamp, compute ranks or normalized values using only securities available at that timestamp.

## 7. Target design

Targets are strictly forward looking.

Examples:

```text
return_h(t) = P(t+h) / P(t) - 1
```

Forward realized volatility should use only observations after `t`.

Direction is a deterministic transformation of the corresponding forward return threshold.

The target-definition file must specify exact horizon units and threshold.

## 8. Leakage controls

Automated tests must cover:

- future-shift leakage;
- rolling-window leakage;
- global normalization leakage;
- target contamination;
- cross-sectional future contamination;
- feature availability after decision time;
- improperly aligned benchmark features;
- model training on OOS rows.

Any failed leakage test is a hard stop.

## 9. Scaling/normalization

Tree models generally do not require feature standardization.

If normalization/ranking is used, fit/derive it using only the training window or cross-sectional information available at each prediction timestamp.

Never fit preprocessing on the entire dataset before temporal splitting.

## 10. Validation design

Default:

- expanding or rolling training window;
- validation period after training;
- OOS test period after validation;
- walk-forward model refit at documented cadence.

For overlapping h-day targets, purge training rows whose labels overlap the validation/test interval and apply an embargo when appropriate.

The exact splitter implementation must be tested on toy dates before applying to the full dataset.

## 11. Hyperparameter tuning

Do not tune directly on the final OOS period.

Use a nested or staged temporal validation approach:

```text
training history
    -> validation window
        -> model selection
            -> untouched OOS window
```

Record every tested configuration in the experiment registry.

Do not report only the best configuration without preserving the search history.

## 12. LightGBM objectives

Use objectives appropriate to the target:

- regression for return/volatility;
- binary classification for direction when warranted.

Use early stopping only against a temporally valid validation set.

Avoid excessive tree depth, excessive boosting rounds, and feature proliferation unless supported by OOS evidence.

## 13. Evaluation hierarchy

### Model-level

- MAE;
- RMSE;
- R²;
- directional accuracy;
- probability calibration where applicable.

### Signal-level

- Spearman IC;
- Pearson IC;
- ICIR;
- IC by year;
- IC decay;
- monotonicity across prediction quantiles.

### Portfolio-level

- gross return;
- net return;
- Sharpe;
- Sortino;
- maximum drawdown;
- worst 30-day result;
- turnover;
- capacity;
- transaction-cost sensitivity.

The signal must remain useful after realistic costs.

## 14. Transaction-cost protocol

The project requires a robustness test using at least 10 bps round-trip cost.

The baseline cost model must also be configurable.

Do not claim capacity from a fixed bps haircut alone if the strategy's traded notional is large enough for market impact to dominate.

Capacity analysis should consider:

- average dollar volume;
- participation rate;
- turnover;
- modeled impact;
- position size.

## 15. Portfolio construction protocol

Use predicted expected returns only as one input.

Risk estimates and concentration constraints must materially affect the solution.

The optimization objective must be versioned.

Always retain:

- unconstrained reference solution;
- constrained solution;
- equal-weight benchmark.

This allows the cost of constraints to be measured.

## 16. Covariance protocol

Estimate covariance only from an explicitly defined trailing or training window.

Do not calculate a full-period covariance matrix and use it prospectively without labeling this as a hindsight artifact.

If Ledoit-Wolf shrinkage is used, retain:

- raw covariance;
- shrinkage estimator;
- shrinkage parameter;
- estimation window.

## 17. Factor attribution

At minimum include:

- QQQ;
- SOXX;
- SPY where useful;
- momentum factor;
- size/value factors when available and justified.

The final specification must define factor data source and frequency.

Report coefficient estimates, statistical uncertainty, and R² rather than only a residual return.

## 18. Regime analysis

At minimum inspect:

- 2020 pandemic regime;
- 2022 growth/valuation drawdown;
- 2023–2024 AI-capex regime;
- 2025;
- 2026 YTD/current regime.

Do not claim regime robustness based on only one aggregate metric.

## 19. Reproducibility

Every research run must identify:

- git commit;
- config hash/version;
- universe version;
- data artifact version;
- feature version;
- target version;
- model version;
- random seed;
- execution timestamp.

## 20. Adversarial review checklist

Before accepting a result, ask:

1. Could the model be learning momentum only?
2. Could it be learning semiconductor beta only?
3. Could it be learning volatility/crowding only?
4. Does the signal disappear after costs?
5. Does the signal survive 2022?
6. Does the signal survive 2025/2026?
7. Does the signal survive removing the largest-cap names?
8. Does the signal survive feature ablation?
9. Does the signal survive a stricter universe/liquidity screen?
10. Are results driven by one stock or one year?

## 21. Research conclusion rule

A model can be:

- predictive but not profitable;
- profitable but factor-driven;
- profitable but capacity-limited;
- statistically significant but economically trivial.

These outcomes must be distinguished explicitly.
