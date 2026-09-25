"""Phase-0 universe schema validation tests.

These tests validate the locked 20-name universe against the structural
requirements defined in PROJECT_SPEC.md, DATA_CONTRACT.md, and QUALITY_GATES.md.

Tests prove:
  1. Universe has exactly 20 unique tickers.
  2. All tickers are uppercase.
  3. Every ticker has company/category/exchange/domicile/rationale.
  4. Exchange is Nasdaq for all constituents.
  5. No forbidden prior candidate (SNOW, ARM) is included.
  6. Date window is valid (start < end).
  7. No pre-listing synthetic history rule exists.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml

# Project root relative to this test file
PROJECT_ROOT = Path(__file__).resolve().parents[3]
UNIVERSE_YAML = PROJECT_ROOT / "configs" / "universe.yaml"
MANIFEST_JSON = (
    PROJECT_ROOT / "artifacts" / "manifests" / "universe_verification_v001.json"
)

EXPECTED_TICKER_COUNT = 20
FORBIDDEN_TICKERS = {"SNOW", "ARM"}
VALID_EXCHANGE = "NASDAQ"

REQUIRED_CONSTITUENT_KEYS = {
    "ticker",
    "company",
    "category",
    "domicile",
    "exchange",
    "inclusion_rationale",
}


# ---------- Fixtures ----------


@pytest.fixture(scope="module")
def universe_data() -> dict:
    assert UNIVERSE_YAML.exists(), f"Missing: {UNIVERSE_YAML}"
    with UNIVERSE_YAML.open() as f:
        return yaml.safe_load(f)


@pytest.fixture(scope="module")
def constituents(universe_data: dict) -> list[dict]:
    return universe_data.get("constituents", [])


@pytest.fixture(scope="module")
def tickers(constituents: list[dict]) -> list[str]:
    return [c["ticker"] for c in constituents]


@pytest.fixture(scope="module")
def manifest_data() -> dict:
    assert MANIFEST_JSON.exists(), f"Missing: {MANIFEST_JSON}"
    with MANIFEST_JSON.open() as f:
        return json.load(f)


# ---------- Test 1: exactly 20 unique tickers ----------


def test_universe_has_exactly_20_tickers(tickers: list[str]) -> None:
    assert len(tickers) == EXPECTED_TICKER_COUNT, (
        f"Expected {EXPECTED_TICKER_COUNT} tickers, got {len(tickers)}"
    )


def test_all_tickers_are_unique(tickers: list[str]) -> None:
    assert len(set(tickers)) == len(tickers), (
        f"Duplicate tickers: {[t for t in tickers if tickers.count(t) > 1]}"
    )


# ---------- Test 2: all tickers uppercase ----------


def test_all_tickers_uppercase(tickers: list[str]) -> None:
    non_upper = [t for t in tickers if t != t.upper()]
    assert not non_upper, f"Non-uppercase tickers: {non_upper}"


# ---------- Test 3: required fields present ----------


def test_required_fields_present(constituents: list[dict]) -> None:
    for c in constituents:
        missing = REQUIRED_CONSTITUENT_KEYS - set(c.keys())
        assert not missing, (
            f"Ticker {c.get('ticker', '?')} missing: {missing}"
        )


def test_company_non_empty(constituents: list[dict]) -> None:
    for c in constituents:
        assert c.get("company"), f"Ticker {c['ticker']} has empty company"


def test_category_non_empty(constituents: list[dict]) -> None:
    for c in constituents:
        assert c.get("category"), f"Ticker {c['ticker']} has empty category"


def test_inclusion_rationale_non_empty(constituents: list[dict]) -> None:
    for c in constituents:
        assert c.get("inclusion_rationale"), (
            f"Ticker {c['ticker']} has empty inclusion_rationale"
        )


# ---------- Test 4: exchange is Nasdaq ----------


def test_exchange_is_nasdaq(constituents: list[dict]) -> None:
    for c in constituents:
        assert c["exchange"] == VALID_EXCHANGE, (
            f"Ticker {c['ticker']}: exchange is '{c['exchange']}', expected '{VALID_EXCHANGE}'"
        )


# ---------- Test 5: no forbidden tickers ----------


def test_no_forbidden_tickers(tickers: list[str]) -> None:
    present = set(tickers) & FORBIDDEN_TICKERS
    assert not present, f"Forbidden tickers included: {present}"


# ---------- Test 6: date window valid ----------


def test_research_window_valid(universe_data: dict) -> None:
    rw = universe_data.get("research_window", {})
    start = rw.get("start")
    end = rw.get("end_inclusive")
    assert start, "Missing research_window.start"
    assert end, "Missing research_window.end_inclusive"
    assert start < end, f"Invalid window: start={start} >= end={end}"


def test_research_window_matches_spec(universe_data: dict) -> None:
    rw = universe_data["research_window"]
    assert rw["start"] == "2020-01-01", f"Unexpected start: {rw['start']}"
    assert rw["end_inclusive"] == "2026-09-22", f"Unexpected end: {rw['end_inclusive']}"


# ---------- Test 7: no synthetic pre-listing history ----------


def test_no_synthetic_history_rule(constituents: list[dict]) -> None:
    """Verify no constituent's history_rule instructs synthetic/fabricated data.

    Rules saying 'No synthetic' are correct (they prohibit fabrication).
    Only flag rules that positively instruct fabrication.
    """
    positive_patterns = [
        "use synthetic", "create synthetic", "generate synthetic",
        "fabricate", "generate fake", "zero-fill pre-listing",
        "fill with zeros before", "impute pre-ipo",
    ]
    for c in constituents:
        rule = c.get("history_rule", "").lower()
        for pattern in positive_patterns:
            assert pattern not in rule, (
                f"Ticker {c['ticker']} has suspicious history_rule: '{c['history_rule']}'"
            )


# ---------- Manifest structural tests ----------


def test_manifest_has_20_constituents(manifest_data: dict) -> None:
    n = len(manifest_data.get("constituents", []))
    assert n == EXPECTED_TICKER_COUNT, f"Manifest has {n} constituents"


def test_manifest_tickers_match_universe(
    tickers: list[str], manifest_data: dict
) -> None:
    manifest_tickers = sorted(
        c["ticker"] for c in manifest_data.get("constituents", [])
    )
    assert sorted(tickers) == manifest_tickers, (
        f"Ticker mismatch: universe={sorted(tickers)}, manifest={manifest_tickers}"
    )


def test_manifest_listing_verified(manifest_data: dict) -> None:
    for c in manifest_data.get("constituents", []):
        assert c.get("listing_verified") is True, (
            f"Manifest ticker {c['ticker']}: listing_verified is not true"
        )


def test_manifest_exchange_nasdaq(manifest_data: dict) -> None:
    for c in manifest_data.get("constituents", []):
        assert c["exchange"] == VALID_EXCHANGE, (
            f"Manifest ticker {c['ticker']}: exchange '{c['exchange']}'"
        )


def test_manifest_no_forbidden_tickers(manifest_data: dict) -> None:
    tickers = {c["ticker"] for c in manifest_data.get("constituents", [])}
    present = tickers & FORBIDDEN_TICKERS
    assert not present, f"Forbidden tickers in manifest: {present}"


def test_manifest_exclusions_documented(manifest_data: dict) -> None:
    exclusions = manifest_data.get("exclusions", [])
    excluded_tickers = {e["ticker"] for e in exclusions}
    assert "SNOW" in excluded_tickers, "SNOW exclusion not documented"
    assert "ARM" in excluded_tickers, "ARM exclusion not documented"
