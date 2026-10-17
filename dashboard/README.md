# Dashboard — Nasdaq AI Quant Research Terminal

Phase 11 frontend for the Nasdaq AI Quant Research System. Implements the eight
surfaces required by `PROJECT_SPEC.md` §18.

> **Current status: real acquisition data + real walk-forward model metrics.**
> Prices, risk, equal-weight backtest and ML metrics trace to versioned Colab runs;
> portfolio weights and the ML strategy curve remain labelled placeholders
> (Phases 9–10). See "Data provenance" below and the in-app **Research Audit** page.

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

Regenerate the still-synthetic fixture surfaces (real artifacts — `synthetic:
false` — are never overwritten):

```bash
python3 scripts/gen_demo_data.py    # ~1s, stdlib only, no ML packages
```

Install a Colab training bundle into the dashboard (verifies SHA-256 and re-runs
the metric recomputation before writing `models.json` + the manifest ML row):

```bash
python3 scripts/wire_training_results.py    # requires pandas + pyarrow
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
- Hash routing, so any view is linkable and survives reload.

## Data provenance

| Surface | Status |
|---|---|
| Universe identity, AI category, domicile, rationale, source URLs | **REAL** — from `artifacts/manifests/universe_verification_v001.json` |
| Prices, correlations, betas, volatility, drawdowns (Stock Intelligence / Risk) | **REAL** — Colab acquisition run (`manifest.json` → `acquisition`) |
| Equal-weight / benchmark backtest curves and attribution | **REAL** — computed in the acquisition run |
| Walk-forward ML metrics, folds, IC series, feature importance (ML Lab) | **REAL** — Colab training run, `training_report_v001.json` (`manifest.json` → `training`) |
| Decision ledger, open issues, quality gates | **REAL** — transcribed from `PHASE_LOG.md` / `QUALITY_GATES.md` |
| Fundamental factors (valuation, growth, FCF, revisions) | **PENDING (Phase 1)** — sourced dataset not yet produced |
| Portfolio weights and constraints, ML strategy curve | **SYNTHETIC placeholders** — Phases 9–10 |

Every synthetic artifact carries `"synthetic": true`, a `"disclaimer"` and the
generator seed; real artifacts carry `false` plus run provenance. `manifest.json`
holds the full ledger, and the top-bar data-mode badge / per-panel provenance
chips render from it.

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
all agree with each other. Authored placeholders remain only where the research
pipeline has produced no artifact yet (optimiser output, ML strategy curve,
fundamental factor scores).

The generator is deterministic — same seed, byte-identical output — and runs in
under a second using only the Python standard library, which respects the
`AGENTS.md` local-compute boundary.

## Swapping in real data

Real surfaces arrive as versioned bundles produced on the Colab compute plane:

- **acquisition bundle** → `market` / `risk` / `backtest` / `fundamentals` JSON +
  `manifest.json` (installed from the Colab zip);
- **training bundle** → `scripts/wire_training_results.py` reads
  `artifacts/training_v001/` (Drive-canonical), re-verifies the bundle and writes
  `models.json` plus the manifest ML row and `training` block.

`gen_demo_data.py` never overwrites an artifact flagged `synthetic: false`, and
the manifest merge preserves every real-run row, so regenerating fixtures cannot
downgrade the real surfaces. No page computes a metric itself — every figure is
read from an artifact, so the UI switches over without changing how anything is
calculated.

## Layout

```
dashboard/
├── index.html
├── vite.config.ts · tailwind.config.js · postcss.config.js · tsconfig.json
├── scripts/gen_demo_data.py      deterministic synthetic fixture generator
├── scripts/wire_training_results.py   training bundle → models.json installer
├── serve.sh                      static server for dist/
└── src/
    ├── App.tsx · main.tsx · index.css
    ├── data/  versioned JSON artifacts (real + fixture surfaces; committed)
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
