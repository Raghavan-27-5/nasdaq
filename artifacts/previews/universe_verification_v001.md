# Universe Verification v001

**Status:** IN_REVIEW
**Universe:** 20-name structural Nasdaq AI universe
**Verification date:** 2026-09-25

## Listing verification

All 20 selected tickers were checked against official Nasdaq market-activity pages. Listing verification is treated as passed for this preliminary Phase-0 artifact.

## Domicile verification

US domicile is a separate attribute and must be verified from current SEC/company filings before Phase 0 is marked COMPLETE. The agent must not infer domicile merely from Nasdaq listing.

## Constituents

| Ticker | Company | Category | Nasdaq page | Domicile |
|---|---|---|---|---|
| NVDA | NVIDIA Corporation | AI_COMPUTE | https://www.nasdaq.com/market-activity/stocks/nvda | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| AVGO | Broadcom Inc. | CUSTOM_SILICON_NETWORKING | https://www.nasdaq.com/market-activity/stocks/avgo | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| AMD | Advanced Micro Devices, Inc. | AI_COMPUTE | https://www.nasdaq.com/market-activity/stocks/amd | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| MU | Micron Technology, Inc. | AI_MEMORY | https://www.nasdaq.com/market-activity/stocks/mu | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| MSFT | Microsoft Corporation | HYPERSCALER_AI_PLATFORM | https://www.nasdaq.com/market-activity/stocks/msft | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| GOOGL | Alphabet Inc. Class A | HYPERSCALER_AI_PLATFORM | https://www.nasdaq.com/market-activity/stocks/googl | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| AMZN | Amazon.com, Inc. | HYPERSCALER_AI_PLATFORM | https://www.nasdaq.com/market-activity/stocks/amzn | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| META | Meta Platforms, Inc. Class A | AI_PLATFORM_INFRASTRUCTURE | https://www.nasdaq.com/market-activity/stocks/meta | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| PLTR | Palantir Technologies Inc. Class A | ENTERPRISE_AI | https://www.nasdaq.com/market-activity/stocks/pltr | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| MRVL | Marvell Technology, Inc. | AI_NETWORKING_CUSTOM_SILICON | https://www.nasdaq.com/market-activity/stocks/mrvl | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| LRCX | Lam Research Corporation | SEMICONDUCTOR_EQUIPMENT_AI_CAPEX | https://www.nasdaq.com/market-activity/stocks/lrcx | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| AMAT | Applied Materials, Inc. | SEMICONDUCTOR_EQUIPMENT_AI_CAPEX | https://www.nasdaq.com/market-activity/stocks/amat | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| CDNS | Cadence Design Systems, Inc. | EDA_AI_SEMICONDUCTOR_DESIGN | https://www.nasdaq.com/market-activity/stocks/cdns | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| SNPS | Synopsys, Inc. | EDA_AI_SEMICONDUCTOR_DESIGN | https://www.nasdaq.com/market-activity/stocks/snps | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| PANW | Palo Alto Networks, Inc. | AI_CYBERSECURITY | https://www.nasdaq.com/market-activity/stocks/panw | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| CRWD | CrowdStrike Holdings, Inc. Class A | AI_CYBERSECURITY | https://www.nasdaq.com/market-activity/stocks/crwd | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| ADBE | Adobe Inc. | GENERATIVE_AI_SOFTWARE | https://www.nasdaq.com/market-activity/stocks/adbe | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| DDOG | Datadog, Inc. Class A | AI_CLOUD_OBSERVABILITY | https://www.nasdaq.com/market-activity/stocks/ddog | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| CRWV | CoreWeave, Inc. Class A | AI_CLOUD_INFRASTRUCTURE | https://www.nasdaq.com/market-activity/stocks/crwv | PENDING_OMP_PRIMARY_SOURCE_CHECK |
| QCOM | QUALCOMM Incorporated | EDGE_AI_COMPUTE | https://www.nasdaq.com/market-activity/stocks/qcom | PENDING_OMP_PRIMARY_SOURCE_CHECK |

## Exclusions

| Ticker | Reason |
|---|---|
| SNOW | NYSE-listed |
| ARM | UK-domiciled foreign issuer under the project US-domicile definition |

## Completion rule

Phase 0 remains IN_REVIEW until domicile/security-class verification, source capture, exact history-start capture, and schema validation are completed.
