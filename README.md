# Nasdaq AI Quant Research System

A reproducible quant-research system for a 20-name Nasdaq-listed AI equity universe.

## What this repository contains

- universe definition and exchange verification;
- sourced current-state fundamental ranking;
- Yahoo Finance EOD market-data pipeline;
- leakage-safe feature and target factories;
- walk-forward LightGBM models;
- covariance/risk/portfolio optimization;
- backtesting and factor attribution;
- premium interactive dashboard.

## Read first

1. `AGENTS.md`
2. `CONTEXT.md`
3. `PROJECT_SPEC.md`
4. `PLAN.md`
5. `RESEARCH_PROTOCOL.md`
6. `DATA_CONTRACT.md`
7. `QUALITY_GATES.md`
8. `WORKTREE.md`
9. `PHASE_LOG.md`
10. `docs/UNIVERSE_METHODOLOGY.md`
11. `META_PROMPT_001.md`

## Compute model

This local repository is the control plane.

Heavy execution belongs in Google Colab.

Google Drive is the canonical durable artifact store.

## Core principle

The project is not successful because the dashboard looks good.

It is successful only if:

```text
Data integrity
    ↓
Predictive validity
    ↓
Portfolio validity
    ↓
Reproducible presentation
```

## Current status

Phase 0A: complete.

Phase 0: universe lock in progress.
