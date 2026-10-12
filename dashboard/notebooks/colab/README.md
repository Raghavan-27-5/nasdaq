# Phase 3 — Real Market Data Acquisition (Colab)

`nasdaq_ai_quant_acquire_v001.ipynb` downloads **real** EOD market data for the locked
20-name universe plus QQQ / SOXX / SPY, validates it against the project's quality gates,
and emits the exact JSON schema `dashboard/src/lib/data.ts` consumes.

**Run it in Colab, never locally** — see `AGENTS.md` §2.

---

## Steps

1. Open [colab.research.google.com](https://colab.research.google.com), upload
   `nasdaq_ai_quant_acquire_v001.ipynb`.
2. **Runtime → Run all.** ~1–3 minutes.
3. Mount Drive when prompted.
4. The final cell prints a download link. Save the zip.

The bundle is 4 JSON files + a run manifest. Drop them into `dashboard/src/data/`:

```bash
unzip nasdaq_ai_quant_data.zip -d dashboard/src/data/
```

Existing synthetic fixtures are replaced. `universe.json` is untouched — it stays the
real Phase-0 artifact.

## What lands on Drive

```
NasdaqAIQuant/
├── 03_raw/prices_v001.parquet                    canonical raw EOD
├── 04_clean/clean_prices_v001.parquet            canonical clean
├── 12_dashboard/data/*.json                      dashboard contract
└── 12_dashboard/runs/run_manifest_v001.json      provenance + SHA-256 per file
```

Versioned paths; prior artifacts are never overwritten (`WORKTREE.md` §4).

## What becomes real

| Real after this run | Still synthetic |
|---|---|
| All price series, QQQ / SOXX / SPY | `ML_PORTFOLIO` equity curve |
| Correlation matrix, betas, volatilities | LightGBM IC, ICIR, folds, SHAP |
| Drawdowns, momentum, equal-weight universe | Constrained portfolio weights |
| Calendar-year and regime returns | P/E, revenue growth, FCF, revisions |

The ML curve stays flagged because a real one needs a trained model (Phase 6), not prices.
`backtest.json` carries a `series_provenance` map so the UI can label each curve
individually.

Fundamentals degrade to market-derived factors only (momentum, volatility, drawdown,
diversification), renormalised. Fundamental fields are emitted as `null` and the UI renders
`—`. That is deliberate: emitting invented numbers behind a `"synthetic": false` flag would
be worse than showing nothing.

## Data sources

Source order, per ticker:

1. **Yahoo chart JSON API** (primary) — `query1`/`query2` `/v8/finance/chart/`. No crumb,
   no cookie, no API key, and a stable response schema.
2. **yfinance** (fallback) — column naming varies by version.
3. **Stooq** (last resort).

### Why the chart API is primary

The first delivered version used yfinance first. In Colab it returned a frame for all
23 series, and `normalise()` then reduced **every one to zero rows** — yfinance's column
set shifts between versions (notably `Adj Close` disappearing when `auto_adjust` handling
changed), so the column lookup returned `None` and `dropna` discarded everything. The
symptom was a generic `no rows in window` per ticker, which is why `normalise()` now
prints the source columns and index range when it drops everything.

### Rate limiting

Yahoo returns **HTTP 429** under rapid access. The notebook therefore paces requests
(`REQUEST_DELAY`), rotates between `query1`/`query2`, and backs off exponentially on 429/503,
honouring `Retry-After` when present. Expect roughly 40–60 seconds for the full universe.

### Stooq proof-of-work

Stooq now serves a JavaScript proof-of-work challenge to some clients. A solver is included
but **disabled by default** (`ALLOW_STOOQ_POW = False`): Yahoo is the project's designated
source and works without it, and building an anti-bot circumvention into a research pipeline
is not a trade worth making for a redundant fallback. Flip that flag only if Yahoo becomes
unreachable from your runtime.

## Validation gate

Cell 4 **hard-fails** and raises `SystemExit` rather than emitting a quietly wrong dataset.
Checks map to `QUALITY_GATES.md` Gates 2–3:

- all 23 series retrieved (no silent skips)
- max returned date ≤ frozen cutoff
- benchmarks span the window
- no non-positive closes, no duplicate or unsorted dates
- OHLC consistency
- PLTR / CRWV listing truncation detected
- implausible one-day moves flagged

Acquisition retries per ticker and records the full failure chain
(`chart_api → yfinance → stooq`) in the run manifest rather than skipping silently.

## Conventions

- Returns use **`Adj Close`** (split- and dividend-adjusted) per `RESEARCH_PROTOCOL.md` §5.
  Recorded in the run manifest.
- The chart endpoint's `period2` is one day past the inclusive cutoff because it is
  exclusive upstream; the notebook **asserts** the returned maximum rather than assuming it
  (`PROJECT_SPEC.md` §6).

## Verification status

**Stage 1 — stubbed fixtures.** All 11 code cells executed end-to-end
(`BUNDLE VERIFIED`); the emitted JSON was asserted against the frontend contract,
28/28 schema checks passing. Bugs caught at this stage:

- `"weight"` key missing from three factor definitions
- `FUND_ROWS` used before definition (cell ordering was swapped by wrong index)
- negative array index for mid-window listings such as CRWV, plus an off-by-one in the
  calendar alignment — replaced with calendar-aligned arrays
- shape mismatch pairing three attribution series of different lengths
- the `runs/` directory was never created, so the manifest write raised `FileNotFoundError`
- `pyarrow` added to the install line for the Parquet artifacts

**Stage 2 — live acquisition.** The fetcher was exercised against the real Yahoo endpoint
for all 23 series (1,689 trading days, 2020-01-02 → 2026-09-22), which surfaced the
yfinance column-drift failure described above. That is what motivated the chart API as
primary source, the request pacing, and the diagnostic output in `normalise()`.

## Regenerating

`build_notebook.py` assembles the notebook from cell sources — edit that, not the JSON:

```bash
python3 build_notebook.py
```
