# Colab Notebooks — Data Acquisition (Phase 3) + Model Training (Phases 5/6)

`nasdaq_ai_quant_acquire_v002.ipynb` downloads **real** EOD market data for the locked
20-name universe plus QQQ / SOXX / SPY, validates it against the project's quality gates,
and emits the exact JSON schema `dashboard/src/lib/data.ts` consumes.

**Run it in Colab, never locally** — see `AGENTS.md` §2.

---

## Steps

1. Open [colab.research.google.com](https://colab.research.google.com), upload
   `nasdaq_ai_quant_acquire_v002.ipynb`.
2. **Runtime → Run all.** ~2–4 minutes (acquisition is paced to respect rate limits).
3. Mount Drive when prompted.
4. The final cell prints a download link. Save the zip.

The bundle is 6 JSON files + a run manifest. Drop them into `dashboard/src/data/`:

```bash
unzip nasdaq_ai_quant_data.zip -d dashboard/src/data/
```

The six files: `market.json`, `risk.json`, `backtest.json`, `fundamentals.json`,
`manifest.json` (canonical 12-row provenance ledger + `acquisition` block),
`run_manifest.json`. `universe.json` is included **only if a real one already exists on
your Drive** — the notebook never writes it, and your local Phase-0 copy is preserved
either way.

Existing synthetic fixtures are replaced per-file: `dashboard/src/data/` becomes a
partial-real tree, and the dashboard renders a mixed state (REAL price/risk/backtest
surfaces, SYNTHETIC ML/portfolio surfaces, PENDING fundamental factors). Re-running
`dashboard/scripts/gen_demo_data.py` afterwards will **skip** the real files and keep the
ledger intact (pass `--force` only to reset everything back to fixtures).

## What lands on Drive

```
NasdaqAIQuant/
├── 03_raw/prices_v001.parquet                    canonical raw EOD
├── 04_clean/clean_prices_v001.parquet            clean panel (is_tradable / is_valid flags)
├── 12_dashboard/data/*.json                      dashboard contract
└── 12_dashboard/runs/run_manifest_v001.json      provenance + SHA-256 per file
```

Versioned paths; prior artifacts are never overwritten (`WORKTREE.md` §4).

## What becomes real

| Real after this run | Still synthetic |
|---|---|
| All price series, QQQ / SOXX / SPY | `ML_PORTFOLIO` equity curve |
| Correlation matrix, betas, volatilities | LightGBM IC, ICIR, folds, SHAP |
| Drawdowns, momentum, equal-weight benchmark | Constrained portfolio weights |
| Ledoit-Wolf covariance diagnostics | Factor scores that need fundamentals |
| Realised stress drawdowns (2020 / 2022 / 2025) | Forward P/E, revenue growth, FCF quality |
| Corporate actions (splits / dividends) record | |

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

The source actually used per ticker is recorded in `run_manifest.json`
(`sources.per_ticker`), and the failure chain for any fallback is recorded verbatim.

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
- minimum observation counts and trading-day coverage
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
- Risk statistics describe the **equal-weight reference book**
  (`portfolio_basis: "equal_weight_placeholder"` + `reference_weights`), not a fitted
  portfolio — Phase 9 has not run. VaR/ES are emitted as positive loss magnitudes
  (`var_95_daily > 0`, `var_99 >= var_95`, `es_95 >= var_95`).

## Verifying without Colab

`dry_run_notebook.py` rehearses the whole notebook offline: it neutralises Colab-only
calls, stubs the network fetchers with deterministic frames (including the CRWV listing
gap, corporate actions, and two tickers forced through the tz-aware yfinance fallback
shape), executes every cell, and audits the emitted bundle — ledger parity with
`gen_demo_data.py`, VaR conventions, covariance fit, stress scenario sources, panel
flags, checksums.

```bash
/tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py
```

Exit code 0 = every check passed. Current status: **123/123 checks green** (dry mode; 119/119
in the real-data modes, which skip the stub-only fallback regression). This does not
prove Yahoo reachability — only a real acquisition run does that — but it does prove the
processing chain, schemas, and cross-file consistency on the real code paths.

The same harness has a **live mode** that keeps the real fetchers instead of the stubs:

```bash
/tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py --live
```

It performs the real acquisition (23 series, bounded — a few MB), runs the same audit,
and on a fully green run installs the bundle into `dashboard/src/data/` and copies the
Parquet artifacts to `artifacts/acquisition_v001/` for the manual Drive upload. If any
check fails, nothing is installed. Use it when Colab's shared IP range is too throttled
by Yahoo (HTTP 429) — it is still the same processing code, just executed from the
control plane under explicit owner instruction.

And a **reprocess mode** that recalculates every derived artifact from the *saved frozen
acquisition* instead of the network:

```bash
/tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_notebook.py --from-parquet
```

Frames are rebuilt from `artifacts/acquisition_v001/prices_v001.parquet` (+ the corporate
actions file), the full processing chain re-runs, the same audit gates it, and a green run
re-installs the bundle. Use it after fixing analytics code: it guarantees the dataset
cannot change underneath the correction (Yahoo re-adjusts historical prices as new
dividends accrue, so a re-fetch is not byte-stable). Every mode records its provenance in
`run_context` inside `manifest.json` and `run_manifest.json`.

### Known bug fixed in v002 (keep the regression stubs)

v002's first live Colab attempt surfaced a silent killer: after chart-API 429s, the
yfinance fallback returned a perfect frame (1,689 rows) that `normalise()` then dropped
entirely. Cause: the output frame was built at `idx.normalize()` while the column Series
carried the raw index (yfinance's ET-midnight stamps = 04:00/05:00 UTC). Pandas aligned
on the mismatched timestamps, NaNed every column, and `dropna()` discarded all rows.
Fixed by normalising the index once and using it for both. The harness now routes MU and
QCOM through a forced chart-429 → tz-aware-yfinance stub so this class of bug can never
silently return.

## Verification status

**Stage 1 — stubbed fixtures.** All code cells executed end-to-end (`BUNDLE VERIFIED`);
the emitted JSON was asserted against the frontend contract. Bugs caught at this stage:

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

**Stage 3 — v002 offline rehearsal.** The dry-run harness (above) passes 107/107 checks
over the full v002 pipeline. v002 fixes vs v001: correct VaR/ES quantile + sign
convention, real Ledoit-Wolf shrinkage (no sample-covariance fallback when sklearn is
present), stress scenarios computed from realised benchmark drawdowns, splits/dividends
captured from the chart API, full-panel clean Parquet with `is_tradable` / `is_valid`
flags and SHA-256 checksums, and the canonical provenance ledger written into
`manifest.json`.

**Stage 4 — live acquisition executed (control plane, owner-instructed).** The live path
was run end-to-end via `dry_run_notebook.py --live` (same processing code, real fetchers):
**23/23 series, 1,689 trading days (2020-01-02 → 2026-09-22), validation PASS (26
checks), bundle audit 103/103, 320 corporate-action events, 0 failures.** Yahoo
429-throttled the chart API on every ticker from both Colab's IP range and the local IP;
the fixed yfinance fallback carried all 23 series. Corporate actions captured via the
yfinance actions table included NVDA's two splits (4:1 in 2021, 10:1 in 2024) and AMZN's
single 20:1 split, with non-payers correctly at zero events. Two defects were fixed to
get here: the `normalise()` tz-alignment bug above, and the yfinance fallback silently
returning no corporate actions. The bundle is installed in `dashboard/src/data/`; the
Parquet artifacts are staged in `artifacts/acquisition_v001/` for the Drive upload. Full
record: PHASE_LOG D0024, `artifacts/acquisition_v001/live_run.log`.

## Phase 5/6 — Training notebook (`nasdaq_ai_quant_train_v001.ipynb`)

`nasdaq_ai_quant_train_v001.ipynb` (builder: `build_train_notebook.py`) turns the frozen
clean panel into the project's first real supervised-learning artifacts. It is the producer
of the **pre-registered** artifact names already referenced by the dashboard manifest and
`models.json`:

```
NasdaqAIQuant/
├── 05_features/features_v003.parquet          + feature_meta_v003.json (formulas, availability rule)
├── 06_targets/targets_v002.parquet            long schema, per-row label_start / label_end
├── 07_models/training_report_v001.json        per-target metrics, folds, gain importance
├── 08_predictions/predictions_v007.parquet    OOS walk-forward predictions
└── 12_dashboard/runs/run_manifest_train_v001.json   provenance + SHA-256 per artifact
```

**Prerequisite.** Upload the acquisition outputs first (`03_raw/prices_v001.parquet` and
`04_clean/clean_prices_v001.parquet`); the notebook stops immediately if they are missing.

**Protocol.** Expanding-window walk-forward, quarterly refit (63 trading days) starting
2022-01-03 — the dashboard's out-of-sample epoch. Per-target purge (training labels must
end before the validation window opens, by the target horizon) plus a 5-day embargo; a
rolling 126-trading-day validation window drives early stopping and is never test data.
Seven separate estimators (one per target) with pre-registered parameters; the OOS rows
are never read by fitting, tuning or stopping. Decision convention: daily EOD close
(`RESEARCH_PROTOCOL.md` L21). Features: 18 trailing price/volume columns (returns,
momentum 12-1, realised vols, trend ratios, RSI-14, MACD histogram, volume ratio,
QQQ-relative return/beta, date-local cross-sectional ranks) — all computed from data
through close *t* only.

**What becomes real.** ML Lab IC, ICIR, hit rate, walk-forward folds, feature importance.
**Still synthetic.** ML portfolio curve, optimised weights, net-of-cost strategy stats
(Phase 8–10); SHAP (Phase 7; gain importance only here); fundamental factors (Phase 1).

**Validation.** 24 hard-failing contract checks — truncated-history feature recomputation,
no pre-listing synthesis (CRWV all-NaN before 2025-03-28), label_end alignment, split
geometry + fold coverage on every fold, deterministic refit equality, independent IC
recomputation, and a proof that the only unpredicted label rows are pre-warmup rows
(<5 defined features). A failing run never writes its reporting bundle.

**Verify without Colab** — no LightGBM is installed and nothing is trained locally
(`AGENTS.md` §2); a deterministic stub booster exercises the same code path on the real
frozen Parquet:

```bash
/tmp/opencode/venv/bin/python dashboard/notebooks/colab/dry_run_train.py
```

Exit code 0 = harness audits + all in-notebook checks pass. Current status: **24/24 checks
green** on the frozen acquisition. The canonical Colab run executed **2026-10-17**
(`colab_notebook` context, engine LightGBM, 24/24 checks); its bundle is archived at
`artifacts/training_v001/` (local, git-ignored — the Drive copies are canonical). Result
summary: vol targets strongly predictable (vol_21d IC +0.52); return/direction targets show
no out-of-sample edge with price-only v1 features — the honest null is recorded in
`PHASE_LOG.md` D0030. Wiring `predictions_v007` / `training_report_v001` into the dashboard
is a separate reviewed change.

## Regenerating

Both notebooks are assembled from cell sources — edit the builders, not the JSON:

```bash
python3 dashboard/notebooks/colab/build_notebook.py        # acquisition v002
python3 dashboard/notebooks/colab/build_train_notebook.py  # training v001
```

`nasdaq_ai_quant_acquire_v001.ipynb` is superseded and has been removed; do not resurrect
it. If you find a stray copy, delete it — the PDF-delivered v001 had a broken VaR/ES
convention and no provenance ledger.
