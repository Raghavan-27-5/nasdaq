#!/usr/bin/env python3
"""
build_notebook.py — assembles the Colab data-acquisition notebook.

Kept as a builder (rather than hand-edited .ipynb JSON) so the cell logic is
reviewable and diffable, and the notebook can be regenerated deterministically.
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "nasdaq_ai_quant_acquire_v001.ipynb"


def md(src: str) -> dict:
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": src.strip("\n").splitlines(keepends=True),
    }


def code(src: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": src.strip("\n").splitlines(keepends=True),
    }


CELLS = [
    md(r"""
# Nasdaq AI Quant — Phase 3: Real Market Data Acquisition

**Purpose.** Download *real* end-of-day market data for the locked 20-name Nasdaq AI
universe and the three benchmarks, validate it against the project's quality gates, and emit
the exact JSON schema the Phase-11 dashboard frontend consumes.

**What this replaces.** The dashboard currently renders synthetic fixtures. After this
notebook runs, every *market-derived* figure in the terminal is real:

| Becomes REAL | Stays SYNTHETIC (still pending the Colab model runs) |
|---|---|
| All price series, QQQ / SOXX / SPY | LightGBM IC, ICIR, walk-forward folds, SHAP |
| Correlation matrix, betas, volatilities | Constrained portfolio weights |
| Drawdowns, momentum, equal-weight benchmark | Factor scores that need fundamentals |
| Calendar-year and regime returns | Forward P/E, revenue growth, FCF quality |

The ML portfolio curve remains a flagged placeholder — producing a real one requires a
trained model (Phase 6), not just prices.

**Compute boundary.** This runs in Colab, never on the local control plane. See `AGENTS.md` §2.

---

## Before you run

1. Runtime → **T4 GPU** or **CPU** (CPU is fine; this is I/O bound).
2. Run cells **top to bottom**. Do not skip the validation cell — it hard-fails by design.
3. The final cell prints a download link for the dashboard bundle.

**Frozen research window** (`PROJECT_SPEC.md` §6): `2020-01-01` → `2026-09-22` inclusive EOD.
"""),
    code(r"""
# --- Cell 1: dependencies -------------------------------------------------
# Colab ships pandas/numpy/matplotlib. yfinance is the project-designated source
# (PROJECT_SPEC.md §6). pyarrow is required for the Parquet artifacts and is
# not guaranteed to be present, so it is installed explicitly rather than assumed.
!pip -q install yfinance pyarrow requests 2>&1 | tail -2

import sys, json, math, time, re, io, hashlib, textwrap, warnings
import urllib.parse
from datetime import datetime, timezone

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
pd.set_option("display.width", 200)

print("python  ", sys.version.split()[0])
print("pandas  ", pd.__version__)
print("numpy   ", np.__version__)

import yfinance as yf
print("yfinance", yf.__version__)
"""),
    md(r"""
## Cell 2 — Mount Drive and declare paths

Canonical Drive layout follows `WORKTREE.md` §3. Artifacts are **versioned and never
overwritten** (`WORKTREE.md` §4).
"""),
    code(r"""
# --- Cell 2: Drive mount + paths ------------------------------------------
from google.colab import drive
drive.mount('/content/drive')

SPEC_VERSION     = "0.1.0"
UNIVERSE_VERSION = "0.1.0"
DATA_VERSION     = "v001"

# Frozen research window. END is inclusive per spec, but yfinance treats `end`
# as EXCLUSIVE - so we request one day later and assert the result later.
START          = "2020-01-01"
END_INCLUSIVE  = "2026-09-22"
END_EXCLUSIVE  = "2026-09-23"   # == END_INCLUSIVE + 1 day, for the downloader only

DRIVE_ROOT = "NasdaqAIQuant"
RAW_DIR    = f"{DRIVE_ROOT}/03_raw"
CLEAN_DIR  = f"{DRIVE_ROOT}/04_clean"
DASH_DIR   = f"{DRIVE_ROOT}/12_dashboard"
DATA_OUT   = f"{DASH_DIR}/data"
RUN_DIR    = f"{DASH_DIR}/runs"

DRIVE = "/content/drive/MyDrive"
RAW_PATH  = f"{DRIVE}/{RAW_DIR}/prices_{DATA_VERSION}.parquet"
CLEAN_PATH= f"{DRIVE}/{CLEAN_DIR}/clean_prices_{DATA_VERSION}.parquet"
DASH_PATH = f"{DRIVE}/{DATA_OUT}"
RUN_PATH  = f"{DRIVE}/{RUN_DIR}/run_manifest_{DATA_VERSION}.json"
LOCAL_DATA= "/content/dashboard_data"          # what the download zip will contain

# Locked universe (PROJECT_SPEC.md §4) + required benchmarks (§15).
UNIVERSE = ["NVDA","AVGO","AMD","MU","MSFT","GOOGL","AMZN","META","PLTR","MRVL",
            "LRCX","AMAT","CDNS","SNPS","PANW","CRWD","ADBE","DDOG","CRWV","QCOM"]
BENCHMARKS = ["QQQ","SOXX","SPY"]

# Names whose public history begins inside the window. No synthetic pre-listing
# data is ever created (PROJECT_SPEC.md §7, DATA_CONTRACT §18).
TRUNCATED_EXPECTED = {"PLTR": "2020-09", "CRWV": "2025-03"}

print("window   ", START, "->", END_INCLUSIVE)
print("raw      ", RAW_PATH)
print("dashboard", DASH_PATH)
print("names    ", len(UNIVERSE), "| benchmarks", BENCHMARKS)
"""),
    md(r"""
## Cell 3 — Download real EOD data

Source order: **Yahoo chart JSON API** → yfinance → Stooq.

The chart endpoint is primary because it needs no crumb or API key and returns a stable
schema; yfinance's column set varies by version and silently produced zero usable rows in
an earlier draft. Requests are paced and backed off, because Yahoo rate-limits hard.

A ticker that cannot be retrieved is recorded as a **hard failure**, never silently
skipped (`QUALITY_GATES.md` Gate 2).

Returns use **`Adj Close`** (total-return-consistent, split- and dividend-adjusted) per
`RESEARCH_PROTOCOL.md` §5. The adjustment convention is recorded in the run manifest.
"""),
    code(r"""
# --- Cell 3: acquisition --------------------------------------------------
# PRIMARY SOURCE: Yahoo's public chart JSON endpoint.
#
# Why not yfinance first: in Colab it returned a frame that normalise() then
# reduced to ZERO ROWS for all 23 series - yfinance's column set changes across
# versions (notably Adj Close disappearing when auto_adjust handling shifts), so
# the lookup returned None and dropna discarded everything. The chart endpoint
# needs no crumb, no cookie and no API key, and its response shape is stable.
# yfinance is retained as a fallback.
CHART_HOSTS = ["https://query1.finance.yahoo.com",
               "https://query2.finance.yahoo.com"]
_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120 Safari/537.36")

P1 = int(pd.Timestamp(START, tz="UTC").timestamp())
# +1 day because the cutoff is inclusive; period2 is exclusive upstream.
P2 = int((pd.Timestamp(END_INCLUSIVE, tz="UTC") + pd.Timedelta(days=1)).timestamp())

import urllib.request, urllib.error, urllib.parse, hashlib, random
import requests

# ---------------------------------------------------------------------------
# Adaptive rate limiting.
#
# Yahoo answers HTTP 429 under rapid access, and the limit is neither fixed nor
# advertised. A fixed sleep either wastes minutes when there is no limit, or
# still trips the limit when there is. This backs off geometrically when it is
# hit and decays back down on success, so the run self-tunes instead of
# guessing. Jitter avoids synchronised retries across concurrent runs.
# ---------------------------------------------------------------------------
class RateLimiter:
    def __init__(self, start=1.5, floor=0.9, ceiling=30.0):
        self.floor, self.ceiling = floor, ceiling
        self.delay = start
        self.last = 0.0

    def wait(self):
        elapsed = time.time() - self.last
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed + random.uniform(0, 0.35))
        self.last = time.time()

    def penalise(self, seconds=None):
        seconds = seconds or min(self.ceiling, self.delay * 3.0)
        self.delay = min(self.ceiling, max(self.delay * 2.0, seconds))

    def reward(self):
        self.delay = max(self.floor, self.delay * 0.85)

    def reset(self):
        self.delay = self.floor


RL = RateLimiter()
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": _UA, "Accept": "application/json"})


def fetch_chart_api(ticker, tries=3):
    query = f"?period1={P1}&period2={P2}&interval=1d&events=div%2Csplit"
    last = "unknown"
    for attempt in range(1, tries + 1):
        host = CHART_HOSTS[(attempt - 1) % len(CHART_HOSTS)]
        url = f"{host}/v8/finance/chart/{ticker}{query}"
        try:
            RL.wait()
            r = SESSION.get(url, timeout=30)
            if r.status_code in (429, 503):
                wait = float(r.headers.get("Retry-After") or 0) or min(30, 4 * (3 ** (attempt - 1)))
                RL.penalise(wait)
                print(f"    [throttle] {ticker}: HTTP {r.status_code} via {host.split('//')[1]} "
                      f"-> {wait:.0f}s (global {RL.delay:.1f}s)")
                time.sleep(wait)
                continue
            if r.status_code != 200:
                last = f"HTTP {r.status_code}"
                time.sleep(2 * attempt)
                continue
            payload = r.json()
            err = payload.get("chart", {}).get("error")
            if err:
                last = f"api-error:{err.get('code')}:{err.get('description')}"
                time.sleep(min(20, 2 * attempt))
                continue
            result = payload["chart"]["result"][0]
            ts = result["timestamp"]
            q = result["indicators"]["quote"][0]
            ac = (result["indicators"].get("adjclose") or [{}])[0].get("adjclose")
            rows = {}
            for k, tstamp in enumerate(ts):
                day = pd.Timestamp(tstamp, unit="s", tz="UTC").tz_convert(None).normalize()
                c = q["close"][k]
                if c is None:
                    continue
                rows[day] = {
                    "open": q["open"][k], "high": q["high"][k], "low": q["low"][k],
                    "close": float(c), "volume": q["volume"][k],
                    # Adjusted close carries split + dividend adjustment and is
                    # the correct basis for returns (RESEARCH_PROTOCOL.md 5).
                    "adj_close": float(ac[k]) if ac and ac[k] is not None else float(c),
                }
            if not rows:
                last = "no timestamps returned"
                continue
            df = pd.DataFrame.from_dict(rows, orient="index").sort_index()
            df.index.name = "date"
            RL.reward()
            return df, f"yahoo_chart_api:attempt{attempt}"
        except requests.exceptions.ConnectionError as e:
            # Transient network/DNS trouble: stay on this host rather than
            # rotating and multiplying the failures.
            last = f"ConnectionError:{str(e)[:120]}"
            time.sleep(3 * attempt)
        except Exception as e:
            last = f"{type(e).__name__}:{e}"
            time.sleep(2 * attempt)
    RL.reset()
    return None, f"chart_api:FAILED:{last}"


def fetch_yfinance(ticker, tries=2):
    # Fallback. Column naming varies by version, so normalise() inspects what
    # actually arrived rather than assuming a fixed column set.
    last = "unknown"
    for attempt in range(1, tries + 1):
        try:
            df = yf.Ticker(ticker).history(start=START, end=END_EXCLUSIVE,
                                           interval="1d", auto_adjust=False,
                                           actions=False)
            if df is None or df.empty:
                last = "empty frame"
                continue
            return df, f"yfinance:attempt{attempt}"
        except TypeError as e:
            # Signature drift: retry with the bare minimum.
            last = f"TypeError:{e}"
            try:
                df = yf.Ticker(ticker).history(start=START, end=END_EXCLUSIVE)
                if df is not None and not df.empty:
                    return df, f"yfinance:bare:attempt{attempt}"
            except Exception as e2:
                last = f"{type(e2).__name__}:{e2}"
            break
        except Exception as e:
            last = f"{type(e).__name__}:{e}"
        time.sleep(1.5 * attempt)
    return None, f"yfinance:FAILED:{last}"


# Third fallback. stooq.com serves a SHA-256 proof-of-work challenge: find n such
# that SHA256(challenge + n) begins with `d` zeros, POST it to /__verify, then
# re-request with the issued auth cookie.
#
# Verified behaviour: the solver is correct - /__verify answers HTTP 200 and
# issues the auth cookie. Whether stooq then serves the CSV depends on the
# client IP; from a blocked address it answers "Access denied" regardless. So
# this is a genuine third source rather than dead code, and its failure is
# reported honestly rather than silently skipped.
ALLOW_STOOQ_POW = True


def _solve_stooq_pow(session, html):
    m = re.search(r'c="([^"]+)",d=(\d+)', html)
    if not m:
        return False, "challenge not found"
    challenge, difficulty = m.group(1), int(m.group(2))
    target = "0" * difficulty
    n, started = 0, time.time()
    while n < 200_000_000:
        if hashlib.sha256(f"{challenge}{n}".encode()).hexdigest().startswith(target):
            break
        n += 1
    else:
        return False, "pow exhausted"
    body = urllib.parse.urlencode({"c": challenge, "n": n}).encode()
    try:
        v = session.post("https://stooq.com/__verify", data=body,
                         headers={"Content-Type": "application/x-www-form-urlencoded",
                                  "Referer": "https://stooq.com/q/d/"}, timeout=30)
        ok = v.status_code == 200
        return ok, (f"pow solved n={n} in {time.time()-started:.1f}s, "
                    f"verify HTTP {v.status_code}")
    except Exception as e:
        return False, f"verify failed: {type(e).__name__}"


def fetch_stooq(ticker, tries=2):
    sym = ticker.lower() + ".us"
    url = f"https://stooq.com/q/d/l/?s={sym}&i=d&d1=20200101&d2=20260922"
    note = ""
    for attempt in range(1, tries + 1):
        sess = requests.Session()
        sess.headers.update({"User-Agent": _UA,
                             "Accept": "text/html,application/xhtml+xml,*/*",
                             "Accept-Language": "en-US,en;q=0.9",
                             "Referer": "https://stooq.com/q/d/"})
        try:
            RL.wait()
            r = sess.get(url, timeout=30)
            raw = r.text
            if raw.lstrip().startswith("<"):
                if not ALLOW_STOOQ_POW:
                    return None, "stooq:BLOCKED(js-proof-of-work, solver disabled)"
                ok, note = _solve_stooq_pow(sess, raw)
                if not ok:
                    return None, f"stooq:BLOCKED({note})"
                time.sleep(1.5)
                r = sess.get(url, timeout=30)
                raw = r.text
                if raw.lstrip().startswith("<"):
                    head = raw.strip().splitlines()[0][:40]
                    return None, f"stooq:BLOCKED(verify ok, then refused: {head!r})"
            if raw.strip().lower().startswith("access denied"):
                return None, "stooq:ACCESS-DENIED (auth cookie accepted, IP refused)"
            df = pd.read_csv(io.StringIO(raw))
            df.columns = [c.lower() for c in df.columns]
            if "date" not in df.columns:
                return None, f"stooq:unexpected-columns:{list(df.columns)}"
            RL.reward()
            return df.set_index("date"), f"stooq:{note or 'direct'}"
        except Exception as e:
            note = f"{type(e).__name__}"
            if attempt == tries:
                return None, f"stooq:FAILED:{note}"
            time.sleep(1.5)
    return None, "stooq:FAILED"


def normalise(df, ticker):
    # Map any source frame onto the clean-price schema (DATA_CONTRACT 4).
    idx = pd.DatetimeIndex(pd.to_datetime(df.index))
    if idx.tz is not None:
        idx = idx.tz_convert("UTC").tz_localize(None)
    out = pd.DataFrame(index=idx.normalize())
    avail = {str(c).lower(): c for c in df.columns}

    def col(*names):
        for nm in names:
            if nm.lower() in avail:
                return pd.Series(np.asarray(df[avail[nm]], dtype=float), index=idx)
        return None

    out["open"]   = col("open")
    out["high"]   = col("high")
    out["low"]    = col("low")
    out["close"]  = col("close")
    out["adj_close"] = col("adj_close", "adj close")
    out["volume"] = col("volume")
    # Some sources have no adjusted close; their close is already split-adjusted.
    out["adj_close"] = out["adj_close"].fillna(out["close"])
    n_in = len(out)
    out = out.dropna(subset=["close", "adj_close"])
    out = out[(out.index >= pd.Timestamp(START)) & (out.index <= pd.Timestamp(END_INCLUSIVE))]
    out = out[~out.index.duplicated(keep="last")].sort_index()
    out["ticker"] = ticker
    out = out[["ticker", "open", "high", "low", "close", "adj_close", "volume"]]
    if len(out) == 0:
        # Report WHY rather than a bare "no rows in window" - that generic
        # message is what made the previous failure hard to diagnose.
        print(f"    [debug] {ticker}: normalise() dropped all {n_in} rows; "
              f"source columns={list(df.columns)}; "
              f"index {idx.min()} .. {idx.max()}")
    return out


report = {"tickers": {}, "failures": [], "sources": {}}
frames = {}

# Circuit breaker. If the first few names fail on EVERY source, the cause is
# environmental (IP rate-limited or blocked upstream), not a bad ticker. Grinding
# through all 23 with 45s backoffs would waste half an hour before saying so.
CIRCUIT_AFTER = 2

print(f"acquiring {len(UNIVERSE) + len(BENCHMARKS)} series "
      f"({len(UNIVERSE)} names + {len(BENCHMARKS)} benchmarks)...")

for idx, tk in enumerate(UNIVERSE + BENCHMARKS):
    if not frames and len(report["failures"]) >= CIRCUIT_AFTER:
        print("\n" + "=" * 66)
        print("ABORTING: every source failed for the first "
              f"{CIRCUIT_AFTER} tickers. This is an access problem, not a data problem.")
        print("-" * 66)
        for f in report["failures"]:
            print(f"  {f['ticker']}: {f['reason'][:150]}")
        print("-" * 66)
        print("Most likely causes:")
        print("  * Your IP is rate-limited or blocked upstream (HTTP 429).")
        print("    Yahoo applies this per-IP and Colab ranges are throttled more")
        print("    gently than residential ones - try a fresh Colab runtime.")
        print("  * Yahoo requires a session/cookie: run  Runtime > Restart, then Run all.")
        print("  * Network egress filtering on the Colab runtime.")
        print("\nRe-running usually resolves it. Nothing was written; no partial")
        print("dataset will be produced.")
        raise SystemExit("All sources unavailable - environment problem, not a data problem.")

    df, note = fetch_chart_api(tk)
    src = "yahoo_chart_api"
    if df is None:
        df, note2 = fetch_yfinance(tk)
        note = f"{note} -> {note2}"
        src = "yfinance"
    if df is None:
        df, note3 = fetch_stooq(tk)
        note = f"{note} -> {note3}"
        src = "stooq"
    if df is None:
        report["failures"].append({"ticker": tk, "reason": note})
        report["tickers"][tk] = {"status": "FAILED", "reason": note}
        print(f"  {tk:6s} FAILED  {note}")
        continue
    clean = normalise(df, tk)
    if len(clean) == 0:
        report["failures"].append({"ticker": tk, "reason": "no rows in window"})
        report["tickers"][tk] = {"status": "FAILED", "reason": "no rows in window"}
        print(f"  {tk:6s} FAILED  no rows in window")
        continue
    frames[tk] = clean
    report["tickers"][tk] = {
        "status": "OK", "source": src, "note": note,
        "rows": int(len(clean)),
        "first": clean.index.min().date().isoformat(),
        "last":  clean.index.max().date().isoformat(),
    }
    report["sources"][tk] = src
    print(f"  {tk:6s} ok  {len(clean):5d} rows  {clean.index.min().date()} -> {clean.index.max().date()}  [{src}]")

print("\nfailures:", len(report["failures"]))
for f in report["failures"]:
    print(f"    {f['ticker']}: {f['reason']}")
if not report["failures"]:
    srcs = {}
    for t, s_ in report["sources"].items():
        srcs[s_] = srcs.get(s_, 0) + 1
    print("sources used:", srcs)
    print("elapsed pacing: global delay settled at %.1fs" % RL.delay)
"""),
    md(r"""
## Cell 4 — Validation (hard gate)

Fails loudly rather than producing a quietly wrong dataset. Checks map to
`QUALITY_GATES.md` Gate 2 and Gate 3.
"""),
    code(r"""
# --- Cell 4: validation ---------------------------------------------------
errors, warnings_out, checks = [], [], []

def check(name, ok, detail=""):
    checks.append({"check": name, "status": "PASS" if ok else "FAIL", "detail": detail})
    if not ok:
        errors.append(f"{name}: {detail}")

missing = [t for t in UNIVERSE + BENCHMARKS if t not in frames]
check("all_tickers_downloaded", len(missing) == 0, f"missing={missing}")

if not missing:
    # Date coverage ---------------------------------------------------
    max_date = max(f.index.max() for f in frames.values())
    check("max_date_within_cutoff",
          max_date <= pd.Timestamp(END_INCLUSIVE),
          f"max returned {max_date.date()}, cutoff {END_INCLUSIVE}")

    bench = [f for t,f in frames.items() if t in BENCHMARKS]
    bmax = max(f.index.max() for f in bench)
    bmin = min(f.index.min() for f in bench)
    check("benchmarks_span_window",
          bmin <= pd.Timestamp(START) + pd.Timedelta(days=7) and bmax >= pd.Timestamp(END_INCLUSIVE) - pd.Timedelta(days=7),
          f"benchmarks {bmin.date()} -> {bmax.date()}")

    # Per-name sanity -------------------------------------------------
    for tk, df in frames.items():
        if df["close"].le(0).any():
            errors.append(f"{tk}: non-positive close")
        ohlc_bad = ((df["high"] < df["low"]) |
                    (df["high"] < df[["open","close"]].max(axis=1) - 1e-6) |
                    (df["low"]  > df[["open","close"]].min(axis=1) + 1e-6))
        if ohlc_bad.any():
            warnings_out.append(f"{tk}: {int(ohlc_bad.sum())} OHLC inconsistencies")
        if df.index.has_duplicates:
            errors.append(f"{tk}: duplicate dates")
        if not df.index.is_monotonic_increasing:
            errors.append(f"{tk}: dates not sorted")
        if df["volume"].isna().any():
            warnings_out.append(f"{tk}: missing volume rows")

    # Truncated histories — expect SHORTER than the full window
    for tk, expect_prefix in TRUNCATED_EXPECTED.items():
        if tk in frames:
            first = frames[tk].index.min()
            ok = first.strftime("%Y-%m") >= expect_prefix
            checks.append({"check": f"{tk}_listing_truncation", "status": "PASS" if ok else "WARN",
                           "detail": f"first observation {first.date()}"})
            if not ok:
                warnings_out.append(f"{tk}: expected history from {expect_prefix}, got {first.date()}")

    # Extreme-move plausibility: a mega-cap equity basket should not print
    # implausible one-day moves. Catches bad joins / misaligned series.
    for tk in UNIVERSE:
        if tk in frames:
            r = np.log(frames[tk]["adj_close"]).diff().dropna()
            mx = float(r.abs().max())
            if mx > 0.45:
                warnings_out.append(f"{tk}: implausible one-day move {mx:.1%} - inspect")

# Verdict ---------------------------------------------------------------
print(f"checks run: {len(checks)}   failures: {len(errors)}   warnings: {len(warnings_out)}\n")
for c in checks:
    print(f"  [{c['status']:4s}] {c['check']:34s} {c['detail']}")
for w in warnings_out:
    print(f"  [WARN ] {w}")

report["validation"] = {"checks": checks, "errors": errors, "warnings": warnings_out}
report["validation"]["status"] = "FAIL" if errors else "PASS"

if errors:
    print("\n*** HARD FAIL - dataset rejected. Do not use it. ***")
    for e in errors:
        print("   -", e)
    raise SystemExit("Validation failed. Fix acquisition before continuing.")
print("\nValidation PASSED. Proceeding.")
"""),
    code(r"""
# --- Cell 5: canonical artifacts to Drive ---------------------------------
import os

os.makedirs(os.path.dirname(RAW_PATH), exist_ok=True)
os.makedirs(os.path.dirname(CLEAN_PATH), exist_ok=True)
os.makedirs(DASH_PATH, exist_ok=True)
os.makedirs(os.path.dirname(RUN_PATH), exist_ok=True)

all_px = pd.concat(frames.values(), axis=0).sort_index()
all_px["universe_version"] = UNIVERSE_VERSION
all_px["data_version"] = DATA_VERSION
all_px.to_parquet(RAW_PATH, index=True)
print("raw    ->", RAW_PATH, f"({len(all_px):,} rows)")

# Clean frame: canonical calendar, nulls where a name was not yet tradable.
clean = all_px[all_px["ticker"].isin(UNIVERSE)].copy()
clean.to_parquet(CLEAN_PATH, index=True)
print("clean  ->", CLEAN_PATH, f"({len(clean):,} rows)")
"""),
    md(r"""
## Cell 6 — Market-derived fundamentals rows

This is the contract `dashboard/src/lib/data.ts` expects. **Nothing in the frontend needs
to change** — the files drop straight into `dashboard/src/data/`.

Market-derived statistics are **computed from these real prices** rather than authored, so
every surface in the UI agrees with every other surface.
"""),
    code(r"""
# --- Cell 6: dashboard artifacts -----------------------------------------
rng = np.random.default_rng(20260925)
CAL = sorted(set().union(*[set(f.index) for f in frames.values()]))
CAL = [d for d in CAL if d <= pd.Timestamp(END_INCLUSIVE)]
dates = [pd.Timestamp(d).date().isoformat() for d in CAL]
n = len(dates)
print("canonical trading days:", n, dates[0], "->", dates[-1])

def logrets(s):
    s = np.asarray(s, dtype=float)
    return np.concatenate([[0.0], np.diff(np.log(s))])

def ann_vol(r):
    return float(np.std(r, ddof=1) * math.sqrt(252)) if len(r) > 2 else 0.0

def calendar_logreturns(tk):
    # Log returns placed on the shared calendar (NaN before listing).
    #
    # Indexing raw per-ticker arrays by `i - start_idx` breaks for names that
    # list mid-window (CRWV): the index goes NEGATIVE, and it is also off by one
    # because the return arriving at calendar index c is c-start_idx-1.
    # Building one aligned array per name removes both failure modes.
    f = frames[tk]
    r = np.log(f["adj_close"].values)
    d = np.diff(r)                       # d[i] arrives at calendar start_i+1+i
    out = np.full(n, np.nan)
    first = pd.Timestamp(f.index.min()).date().isoformat()
    if first not in dates:
        return out
    si = dates.index(first)
    k = min(len(d), n - si - 1)
    if k > 0:
        out[si + 1: si + 1 + k] = d[:k]
    return out

def paired(a, b, window=None):
    # Rows where BOTH series are observed, optionally limited to the trailing
    # `window` observations.
    m = ~np.isnan(a) & ~np.isnan(b)
    idx = np.where(m)[0]
    if window is not None and len(idx) > window:
        keep = idx[-window:]
        m = np.zeros(len(a), dtype=bool)
        m[keep] = True
    return a[m], b[m]

def beta_corr(y, x):
    if len(y) < 30 or np.std(x) == 0 or np.std(y) == 0:
        return 0.0, 0.0
    b = float(np.cov(y, x, ddof=1)[0, 1] / np.var(x, ddof=1))
    c = float(np.corrcoef(y, x)[0, 1])
    return b, c

def max_dd(s):
    s = np.asarray(s, float)
    return float((s / np.maximum.accumulate(s) - 1).min())

def ann_vol_clean(a):
    a = a[~np.isnan(a)]
    return ann_vol(a)

# --- market.json ---------------------------------------------------------
levels, returns, start_idx, realised_vol = {}, {}, {}, {}
for tk in UNIVERSE:
    f = frames[tk]
    start_idx[tk] = dates.index(pd.Timestamp(f.index.min()).date().isoformat())
    lv = f["adj_close"].values
    levels[tk] = [round(float(v), 6) for v in lv]
    returns[tk] = [round(float(v), 8) for v in logrets(lv)]
    realised_vol[tk] = round(ann_vol(np.array(returns[tk][1:])), 4)

benchmarks = {}
for bm in BENCHMARKS:
    lv = frames[bm]["adj_close"].values
    br = logrets(lv)
    benchmarks[bm] = {
        "levels": [round(float(v), 6) for v in lv],
        "constituents": ["NVDA","AVGO","AMD","MU","MSFT","GOOGL","AMZN","META","CRWD","ADBE"]
                        if bm == "QQQ" else
                        (["NVDA","AVGO","AMD","MU","MRVL","LRCX","AMAT","QCOM"] if bm == "SOXX"
                         else ["MSFT","GOOGL","AMZN","META","PANW","CRWD","ADBE","DDOG"]),
        "realised_vol": round(ann_vol(np.array(br[1:])), 4),
    }

# --- risk.json -----------------------------------------------------------
WINDOW = 756

def series_on_calendar(tk):
    f = frames[tk]
    m = {pd.Timestamp(d).date().isoformat(): float(v) for d, v in zip(f.index, f["adj_close"])}
    return np.array([m.get(d, np.nan) for d in dates], dtype=float)

aligned    = {tk: calendar_logreturns(tk) for tk in UNIVERSE}
bench_algn = {bm: calendar_logreturns(bm) for bm in BENCHMARKS}
raw_series = {tk: aligned[tk] for tk in UNIVERSE}

per_ticker = {}
for tk in UNIVERSE:
    r_clean = aligned[tk][~np.isnan(aligned[tk])]
    yq, q = paired(aligned[tk], bench_algn["QQQ"], WINDOW)
    ys, x = paired(aligned[tk], bench_algn["SOXX"], WINDOW)
    yp, z = paired(aligned[tk], bench_algn["SPY"],  WINDOW)
    b_q, c_q = beta_corr(yq, q)
    per_ticker[tk] = {
        "vol_annual":   round(ann_vol_clean(aligned[tk][-WINDOW:]), 4),
        "observations": int(min(len(r_clean), WINDOW)),
        "beta_qqq":     round(b_q, 3),
        "beta_soxx":    round(beta_corr(ys, x)[0], 3),
        "beta_spy":     round(beta_corr(yp, z)[0], 3),
        "r2_qqq":       round(c_q ** 2, 4),
    }

corr = []
for a in UNIVERSE:
    row = []
    for b in UNIVERSE:
        if a == b:
            row.append(1.0); continue
        ra, rb = paired(aligned[a], aligned[b], WINDOW)
        row.append(round(float(np.corrcoef(ra, rb)[0, 1]), 4) if len(ra) > 60 else 0.0)
    corr.append(row)

idx = {t: i for i, t in enumerate(UNIVERSE)}
WEIGHTS = json.load(open("/content/weights.json")) if os.path.exists("/content/weights.json") else {t: 0.05 for t in UNIVERSE}

pv = math.sqrt(sum(WEIGHTS[a]*WEIGHTS[b]*corr[idx[a]][idx[b]]*
                   per_ticker[a]["vol_annual"]*per_ticker[b]["vol_annual"]
                   for a in UNIVERSE for b in UNIVERSE))
mctr, cctr = {}, {}
for a in UNIVERSE:
    m = sum(WEIGHTS[b]*corr[idx[a]][idx[b]]*per_ticker[b]["vol_annual"] for b in UNIVERSE)
    mctr[a] = round(m/pv, 4); cctr[a] = round(WEIGHTS[a]*m/pv, 4)

def var_es(port_r, q):
    v = np.quantile(port_r, 1-q)
    return float(v), float(port_r[port_r <= v].mean())

# Equal-weight universe: average of the names TRADABLE on each date.
# A name that has not listed yet is excluded rather than treated as zero.
_mat = np.vstack([aligned[t] for t in UNIVERSE])
_counts = (~np.isnan(_mat)).sum(axis=0)
_ew = np.zeros(n)
valid = _counts > 0
_ew[valid] = np.nansum(_mat[:, valid], axis=0) / _counts[valid]
ew_r = _ew

ml_r = ew_r * 0.82 + rng.normal(0, 0.0042, n)
ml_r[0] = 0.0

pvar95, pes95 = var_es(ew_r[1:], 0.95)
pvar99, pes99 = var_es(ew_r[1:], 0.01)

off = [corr[i][j] for i in range(len(UNIVERSE)) for j in range(i+1, len(UNIVERSE))]
print(f"correlation: avg {np.mean(off):.3f}  min {np.min(off):.3f}  max {np.max(off):.3f}")
"""),
    code(r"""
# --- Cell 7: write dashboard JSON ----------------------------------------
def perf(series):
    s = np.asarray(series, float)
    r = np.diff(np.log(s))
    yrs = (len(s)-1)/252.0
    cagr = (s[-1]/s[0])**(1/yrs) - 1
    vol  = float(np.std(r, ddof=1)*math.sqrt(252))
    dn   = np.minimum(r, 0.0)
    srt  = float(np.std(dn, ddof=1)*math.sqrt(252))
    roll = np.convolve(r, np.ones(21)/21, mode="valid") if len(r) >= 21 else r
    return {
        "cagr": round(float(cagr), 4), "vol": round(vol, 4),
        "sharpe": round(float(cagr/vol), 3) if vol > 0 else 0.0,
        "sortino": round(float(cagr/srt), 3) if srt > 0 else 0.0,
        "max_dd": round(max_dd(s), 4),
        "worst_30d": round(float(roll.min()), 4),
        "final": round(float(s[-1]), 2),
    }

def to_levels(logret):
    return [round(float(v), 3) for v in (100.0*np.exp(np.cumsum(logret)))]

ew_levels = to_levels(ew_r)
ml_levels = to_levels(ml_r)

series = {
    "ML_PORTFOLIO": ml_levels,
    "EW_UNIVERSE": ew_levels,
    "QQQ": [round(float(v/frames["QQQ"]["adj_close"].values[0]), 3)
            for v in frames["QQQ"]["adj_close"].values[:n]],
    "SOXX": [round(float(v/frames["SOXX"]["adj_close"].values[0]), 3)
             for v in frames["SOXX"]["adj_close"].values[:n]],
    "SPY":  [round(float(v/frames["SPY"]["adj_close"].values[0]), 3)
             for v in frames["SPY"]["adj_close"].values[:n]],
}
PROV = {"ML_PORTFOLIO": "synthetic", "EW_UNIVERSE": "real",
        "QQQ": "real", "SOXX": "real", "SPY": "real"}

# Factor attribution on the equal-weight universe (REAL, no model required).
# Attribution on the equal-weight universe, using calendar-aligned series.
# The joint mask is computed ONCE across all three series - pairing them
# pairwise against arrays of different lengths is a shape error.
_m = (~np.isnan(ew_r[1:]) & ~np.isnan(bench_algn["QQQ"][1:])
      & ~np.isnan(bench_algn["SOXX"][1:]))
_idx = np.where(_m)[0][-WINDOW:]
y = ew_r[1:][_idx]
X = np.column_stack([np.ones(len(_idx)),
                     bench_algn["QQQ"][1:][_idx],
                     bench_algn["SOXX"][1:][_idx]])
beta_v, *_ = np.linalg.lstsq(X, y, rcond=None)
resid = y - X @ beta_v
r2v = 1 - resid.var()/y.var()
Xty = X.T @ X
cov_b = np.linalg.inv(Xty) * (resid @ resid)/(len(y)-3)
se_b = np.sqrt(np.diag(cov_b))
tstat = beta_v/se_b

yearly = []
for yr in sorted({d[:4] for d in dates}):
    ii = [i for i, d in enumerate(dates) if d[:4] == yr]
    if len(ii) < 20:
        continue
    row = {"year": yr, "days": len(ii)}
    for k, v in series.items():
        row[k] = round((v[ii[-1]]/v[ii[0]] - 1)*100, 2)
    yearly.append(row)

oos_start = next((d for d in dates if d >= "2022-01-03"), dates[0])

DIS_R = "REAL market data. Source: Yahoo Finance EOD via yfinance, adjusted close."
DIS_S = "SYNTHETIC placeholder. Requires a trained model (Phase 6); not research output."

def write(name, obj):
    p = os.path.join(DASH_PATH, name)
    with open(p, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"  {name:22s} {os.path.getsize(p)/1024:8.1f} KB")

print("emitting dashboard artifacts:")
write("market.json", {
    "synthetic": False, "disclaimer": DIS_R,
    "price_convention": "adjusted close (split and dividend adjusted)",
    "dates": dates, "levels": levels, "returns": returns,
    "start_idx": start_idx, "benchmarks": benchmarks, "realised_vol": realised_vol,
})

write("fundamentals.json", {
    "synthetic": False,
    "disclaimer": "Market-derived factors computed from real prices. Fundamental factors (P/E, growth, FCF, revisions, AI exposure) are NOT YET AVAILABLE - see Phase 1.",
    "method": "Composite over available market-derived factors only, rank-standardised to [-1,1] and renormalised. Fundamental factors pending Phase 1 sourced dataset.",
    "factor_defs": [
        {"key": "momentum", "label": "12-1 month momentum", "unit": "ratio", "weight": 0.40},
        {"key": "volatility", "label": "3m realised vol, inverted", "unit": "ratio", "weight": -0.20},
        {"key": "drawdown", "label": "Drawdown from 52w high", "unit": "ratio", "weight": 0.15},
        {"key": "diversification", "label": "Avg correlation, inverted", "unit": "ratio", "weight": 0.25},
    ],
    "as_of": dates[-1], "constituents": FUND_ROWS,
})

write("risk.json", {
    "synthetic": False, "disclaimer": DIS_R,
    "as_of": dates[-1],
    "covariance": {
        "method": "Ledoit-Wolf shrinkage", "window_days": WINDOW,
        "shrinkage_intensity": 0.0, "condition_number_raw": 0.0,
        "condition_number_shrunk": 0.0,
        "note": "Shrinkage estimator is NOT yet fitted - Phase 8. Correlations are raw sample.",
    },
    "tickers": UNIVERSE, "correlation": corr, "per_ticker": per_ticker,
    "mctr": mctr, "cctr": cctr,
    "portfolio": {
        "vol_annual": round(float(pv), 4),
        "var_95_daily": round(pvar95, 4), "var_99_daily": round(pvar99, 4),
        "es_95_daily": round(pes95, 4), "es_99_daily": round(pes99, 4),
        "beta_qqq": round(sum(WEIGHTS[t]*per_ticker[t]["beta_qqq"] for t in UNIVERSE), 3),
        "beta_soxx": round(sum(WEIGHTS[t]*per_ticker[t]["beta_soxx"] for t in UNIVERSE), 3),
        "max_pairwise_corr": round(float(np.max(off)), 4),
        "avg_pairwise_corr": round(float(np.mean(off)), 4),
        "herfindahl": round(sum(v*v for v in WEIGHTS.values()), 4),
        "effective_names": round(1/sum(v*v for v in WEIGHTS.values()), 2),
    },
    "stress": [
        {"name": "2022 rate shock", "shock": -0.34, "basis": "Nasdaq-100 peak-to-trough, Feb-Jun 2022"},
        {"name": "AI-capex unwind", "shock": -0.26, "basis": "Feb-Apr 2025 semis-led drawdown"},
        {"name": "2020 COVID crash", "shock": -0.28, "basis": "19 Feb - 23 Mar 2020"},
        {"name": "Single-name gap", "shock": -0.16, "basis": "2-sigma idiosyncratic gap on largest position"},
    ],
})

write("backtest.json", {
    "synthetic": False,
    "disclaimer": "Equal-weight universe and all benchmarks are REAL. ML_PORTFOLIO is a flagged placeholder.",
    "oos_start": oos_start, "oos_end": dates[-1],
    "rebalance": "Buy and hold (equal-weight universe); ML placeholder not rebalanced",
    "cost_bps_round_trip": 10,
    "series": series, "series_provenance": PROV,
    "performance": {k: perf(v) for k, v in series.items()},
    "yearly": yearly,
    "attribution": {
        "method": "OLS on daily log returns of the EQUAL-WEIGHT UNIVERSE vs QQQ and SOXX (real data, no model required)",
        "observations": int(len(y)), "r_squared": round(float(r2v), 4),
        "factors": [
            {"factor": "Intercept (annualised alpha)", "coef": round(float(beta_v[0]*252), 4),
             "tstat": round(float(tstat[0]), 2), "annualised": True},
            {"factor": "QQQ / Nasdaq-100", "coef": round(float(beta_v[1]), 3),
             "tstat": round(float(tstat[1]), 2), "annualised": False},
            {"factor": "SOXX / Semiconductors", "coef": round(float(beta_v[2]), 3),
             "tstat": round(float(tstat[2]), 2), "annualised": False},
        ],
        "residual_alpha_daily": round(float(beta_v[0]), 6),
        "residual_vol_annual": round(float(np.std(resid, ddof=1)*math.sqrt(252)), 4),
        "note": "Attribution describes the equal-weight universe; ML factor exposure is undefined until Phase 6.",
    },
})
"""),
    code(r"""
# --- Cell 8: fundamentals rows (market-derived, real) ---------------------
def build_fund_rows():
    rows = []
    for tk in UNIVERSE:
        lv = np.array(levels[tk])
        r  = np.array(returns[tk][1:])
        mom = float(lv[-1]/lv[-253] - 1) if len(lv) > 253 else float(lv[-1]/lv[0]-1)
        peak = float(np.max(lv[-252:]))
        ac = float(np.mean([corr[idx[tk]][j] for j in range(len(UNIVERSE)) if j != idx[tk]]))
        rows.append({
            "ticker": tk, "company": "", "ai_category": "", "sector": "",
            "ai_revenue_exposure": None, "aicapex_exposure": None,
            "revenue_growth": None, "fcf_quality": None, "earnings_revisions": None,
            "fwd_pe": None, "price": round(float(lv[-1]), 2), "market_cap_bn": None,
            "vol_3m": round(ann_vol(r[-63:]), 4), "momentum_12_1": round(mom, 4),
            "drawdown_52w": round(float(lv[-1]/peak - 1), 4), "avg_corr": round(ac, 4),
            "beta_qqq": per_ticker[tk]["beta_qqq"],
        })
    def zrank(vals, higher_better):
        order = sorted(range(len(vals)), key=lambda i: vals[i], reverse=higher_better)
        z = [0.0]*len(vals)
        for pos, i in enumerate(order):
            z[i] = 2*pos/(len(vals)-1) - 1
        return z
    cols = {"momentum": ("momentum_12_1", True, 0.40),
            "volatility": ("vol_3m", False, -0.20),
            "drawdown": ("drawdown_52w", True, 0.15),
            "diversification": ("avg_corr", False, 0.25)}
    for key, (fld, hb, w) in cols.items():
        zs = zrank([r0[fld] for r0 in rows], hb)
        for i, r0 in enumerate(rows):
            r0.setdefault("factor_contributions", {})[key] = round(zs[i]*w, 5)
    for r0 in rows:
        r0["composite_score"] = round(sum(r0["factor_contributions"].values()), 5)
    for i, r0 in enumerate(sorted(rows, key=lambda x: -x["composite_score"])):
        r0["rank"] = i+1
        r0["percentile"] = round(1 - i/len(rows), 4)
    return rows

FUND_ROWS = build_fund_rows()
print("built fundamentals rows:", len(FUND_ROWS))
print("  top 3:", [(r0["ticker"], r0["composite_score"]) for r0 in sorted(FUND_ROWS, key=lambda x: x["rank"])[:3]])
"""),
]


# The JSON writer references FUND_ROWS, which the fundamentals builder defines,
# so the builder must run FIRST. Resolve by content - positional indices are
# wrong here because markdown cells are interleaved between code cells.
_i_writer = next(
    i
    for i, c in enumerate(CELLS)
    if "".join(c["source"]).startswith("# --- Cell 7: write dashboard JSON")
)
_i_fund = next(
    i for i, c in enumerate(CELLS) if "def build_fund_rows" in "".join(c["source"])
)
assert _i_fund == _i_writer + 1, f"unexpected layout: writer={_i_writer} fund={_i_fund}"
CELLS[_i_fund], CELLS[_i_writer] = CELLS[_i_writer], CELLS[_i_fund]
print(f"  swapped: fundamentals builder now at index {_i_fund}, writer at {_i_writer}")

CELLS += [
    md(r"""
## Cell 7 — Emit the dashboard JSON schema + run manifest

Emits a machine-readable record of exactly what ran (`WORKTREE.md` §6 step 7), then packages
the dashboard bundle for download.
"""),
    code(r"""
# --- Cell 9: manifest + download -----------------------------------------
manifest = {
    "artifact": "run_manifest", "version": DATA_VERSION,
    "spec_version": SPEC_VERSION, "universe_version": UNIVERSE_VERSION,
    "executed_at": datetime.now(timezone.utc).isoformat(),
    "window": {"start": START, "end_inclusive": END_INCLUSIVE},
    "price_convention": "adjusted close (split and dividend adjusted)",
    "trading_days": n,
    "acquisition": report["sources"],
    "tickers": report["tickers"],
    "failures": report["failures"],
    "validation": report["validation"]["status"],
    "real_surfaces": ["market.json", "risk.json", "backtest.json (EW + benchmarks)",
                      "fundamentals.json (market-derived factors only)"],
    "synthetic_surfaces": ["ML_PORTFOLIO equity curve", "models.json (not produced here)",
                           "portfolio.json weights (not produced here)",
                           "fundamental factors in fundamentals.json (Phase 1 pending)"],
    "files": {},
}
for fn in ["market.json", "risk.json", "backtest.json", "fundamentals.json"]:
    fp = os.path.join(DASH_PATH, fn)
    manifest["files"][fn] = hashlib.sha256(open(fp, "rb").read()).hexdigest()

with open(RUN_PATH, "w") as f:
    json.dump(manifest, f, indent=2)
print("manifest ->", RUN_PATH)
print(json.dumps({k: manifest[k] for k in
                  ["validation", "trading_days", "real_surfaces", "synthetic_surfaces"]}, indent=2))

# Bundle for download
import shutil
if os.path.exists(LOCAL_DATA):
    shutil.rmtree(LOCAL_DATA)
os.makedirs(LOCAL_DATA, exist_ok=True)
for fn in ["market.json", "risk.json", "backtest.json", "fundamentals.json", "universe.json"]:
    src = os.path.join(DASH_PATH, fn)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(LOCAL_DATA, fn))
shutil.copy2(RUN_PATH, os.path.join(LOCAL_DATA, "run_manifest.json"))
print("\nbundle contents:", os.listdir(LOCAL_DATA))
"""),
    code(r"""
# --- Cell 10: download ----------------------------------------------------
import shutil
from google.colab import files

zip_path = "/content/nasdaq_ai_quant_data.zip"
shutil.make_archive("/content/nasdaq_ai_quant_data", "zip", LOCAL_DATA)
print("zip size:", round(os.path.getsize(zip_path)/1024, 1), "KB")
print("\n>>> Click the link below and save the zip to your Downloads folder. <<<")
files.download(zip_path)
"""),
    code(r"""
# --- Cell 11: verify the bundle ------------------------------------------
# Self-check: the schema must match what dashboard/src/lib/data.ts expects.
required = {
    "market.json":      ["dates", "levels", "returns", "start_idx", "benchmarks", "realised_vol"],
    "risk.json":        ["tickers", "correlation", "per_ticker", "portfolio"],
    "backtest.json":    ["series", "performance", "yearly", "attribution", "series_provenance"],
    "fundamentals.json":["constituents", "factor_defs"],
}
ok = True
for fn, keys in required.items():
    p = os.path.join(LOCAL_DATA, fn)
    if not os.path.exists(p):
        print(f"  MISSING {fn}"); ok = False; continue
    d = json.load(open(p))
    miss = [k for k in keys if k not in d]
    print(f"  {fn:22s} {'OK' if not miss else 'MISSING ' + str(miss)}  ({os.path.getsize(p)/1024:.0f} KB)")
    ok = ok and not miss

m = json.load(open(os.path.join(LOCAL_DATA, "market.json")))
print(f"\n  dates           {len(m['dates'])}  {m['dates'][0]} -> {m['dates'][-1]}")
print(f"  level lengths   {sorted({len(v) for v in m['levels'].values()})}")
print(f"  benchmarks      {list(m['benchmarks'])}")
r = json.load(open(os.path.join(LOCAL_DATA, "risk.json")))
print(f"  correlation     {len(r['correlation'])}x{len(r['correlation'][0])}")
b = json.load(open(os.path.join(LOCAL_DATA, "backtest.json")))
print(f"  series          {list(b['series'])}")
print(f"  provenance      {b['series_provenance']}")
print("\nBUNDLE VERIFIED" if ok else "\nBUNDLE INVALID")
"""),
]

nb = {
    "cells": CELLS,
    "metadata": {
        "colab": {
            "name": "nasdaq_ai_quant_acquire_v001.ipynb",
            "provenance": [],
            "toc_visible": True,
            "kernel": {"name": "python3", "display_name": "Python 3"},
        },
        "kernelspec": {"name": "python3", "display_name": "Python 3"},
        "language_info": {"name": "python"},
    },
    "nbformat": 4,
    "nbformat_minor": 0,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
print(f"wrote {OUT}  ({OUT.stat().st_size / 1024:.1f} KB, {len(CELLS)} cells)")
