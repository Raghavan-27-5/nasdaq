/**
 * Provenance helpers.
 *
 * The dashboard is assembled from versioned artifacts that arrive in stages:
 * the Colab acquisition run makes market surfaces real first; model, portfolio
 * and fundamentals surfaces follow in later phases. Every claim the UI makes
 * about "real vs synthetic" is derived from artifact-level flags and the
 * manifest ledger — never hardcoded in a page.
 *
 * Ledger status vocabulary (emitted by the acquisition notebook and the
 * fixture generator, matched here):
 *   - "REAL …"      -> real artifact, traceable to a run
 *   - "SYNTHETIC …" -> flagged fixture / placeholder
 *   - anything else -> not yet produced ("PENDING …")
 */
import { backtest, fundamentals, manifest, market, models, portfolio, risk } from './data'

export type ProvStatus = 'real' | 'synthetic' | 'pending' | 'mixed'
export type ProvTone = 'pos' | 'warn' | 'info'

export function ledgerStatus(status: string): { label: ProvStatus; tone: ProvTone } {
  if (status.startsWith('REAL')) return { label: 'real', tone: 'pos' }
  if (status.startsWith('SYNTHETIC')) return { label: 'synthetic', tone: 'warn' }
  return { label: 'pending', tone: 'info' }
}

const LEDGER = manifest.real_vs_synthetic

export const realSurfaces = LEDGER.filter((r) => ledgerStatus(r.status).label === 'real')
export const syntheticSurfaces = LEDGER.filter(
  (r) => ledgerStatus(r.status).label === 'synthetic',
)
export const pendingSurfaces = LEDGER.filter((r) => ledgerStatus(r.status).label === 'pending')

/**
 * Application-level data mode. `synthetic` only when virtually everything is a
 * fixture (i.e. before the first real acquisition run).
 */
export const dataMode: { label: string; tone: ProvTone; title: string } = (() => {
  const real = realSurfaces.length
  const synthetic = syntheticSurfaces.length
  const pending = pendingSurfaces.length
  if (synthetic === 0 && pending === 0) {
    return {
      label: 'live data',
      tone: 'pos',
      title: `All ${LEDGER.length} rendered surfaces trace to real versioned artifacts.`,
    }
  }
  const detail = [
    `${real} of ${LEDGER.length} surfaces real`,
    synthetic ? `synthetic: ${syntheticSurfaces.map((s) => s.surface).join(' · ')}` : '',
    pending ? `pending: ${pendingSurfaces.map((s) => s.surface).join(' · ')}` : '',
  ]
    .filter(Boolean)
    .join(' — ')
  return {
    label: real > 2 ? 'partial real' : 'demo data',
    tone: 'warn',
    title: `${detail}. Full ledger on the Research Audit page.`,
  }
})()

/** Per-curve provenance for the backtest series, defaulting to synthetic when absent. */
export function seriesProvenance(key: string): ProvStatus {
  const v = backtest.series_provenance?.[key]
  return v === 'real' ? 'real' : v === 'synthetic' ? 'synthetic' : 'synthetic'
}

/** The surfaces this build's headline market pages currently rest on. */
export const marketIsReal = market.synthetic === false
export const riskIsReal = risk.synthetic === false
export const modelsAreSynthetic = models.synthetic === true
export const portfolioIsSynthetic = portfolio.synthetic === true
export const fundamentalFactorsPending = fundamentals.fundamental_factors_pending === true

/** Does the risk artifact's portfolio block describe the equal-weight reference book? */
export const riskBookIsPlaceholder = risk.portfolio_basis === 'equal_weight_placeholder'

/** Fundamentals artifact status: fixture, market-derived-only, or fully real. */
export const fundamentalsStatus: ProvStatus = fundamentalFactorsPending
  ? 'pending'
  : fundamentals.synthetic
    ? 'synthetic'
    : 'real'

/** Compact display label for a provenance status. */
export function provLabel(s: ProvStatus): string {
  return s === 'real' ? 'real' : s === 'synthetic' ? 'sim' : s === 'pending' ? 'pending' : 'mixed'
}

export function provTone(s: ProvStatus): ProvTone {
  return s === 'real' ? 'pos' : s === 'synthetic' ? 'warn' : 'info'
}
