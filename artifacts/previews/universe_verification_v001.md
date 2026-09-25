# Universe Verification v001 — VERIFIED

**Status:** VERIFIED
**Universe:** 20-name structural Nasdaq AI universe
**Universe version:** 0.1.0
**Verification date:** 2026-09-25
**Research window:** 2020-01-01 through 2026-09-22 EOD (frozen)

## Verification methodology

1. **Nasdaq listing:** Each ticker verified against `nasdaq.com/market-activity/stocks/{ticker}` official pages.
2. **US domicile:** State of incorporation verified from SEC EDGAR 10-K filings and entity records.
3. **Security class:** Identified from Nasdaq page titles and SEC filing cover pages.
4. **AI category rationale:** Assessed from public filings, product documentation, and company IR materials.

## Domicile notes

- **MSFT** incorporated in Washington state (all others Delaware-incorporated).
- **AVGO** redomiciled from Singapore to Delaware in April 2018.
- **MRVL** redomiciled from Bermuda to Delaware in April 2021.
- **DDOG** redomiciled from Delaware to Nevada in April 2026; remains US-domiciled.
- All 20 constituents are US-domiciled operating companies.

## Constituents

| # | Ticker | Company | Security Class | Exchange | Listing ✓ | US Domicile ✓ | State | AI Category |
|---|--------|---------|---------------|----------|-----------|---------------|-------|-------------|
| 1 | NVDA | NVIDIA Corporation | Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_COMPUTE |
| 2 | AVGO | Broadcom Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | CUSTOM_SILICON_NETWORKING |
| 3 | AMD | Advanced Micro Devices, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_COMPUTE |
| 4 | MU | Micron Technology, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_MEMORY |
| 5 | MSFT | Microsoft Corporation | Common Stock | NASDAQ | ✅ | ✅ | Washington | HYPERSCALER_AI_PLATFORM |
| 6 | GOOGL | Alphabet Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | HYPERSCALER_AI_PLATFORM |
| 7 | AMZN | Amazon.com, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | HYPERSCALER_AI_PLATFORM |
| 8 | META | Meta Platforms, Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_PLATFORM_INFRASTRUCTURE |
| 9 | PLTR | Palantir Technologies Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | ENTERPRISE_AI |
| 10 | MRVL | Marvell Technology, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_NETWORKING_CUSTOM_SILICON |
| 11 | LRCX | Lam Research Corporation | Common Stock | NASDAQ | ✅ | ✅ | Delaware | SEMICONDUCTOR_EQUIPMENT_AI_CAPEX |
| 12 | AMAT | Applied Materials, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | SEMICONDUCTOR_EQUIPMENT_AI_CAPEX |
| 13 | CDNS | Cadence Design Systems, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | EDA_AI_SEMICONDUCTOR_DESIGN |
| 14 | SNPS | Synopsys, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | EDA_AI_SEMICONDUCTOR_DESIGN |
| 15 | PANW | Palo Alto Networks, Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_CYBERSECURITY |
| 16 | CRWD | CrowdStrike Holdings, Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_CYBERSECURITY |
| 17 | ADBE | Adobe Inc. | Common Stock | NASDAQ | ✅ | ✅ | Delaware | GENERATIVE_AI_SOFTWARE |
| 18 | DDOG | Datadog, Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_CLOUD_OBSERVABILITY |
| 19 | CRWV | CoreWeave, Inc. Class A | Class A Common Stock | NASDAQ | ✅ | ✅ | Delaware | AI_CLOUD_INFRASTRUCTURE |
| 20 | QCOM | QUALCOMM Incorporated | Common Stock | NASDAQ | ✅ | ✅ | Delaware | EDGE_AI_COMPUTE |

## AI Exposure Rationales

### NVDA — NVIDIA Corporation
**Category:** AI_COMPUTE
**Rationale:** Dominant designer and supplier of GPUs and accelerated computing platforms (A100, H100, B100, GB200) used for AI model training and inference. Data center revenue driven overwhelmingly by AI workloads. CUDA software ecosystem is the de facto standard for AI/ML development.
**Sources:** https://www.nasdaq.com/market-activity/stocks/nvda, https://www.sec.gov/edgar/browse/?CIK=1045810, https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm

### AVGO — Broadcom Inc.
**Category:** CUSTOM_SILICON_NETWORKING
**Rationale:** Major supplier of custom AI accelerators (TPUs for Google, custom ASICs for hyperscalers) and high-speed networking silicon essential for AI data center interconnects. VMware acquisition adds AI-relevant infrastructure software.
**Sources:** https://www.nasdaq.com/market-activity/stocks/avgo, https://www.sec.gov/Archives/edgar/data/1730168/000119312518107559/d562806dex31.htm, https://investors.broadcom.com/node/52781/xbrl-viewer

### AMD — Advanced Micro Devices, Inc.
**Category:** AI_COMPUTE
**Rationale:** Second-largest designer of data center GPUs for AI training and inference (Instinct MI300X/MI350 series). EPYC server CPUs power AI-optimized cloud instances. Acquired Xilinx (adaptive AI inference accelerators) and building ROCm open-source AI software stack.
**Sources:** https://www.nasdaq.com/market-activity/stocks/amd, https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm

### MU — Micron Technology, Inc.
**Category:** AI_MEMORY
**Rationale:** Leading manufacturer of High Bandwidth Memory (HBM3E) essential for AI GPU accelerators. DRAM and NAND products serve AI server and storage markets. Revenue growth directly correlated with AI data center capacity expansion.
**Sources:** https://www.nasdaq.com/market-activity/stocks/mu, https://www.sec.gov/edgar/browse/?CIK=723125, https://s25.q4cdn.com/621799436/files/doc_financials/2025/q4/0000723125-25-000028.pdf

### MSFT — Microsoft Corporation
**Category:** HYPERSCALER_AI_PLATFORM
**Rationale:** Largest investor in OpenAI; integrates GPT-4/successor models across Azure OpenAI Service, Microsoft 365 Copilot, GitHub Copilot, and Bing. Azure is a top-2 cloud platform for AI workload hosting. Develops proprietary AI chips (Maia) for internal AI inference.
**Sources:** https://www.nasdaq.com/market-activity/stocks/msft, https://microsoft.gcs-web.com/static-files/e2931fdb-9823-4130-b2a8-f6b8db0b15a9

### GOOGL — Alphabet Inc. Class A
**Category:** HYPERSCALER_AI_PLATFORM
**Rationale:** Alphabet derives substantial revenue from AI across Google Search (Gemini), Google Cloud (Vertex AI, TPU infrastructure), DeepMind research, and Waymo autonomous driving. AI is core to its advertising optimization engine and cloud services growth.
**Sources:** https://www.nasdaq.com/market-activity/stocks/googl, https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm, https://www.sec.gov/edgar/browse/?CIK=0001652044

### AMZN — Amazon.com, Inc.
**Category:** HYPERSCALER_AI_PLATFORM
**Rationale:** AWS is a leading cloud AI platform offering SageMaker, Bedrock, and custom AI chips (Trainium, Inferentia). AI drives product recommendations, Alexa, logistics optimization, and advertising.
**Sources:** https://www.nasdaq.com/market-activity/stocks/amzn, https://www.sec.gov/edgar/browse/?CIK=0001018724, https://ir.aboutamazon.com/corporate-governance/documents-and-charters/certificate-of-incorporation/default.aspx

### META — Meta Platforms, Inc. Class A
**Category:** AI_PLATFORM_INFRASTRUCTURE
**Rationale:** Meta deploys AI extensively for content ranking, ad targeting, and recommendation systems. Massive investments in AI infrastructure (custom GPU clusters), open-source LLMs (Llama series), and AI-driven content creation tools. AI capex is a dominant share of total capital expenditure.
**Sources:** https://www.nasdaq.com/market-activity/stocks/meta, https://www.sec.gov/Archives/edgar/data/1326801/000162828026003942/meta-20251231.htm, https://www.sec.gov/edgar/browse/?CIK=1326801

### PLTR — Palantir Technologies Inc. Class A
**Category:** ENTERPRISE_AI
**Rationale:** Palantir's core platforms (Gotham, Foundry, AIP) are AI/ML-centric data integration and decision-support systems. The Artificial Intelligence Platform (AIP) enables enterprise customers to operationalize LLMs on their own data. Revenue is directly tied to AI-driven analytics.
**Sources:** https://www.nasdaq.com/market-activity/stocks/pltr, https://investors.palantir.com/files/2025%20FY%20PLTR%2010-K.pdf, https://www.sec.gov/Archives/edgar/data/1321655/000132165525000022/0001321655-25-000022-index.htm

### MRVL — Marvell Technology, Inc.
**Category:** AI_NETWORKING_CUSTOM_SILICON
**Rationale:** Marvell designs custom AI accelerators (ASICs), data processing units (DPUs), electro-optics, and networking semiconductors critical to AI/ML data center infrastructure. Custom compute and interconnect products deployed by major hyperscalers for AI training and inference.
**Sources:** https://www.nasdaq.com/market-activity/stocks/mrvl, https://www.sec.gov/edgar/browse/index.html?cik=1835632, https://investor.marvell.com/sec-filings/all-sec-filings/content/0001835632-26-000011/mrvl-20260131.htm

### LRCX — Lam Research Corporation
**Category:** SEMICONDUCTOR_EQUIPMENT_AI_CAPEX
**Rationale:** Leading supplier of wafer fabrication equipment (etch, deposition, clean) used to manufacture advanced AI/ML accelerator chips. Growing AI workload demand directly drives increased capital spending on Lam's equipment by foundries and IDMs producing AI chips at advanced nodes.
**Sources:** https://www.nasdaq.com/market-activity/stocks/lrcx, https://www.sec.gov/edgar/browse/?CIK=CIK0000707549

### AMAT — Applied Materials, Inc.
**Category:** SEMICONDUCTOR_EQUIPMENT_AI_CAPEX
**Rationale:** World's largest semiconductor equipment company. AI chip manufacturing at leading-edge nodes (3nm, 2nm, GAA) requires increasingly complex process steps, directly expanding Applied Materials' addressable market and revenue.
**Sources:** https://www.nasdaq.com/market-activity/stocks/amat, https://www.sec.gov/Archives/edgar/data/6951/000000695124000044/amat-20241027.htm, https://www.sec.gov/edgar/browse/?CIK=6951&owner=exclude

### CDNS — Cadence Design Systems, Inc.
**Category:** EDA_AI_SEMICONDUCTOR_DESIGN
**Rationale:** Provides EDA software, IP, and system design tools essential for designing AI accelerator chips. Cerebrus AI-driven chip design platform uses ML to optimize PPA. Every major AI chip is designed using Cadence tools.
**Sources:** https://www.nasdaq.com/market-activity/stocks/cdns, https://www.sec.gov/edgar/browse/?CIK=813672&owner=exclude

### SNPS — Synopsys, Inc.
**Category:** EDA_AI_SEMICONDUCTOR_DESIGN
**Rationale:** Largest EDA company globally providing design, verification, IP, and silicon lifecycle management tools. DSO.ai platform applies AI/ML to automate chip design exploration. Critical-path infrastructure for designing AI processors.
**Sources:** https://www.nasdaq.com/market-activity/stocks/snps, https://www.sec.gov/Archives/edgar/data/883241/000088324124000024/snps-20241031.htm

### PANW — Palo Alto Networks, Inc.
**Category:** AI_CYBERSECURITY
**Rationale:** Leading cybersecurity platform integrating AI/ML across products. Cortex XSIAM uses AI for autonomous SOC operations, Prisma Cloud applies ML for cloud security, and next-gen firewalls employ ML-based threat detection.
**Sources:** https://www.nasdaq.com/market-activity/stocks/panw, https://www.sec.gov/Archives/edgar/data/1327567/000132756726000023/panw-20260731.htm, https://www.sec.gov/Archives/edgar/data/1327567/000132756726000005/panw-20260131.htm

### CRWD — CrowdStrike Holdings, Inc. Class A
**Category:** AI_CYBERSECURITY
**Rationale:** CrowdStrike's Falcon platform is built on a cloud-native AI engine (Charlotte AI) that uses machine learning and behavioral analytics to detect and prevent endpoint threats in real time, making AI central to its core product and revenue.
**Sources:** https://www.nasdaq.com/market-activity/stocks/crwd, https://www.sec.gov/edgar/browse/?CIK=0001535527, https://materials.proxyvote.com/Approved/22788C/20250425/FO10K_606790/INDEX.HTML?page=1

### ADBE — Adobe Inc.
**Category:** GENERATIVE_AI_SOFTWARE
**Rationale:** Adobe embeds generative AI (Adobe Firefly, Adobe Sensei) across its Creative Cloud, Document Cloud, and Experience Cloud products, driving new revenue from AI-powered content generation, editing, and digital experience personalization.
**Sources:** https://www.nasdaq.com/market-activity/stocks/adbe, https://www.sec.gov/Archives/edgar/data/796343/0000796343-25-000004-index.htm, https://www.sec.gov/Archives/edgar/data/796343/000079634326000003/0000796343-26-000003-index.htm

### DDOG — Datadog, Inc. Class A
**Category:** AI_CLOUD_OBSERVABILITY
**Rationale:** Datadog offers AI-native observability with ML-powered anomaly detection, log pattern clustering, and Bits AI assistant. Its platform monitors AI/ML model performance and LLM applications, positioning it as critical infrastructure for AI workloads.
**Sources:** https://www.nasdaq.com/market-activity/stocks/ddog, https://investors.datadoghq.com/static-files/5b3df1c8-8a56-4bee-8b2d-2e2f70239c36, https://www.sec.gov/Archives/edgar/data/1561550/000162828026043590/R1.htm

### CRWV — CoreWeave, Inc. Class A
**Category:** AI_CLOUD_INFRASTRUCTURE
**Rationale:** CoreWeave operates GPU-accelerated cloud infrastructure purpose-built for AI and ML workloads, providing NVIDIA GPU compute at scale to AI model training and inference customers. AI compute demand is its primary revenue driver.
**Sources:** https://www.nasdaq.com/market-activity/stocks/crwv, https://www.sec.gov/edgar/browse/?CIK=1769628, https://www.sec.gov/Archives/edgar/data/1769628/000119312525044231/d899798ds1.htm

### QCOM — QUALCOMM Incorporated
**Category:** EDGE_AI_COMPUTE
**Rationale:** Qualcomm designs Snapdragon SoCs with integrated AI accelerators (Hexagon NPU) enabling on-device AI inference for smartphones, PCs, automotive, and IoT. AI-capable chip shipments and AI licensing revenue represent a growing share of its business.
**Sources:** https://www.nasdaq.com/market-activity/stocks/qcom, https://www.sec.gov/edgar/browse/?CIK=804328, https://www.sec.gov/Archives/edgar/data/804328/000080432824000075/qcom-20240929.htm

## Exclusions

| Ticker | Reason |
|--------|--------|
| SNOW | NYSE-listed; fails strict Nasdaq listing constraint. |
| ARM | UK-domiciled foreign issuer (Arm Holdings plc, incorporated in England and Wales); excluded under the US-domicile experiment definition. |

## Survivorship bias disclosure

This 20-stock universe is selected using 2026 information and then examined backward.
Historical portfolio results are subject to survivorship/selection bias.
This limitation must be visible in the dashboard and final report.

## Completion

Phase 0 universe verification: **COMPLETE**. All 20 tickers verified for Nasdaq listing, US domicile, security identity, and AI category rationale from authoritative sources.
