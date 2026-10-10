# Dashboard — Nasdaq AI Quant Research Terminal

Phase 11 frontend for the Nasdaq AI Quant Research System. Implements the eight
surfaces required by `PROJECT_SPEC.md` §18.

> **Current status: renders SYNTHETIC demo fixtures, not research output.**
> See "Data provenance" below and the in-app **Research Audit** page.

---

## Run it

```bash
cd dashboard
npm install        # first time only
npm run dev        # http://localhost:5173
```

Production build (no Node required at demo time):

```bash
npm run build      # emits dist/
./serve.sh         # serves dist/ on http://localhost:4173
```

`base` is relative, fonts are bundled, and there are no network calls at
runtime — the built `dist/` works fully offline.

Regenerate the synthetic fixtures:

```bash
python3 scripts/gen_demo_data.py    # ~1s, stdlib only, no ML packages
```

## Pages

| # | Page | Contents |
|---|------|----------|
| 1 | Command Center | Headline performance, OOS equity curve, signal quality, risk posture, universe ranking, data-integrity strip |
| 2 | AI Universe | 20-name factor matrix (sortable), composite scoring, value-chain coverage, exclusions and history truncation |
| 3 | Stock Intelligence | Per-name price vs benchmark, factor contributions, fundamentals, risk profile, peer strip |
| 4 | ML Lab | Seven targets, walk-forward folds with purge/embargo, IC series, IC decay, quantile monotonicity, feature importance, hyper-parameters |
| 5 | Portfolio Optimizer | Constrained / unconstrained / equal-weight solutions, constraint register, sector concentration, turnover and cost |
| 6 | Risk Terminal | 20×20 correlation matrix, beta map, marginal and component risk contributions, Ledoit-Wolf diagnostics, stress scenarios |
| 7 | Backtest | OOS equity, strategy comparison, calendar-year returns, factor attribution with t-statistics, regime robustness, cost sensitivity |
| 8 | Research Audit | Real-vs-synthetic ledger, universe verification with source URLs, decision ledger, quality-gate status, limitations |

## Interaction

- `1`–`8` jump between pages; `⌘K` / `/` opens the command palette.
- Selecting a ticker anywhere sets the **global selection** — the top bar and
  every downstream panel follow it. This is what makes the app one terminal
  rather than eight disconnected pages.
- **Audit mode** (top bar) reveals inline `SIM` markers on every panel.
- Hash routing, so any view is linkable and survives reload.

## Data provenance

| Surface | Status |
|---|---|
| Universe identity, AI category, domicile, rationale, source URLs | **REAL** — from `artifacts/manifests/universe_verification_v001.json` |
| Decision ledger, open issues, quality gates | **REAL** — transcribed from `PHASE_LOG.md` / `QUALITY_GATES.md` |
| Everything else — prices, correlations, model metrics, portfolio weights, backtest | **SYNTHETIC** — `scripts/gen_demo_data.py`, seed `20260925` |

Every synthetic artifact carries `"synthetic": true`, a `"disclaimer"`, and the
generator seed. `manifest.json` holds the full ledger. The UI shows a persistent
`DEMO DATA` badge and per-panel provenance chips.

### Why the synthetic data looks real

`scripts/gen_demo_data.py` does not draw random walks and hope. It:

1. builds a **broad factor** as regime-anchored Brownian bridges matching the
   documented research regimes (2020 crash, 2022 growth shock, 2023–24 AI-capex,
   2025 unwind, 2026 continuation);
2. adds three **sector factors** (semis / hyperscalers / software) with
   regime-relative tilts;
3. gives each name `beta × broad + sector_beta × sector + idiosyncratic`, then
   **calibrates each series to a target annualised volatility and an exact
   endpoint** in one step;
4. **computes** correlations, betas, volatilities, drawdowns and the
   equal-weight benchmark from those generated prices.

So the Risk Terminal heatmap, the equity curves and the per-name risk figures
all agree with each other. Only genuinely unobservable quantities (LightGBM IC,
SHAP values, fundamentals, optimiser output) are authored placeholders.

The generator is deterministic — same seed, byte-identical output — and runs in
under a second using only the Python standard library, which respects the
`AGENTS.md` local-compute boundary.

## Swapping in real data

When the Colab pipeline produces the real artifacts, drop them into
`src/data/` with the same filenames and update the interfaces in
`src/lib/data.ts`. No page computes a metric itself — every figure is read from
an artifact, so the UI switches over without changing how anything is calculated.

## Layout

```
dashboard/
├── index.html
├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
├── scripts/gen_demo_data.py      deterministic synthetic fixture generator
├── serve.sh                      static server for dist/
└── src/
    ├── App.tsx · main.tsx · index.css
    ├── data/                     generated JSON artifacts (gitignored)
    ├── lib/       data · store · palette · format · chartopts
    ├── components/
    │   ├── shell/  Sidebar · Topbar · CommandPalette
    │   ├── ui/     Panel · Value · Page
    │   └── charts/ EChart · primitives
    └── pages/      the eight surfaces
```

## Design system

"Ink & Signal" — near-black graphite canvas, hairline borders, one signal
accent. Depth comes from 1px borders rather than shadows; radii are capped at
8px; every numeral is monospace and tabular so columns never jitter. Charts use
a single shared ECharts configuration layer so all eight pages read as one
product. Defined in `tailwind.config.js` and `src/lib/palette.ts`.
