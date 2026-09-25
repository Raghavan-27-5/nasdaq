# DATA_CONTRACT.md — Data Schemas and Time-Consistency Contract

## 1. Purpose

Define the canonical shape, semantics, timestamps, and validation requirements for every major data artifact.

## 2. Canonical identifiers

Required keys:

- `ticker`: uppercase Yahoo Finance ticker;
- `date`: timezone-normalized trading date/timestamp;
- `universe_version`;
- `data_version`.

Do not use company name as a primary key.

## 3. Raw EOD schema

Minimum fields:

```text
ticker
date
open
high
low
close
volume
adj_close (if returned/available)
actions/dividends/splits metadata where available
```

All raw data must be retained unchanged before cleaning.

## 4. Clean-price schema

Minimum fields:

```text
ticker
date
open
high
low
close
adj_close
volume
is_tradable
is_valid
```

`is_tradable` must be false before the instrument's actual trading history begins.

## 5. Market benchmark schema

Benchmarks:

- `QQQ`;
- `SOXX`;
- `SPY`.

Use the same date convention and adjustment policy as constituent securities.

## 6. Feature schema

Every feature row must include:

```text
ticker
date
feature_name
feature_value
feature_version
availability_timestamp
```

In a wide analytical Parquet table, the final matrix may use one column per feature, but metadata must preserve the same semantics.

## 7. Target schema

Every target row must include:

```text
ticker
date
target_name
target_value
target_horizon
label_start
label_end
target_version
```

The feature row's availability timestamp must precede the target's label start by the defined decision convention.

## 8. Fundamental factor schema

For every current-state factor:

```text
ticker
factor_name
value
unit
score
source
source_url
source_publication_date
period_end_date
information_available_date
retrieved_at
factor_version
is_point_in_time_eligible
```

`information_available_date` is required for historical predictive use.

## 9. Universe schema

Each universe member requires:

```text
ticker
company
exchange
listing_status
country_domicile
security_type
ai_category
ai_exposure_rationale
inclusion_rationale
historical_data_start
universe_version
verified_at
verification_source
```

## 10. Model-prediction schema

Every OOS prediction requires:

```text
ticker
prediction_date
target_name
prediction
model_version
feature_version
universe_version
train_start
train_end
validation_start
validation_end
prediction_generated_at
is_oos
```

`is_oos` must be true for results used in performance evaluation.

## 11. Portfolio-weight schema

```text
rebalance_date
ticker
weight
predicted_return
predicted_volatility
risk_contribution
category
portfolio_version
optimizer_version
is_tradable
```

Weights must be auditable to the optimization run that produced them.

## 12. Portfolio-return schema

```text
date
portfolio_return
gross_return
transaction_cost
net_return
turnover
benchmark_return
portfolio_version
```

## 13. Data types

Recommended storage types:

- dates: `datetime64[ns]` or Arrow timestamp;
- ticker/category: dictionary/string encoded;
- numeric market data: `float64` for prices/returns where precision matters;
- volume: `int64` or `float64` depending on source;
- booleans: actual boolean;
- categorical fields: categorical/dictionary encoding where supported.

## 14. Missing data rules

Never silently zero-fill financial observations.

Distinguish:

- unavailable because not listed;
- missing due to provider gap;
- invalid source observation;
- legitimately zero value.

Use explicit flags when the distinction matters.

## 15. Alignment rules

All joins must be explicit about:

- date alignment;
- forward/backward fill policy;
- market holidays;
- timezone;
- as-of semantics.

No backward-looking feature may be shifted forward accidentally.

## 16. Corporate actions

Document whether the return series is adjusted for:

- splits;
- dividends;
- special distributions.

Do not mix adjusted and unadjusted prices in the same return calculation.

## 17. Point-in-time rules for fundamentals

A fundamental datum is historically eligible only if:

```text
information_available_date <= decision_date
```

Period end date alone is not sufficient.

## 18. Unbalanced panel rules

For stocks with post-2020 IPO/public-history starts:

- preserve actual start date;
- no synthetic pre-history;
- no zero returns before listing;
- no forward filling into unavailable periods;
- exclude from portfolio at dates where `is_tradable == false`.

## 19. Quality flags

Recommended flags:

```text
quality_status
is_missing
is_outlier
is_corporate_action
is_tradable
is_oos
point_in_time_eligible
```

## 20. Storage

Canonical analytical format: Parquet.

Canonical artifact store: Google Drive.

CSV exports are convenience/interchange formats only.

Raw source data and derived artifacts must not share the same directory without clear version labels.
