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

Acquisition retries three times per ticker, then falls back to Stooq. Stooq currently
serves a JavaScript proof-of-work challenge to some clients; if it returns HTML the ticker
is recorded as failed and surfaces in the manifest rather than being skipped.

## Conventions

- Returns use **`Adj Close`** (split- and dividend-adjusted) per `RESEARCH_PROTOCOL.md` §5.
  Recorded in the run manifest.
- `END_EXCLUSIVE` is one day past the inclusive cutoff because `yfinance` treats `end` as
  exclusive; the notebook **asserts** the returned maximum rather than assuming it
  (`PROJECT_SPEC.md` §6).

## Verification status

The notebook was executed end-to-end against stubbed fixtures before delivery
(11/11 code cells, `BUNDLE VERIFIED`), and the emitted JSON was checked against the
frontend contract: 28/28 schema assertions pass.

Bugs found and fixed during that verification:

- `"weight"` key missing from three factor definitions
- `FUND_ROWS` used before definition (cell ordering was swapped by wrong index)
- negative array index for mid-window listings such as CRWV, plus an off-by-one in the
  calendar alignment — replaced with calendar-aligned arrays
- shape mismatch pairing three attribution series of different lengths
- the `runs/` directory was never created, so the manifest write raised `FileNotFoundError`
- `pyarrow` added to the install line for the Parquet artifacts

## Regenerating

`build_notebook.py` assembles the notebook from cell sources — edit that, not the JSON:

```bash
python3 build_notebook.py
```
