"""Universe schema loading and validation utilities.

Lightweight module for Phase-0 validation of configs/universe.yaml
and artifacts/manifests/universe_verification_v001.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml  # PyYAML — lightweight, already common


# ---------- Constants ----------

EXPECTED_TICKER_COUNT: int = 20

REQUIRED_CONSTITUENT_KEYS: frozenset[str] = frozenset({
    "ticker",
    "company",
    "category",
    "domicile",
    "exchange",
    "inclusion_rationale",
    "history_rule",
})

REQUIRED_MANIFEST_CONSTITUENT_KEYS: frozenset[str] = frozenset({
    "ticker",
    "company",
    "security_class",
    "exchange",
    "listing_verified",
    "us_domicile_verified",
    "ai_category",
    "inclusion_rationale",
    "source_urls",
    "verified_at",
    "universe_version",
})

VALID_EXCHANGES: frozenset[str] = frozenset({"NASDAQ"})

FORBIDDEN_TICKERS: frozenset[str] = frozenset({"SNOW", "ARM"})


# ---------- Loaders ----------

def load_universe_yaml(path: str | Path | None = None) -> dict[str, Any]:
    """Load and return parsed universe.yaml."""
    if path is None:
        path = Path(__file__).resolve().parents[2] / "configs" / "universe.yaml"
    path = Path(path)
    with path.open("r") as f:
        return yaml.safe_load(f)


def load_verification_manifest(path: str | Path | None = None) -> dict[str, Any]:
    """Load and return parsed universe_verification_v001.json."""
    if path is None:
        path = (
            Path(__file__).resolve().parents[2]
            / "artifacts"
            / "manifests"
            / "universe_verification_v001.json"
        )
    path = Path(path)
    with path.open("r") as f:
        return json.load(f)


# ---------- Validators ----------

def validate_universe_yaml(data: dict[str, Any]) -> list[str]:
    """Return list of error strings. Empty → valid."""
    errors: list[str] = []

    constituents = data.get("constituents", [])
    tickers = [c.get("ticker") for c in constituents]

    # Exactly 20 unique tickers
    if len(tickers) != EXPECTED_TICKER_COUNT:
        errors.append(f"Expected {EXPECTED_TICKER_COUNT} constituents, got {len(tickers)}")

    if len(set(tickers)) != len(tickers):
        errors.append(f"Duplicate tickers found: {[t for t in tickers if tickers.count(t) > 1]}")

    # All uppercase
    for t in tickers:
        if t is None:
            errors.append("Constituent missing ticker field")
        elif t != t.upper():
            errors.append(f"Ticker not uppercase: {t}")

    # Required fields
    for i, c in enumerate(constituents):
        missing = REQUIRED_CONSTITUENT_KEYS - set(c.keys())
        if missing:
            errors.append(f"Constituent {i} ({c.get('ticker', '?')}): missing keys {missing}")

    # Exchange must be Nasdaq
    for c in constituents:
        exch = c.get("exchange", "")
        if exch not in VALID_EXCHANGES:
            errors.append(f"Ticker {c.get('ticker')}: exchange '{exch}' not in {VALID_EXCHANGES}")

    # Forbidden tickers
    for t in tickers:
        if t in FORBIDDEN_TICKERS:
            errors.append(f"Forbidden ticker included: {t}")

    # Research window
    rw = data.get("research_window", {})
    start = rw.get("start")
    end = rw.get("end_inclusive")
    if not start or not end:
        errors.append("Missing research_window start or end_inclusive")
    elif start >= end:
        errors.append(f"Invalid research window: {start} >= {end}")

    return errors


def validate_verification_manifest(data: dict[str, Any]) -> list[str]:
    """Return list of error strings. Empty → valid."""
    errors: list[str] = []

    constituents = data.get("constituents", [])
    tickers = [c.get("ticker") for c in constituents]

    if len(tickers) != EXPECTED_TICKER_COUNT:
        errors.append(f"Expected {EXPECTED_TICKER_COUNT} constituents, got {len(tickers)}")

    if len(set(tickers)) != len(tickers):
        errors.append(f"Duplicate tickers in manifest")

    for t in tickers:
        if t is None:
            errors.append("Constituent missing ticker field")
        elif t != t.upper():
            errors.append(f"Ticker not uppercase: {t}")

    for i, c in enumerate(constituents):
        missing = REQUIRED_MANIFEST_CONSTITUENT_KEYS - set(c.keys())
        if missing:
            errors.append(
                f"Manifest constituent {i} ({c.get('ticker', '?')}): missing keys {missing}"
            )

    for c in constituents:
        exch = c.get("exchange", "")
        if exch not in VALID_EXCHANGES:
            errors.append(
                f"Manifest ticker {c.get('ticker')}: exchange '{exch}' not in {VALID_EXCHANGES}"
            )

    for t in tickers:
        if t in FORBIDDEN_TICKERS:
            errors.append(f"Forbidden ticker in manifest: {t}")

    return errors
