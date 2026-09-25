#!/usr/bin/env python3
"""Standalone Phase-0 universe validation — no pytest required.

Run: python3 scripts/local/validate_universe.py

Exit 0 = all pass; exit 1 = failures.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
UNIVERSE_YAML = PROJECT_ROOT / "configs" / "universe.yaml"
MANIFEST_JSON = (
    PROJECT_ROOT / "artifacts" / "manifests" / "universe_verification_v001.json"
)

EXPECTED_TICKER_COUNT = 20
FORBIDDEN_TICKERS = {"SNOW", "ARM"}
VALID_EXCHANGE = "NASDAQ"

REQUIRED_CONSTITUENT_KEYS = {
    "ticker", "company", "category", "domicile", "exchange", "inclusion_rationale",
}

REQUIRED_MANIFEST_CONSTITUENT_KEYS = {
    "ticker", "company", "security_class", "exchange",
    "listing_verified", "us_domicile_verified", "ai_category",
    "inclusion_rationale", "source_urls", "verified_at", "universe_version",
}


def run_tests() -> tuple[int, int, list[str]]:
    passed = 0
    failed = 0
    errors: list[str] = []

    def check(name: str, condition: bool, msg: str = "") -> None:
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  ✓ {name}")
        else:
            failed += 1
            detail = f"  ✗ {name}: {msg}"
            errors.append(detail)
            print(detail)

    # --- Load universe.yaml ---
    print("\n=== universe.yaml checks ===")
    assert UNIVERSE_YAML.exists(), f"Missing: {UNIVERSE_YAML}"
    with UNIVERSE_YAML.open() as f:
        data = yaml.safe_load(f)
    constituents = data.get("constituents", [])
    tickers = [c.get("ticker") for c in constituents]

    check("exactly_20_tickers",
          len(tickers) == EXPECTED_TICKER_COUNT,
          f"got {len(tickers)}")

    check("all_unique",
          len(set(tickers)) == len(tickers),
          f"duplicates: {[t for t in tickers if tickers.count(t) > 1]}")

    non_upper = [t for t in tickers if t and t != t.upper()]
    check("all_uppercase", not non_upper, f"non-upper: {non_upper}")

    for c in constituents:
        missing = REQUIRED_CONSTITUENT_KEYS - set(c.keys())
        check(f"required_fields_{c.get('ticker', '?')}",
              not missing, f"missing: {missing}")

    for c in constituents:
        check(f"exchange_nasdaq_{c['ticker']}",
              c.get("exchange") == VALID_EXCHANGE,
              f"got {c.get('exchange')}")

    present = set(tickers) & FORBIDDEN_TICKERS
    check("no_forbidden_tickers", not present, f"found: {present}")

    rw = data.get("research_window", {})
    start = rw.get("start", "")
    end = rw.get("end_inclusive", "")
    check("date_window_valid",
          bool(start) and bool(end) and start < end,
          f"start={start}, end={end}")

    check("window_matches_spec",
          start == "2020-01-01" and end == "2026-09-22",
          f"start={start}, end={end}")

    # Detect rules that INSTRUCT synthetic data creation.
    # Rules saying "No synthetic" are correct — they prohibit it.
    # We flag rules that positively instruct fabrication.
    positive_synthetic_patterns = [
        "use synthetic", "create synthetic", "generate synthetic",
        "fabricate", "generate fake", "zero-fill pre-listing",
        "fill with zeros before", "impute pre-ipo",
    ]
    for c in constituents:
        rule = c.get("history_rule", "").lower()
        instructs_synthetic = any(p in rule for p in positive_synthetic_patterns)
        check(f"no_synthetic_history_{c['ticker']}",
              not instructs_synthetic, f"rule: {c.get('history_rule')}")

    # --- Load manifest ---
    print("\n=== Manifest checks ===")
    if MANIFEST_JSON.exists():
        with MANIFEST_JSON.open() as f:
            manifest = json.load(f)
        m_constituents = manifest.get("constituents", [])
        m_tickers = [c["ticker"] for c in m_constituents]

        check("manifest_20_constituents",
              len(m_tickers) == EXPECTED_TICKER_COUNT,
              f"got {len(m_tickers)}")

        check("manifest_tickers_match_universe",
              sorted(tickers) == sorted(m_tickers),
              f"mismatch")

        for c in m_constituents:
            check(f"manifest_listing_verified_{c['ticker']}",
                  c.get("listing_verified") is True,
                  f"listing_verified={c.get('listing_verified')}")

        for c in m_constituents:
            check(f"manifest_exchange_{c['ticker']}",
                  c.get("exchange") == VALID_EXCHANGE,
                  f"got {c.get('exchange')}")

        m_present = {t for t in m_tickers} & FORBIDDEN_TICKERS
        check("manifest_no_forbidden", not m_present, f"found: {m_present}")

        exclusions = {e["ticker"] for e in manifest.get("exclusions", [])}
        check("exclusion_SNOW", "SNOW" in exclusions, "SNOW not documented")
        check("exclusion_ARM", "ARM" in exclusions, "ARM not documented")

        # Check required manifest fields
        for c in m_constituents:
            missing = REQUIRED_MANIFEST_CONSTITUENT_KEYS - set(c.keys())
            check(f"manifest_fields_{c['ticker']}",
                  not missing, f"missing: {missing}")
    else:
        failed += 1
        errors.append(f"  ✗ manifest_exists: {MANIFEST_JSON} not found")
        print(f"  ✗ manifest not found at {MANIFEST_JSON}")

    return passed, failed, errors


def main() -> None:
    passed, failed, errors = run_tests()
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if errors:
        print("\nFailures:")
        for e in errors:
            print(e)
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
