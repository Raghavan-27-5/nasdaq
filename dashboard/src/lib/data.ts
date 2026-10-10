import universeRaw from '@/data/universe.json'
import marketRaw from '@/data/market.json'
import fundamentalsRaw from '@/data/fundamentals.json'
import modelsRaw from '@/data/models.json'
import portfolioRaw from '@/data/portfolio.json'
import riskRaw from '@/data/risk.json'
import backtestRaw from '@/data/backtest.json'
import manifestRaw from '@/data/manifest.json'

// ---------------------------------------------------------------------------
// Types. These mirror the generator's output contract; the artifacts are
// versioned and every field here is traced back to a named source in
// Research Audit.
// ---------------------------------------------------------------------------

export interface Constituent {
  ticker: string
  company: string
  security_class: string
  exchange: string
  listing_verified: boolean
  us_domicile_verified: boolean
  domicile_detail: string
  ai_category: string
  inclusion_rationale: string
  source_urls: string[]
  verified_at: string
  universe_version: string
}

export interface UniverseArtifact {
  synthetic: boolean
  disclaimer: string
  note: string
  universe_version: string
  verified_at: string
  research_window: { start: string; end_inclusive: string }
  constituents: Constituent[]
  exclusions: { ticker: string; reason: string }[]
}

export interface MarketArtifact {
  synthetic: boolean
  disclaimer: string
  dates: string[]
  levels: Record<string, number[]>
  returns: Record<string, number[]>
  start_idx: Record<string, number>
  benchmarks: Record<string, { levels: number[]; constituents: string[]; realised_vol: number }>
  realised_vol: Record<string, number>
}

export interface FactorDef {
  key: string
  label: string
  unit: string
  weight: number
}

export interface FundamentalRow {
  ticker: string
  company: string
  ai_category: string
  sector: string
  ai_revenue_exposure: number
  aicapex_exposure: number
  revenue_growth: number
  fcf_quality: number
  earnings_revisions: number
  fwd_pe: number
  price: number
  market_cap_bn: number
  vol_3m: number
  momentum_12_1: number
  drawdown_52w: number
  avg_corr: number
  beta_qqq: number
  composite_score: number
  factor_contributions: Record<string, number>
  rank: number
  percentile: number
}

export interface FundamentalsArtifact {
  synthetic: boolean
  disclaimer: string
  method: string
  factor_defs: FactorDef[]
  as_of: string
  constituents: FundamentalRow[]
}

export interface Fold {
  fold: number
  train_start: string
  train_end: string
  val_start: string
  val_end: string
  test_start: string
  test_end: string
  n_train: number
  n_val: number
  n_test: number
  purge_days: number
  embargo_days: number
  best_iter: number
  oos_ic: number
  oos_r2: number
}

export interface ModelTarget {
  target: string
  label: string
  objective: string
  horizon_days: number
  oos_ic_mean: number
  oos_ic_std: number
  icir: number
  hit_rate: number
  r2: number
  rmse: number
  mae: number
  n_oos_rows: number
  oos_start: string
  oos_end: string
  folds: Fold[]
  ic_series: number[]
  decay: { horizon: number; ic: number }[]
  quantiles: { labels: string[]; mean_forward_return: number[] }
  /** JSON object of feature name -> gain importance (NOT a tuple array). */
  feature_importance: Record<string, number>
  hyperparameters: Record<string, number | string>
}

export interface ModelsArtifact {
  synthetic: boolean
  disclaimer: string
  feature_version: string
  target_version: string
  universe_version: string
  validation: string
  targets: Record<string, ModelTarget>
}

export interface PortfolioArtifact {
  synthetic: boolean
  disclaimer: string
  as_of: string
  portfolio_version: string
  optimizer_version: string
  objective_version: string
  weights: Record<string, number>
  unconstrained_weights: Record<string, number>
  equal_weight: Record<string, number>
  category_exposures: Record<string, Record<string, number>>
  sector_of: Record<string, string>
  constraints: { name: string; definition: string; enforced: boolean; binding: boolean }[]
  rebalance_dates: string[]
  turnover: number[]
  cost_bps: number[]
  annual_turnover: number
  prediction_inputs: { ticker: string; mu_21d: number; pred_vol_21d: number }[]
}

export interface RiskArtifact {
  synthetic: boolean
  disclaimer: string
  as_of: string
  covariance: {
    method: string
    window_days: number
    shrinkage_intensity: number
    condition_number_raw: number
    condition_number_shrunk: number
    note: string
  }
  tickers: string[]
  correlation: number[][]
  per_ticker: Record<
    string,
    {
      vol_annual: number
      observations: number
      beta_qqq: number
      beta_soxx: number
      beta_spy: number
      r2_qqq: number
    }
  >
  mctr: Record<string, number>
  cctr: Record<string, number>
  portfolio: {
    vol_annual: number
    var_95_daily: number
    var_99_daily: number
    es_95_daily: number
    es_99_daily: number
    beta_qqq: number
    beta_soxx: number
    max_pairwise_corr: number
    avg_pairwise_corr: number
    herfindahl: number
    effective_names: number
  }
  stress: { name: string; shock: number; basis: string }[]
}

export interface BacktestArtifact {
  synthetic: boolean
  disclaimer: string
  oos_start: string
  oos_end: string
  rebalance: string
  cost_bps_round_trip: number
  series: Record<string, number[]>
  performance: Record<
    string,
    {
      cagr: number
      vol: number
      sharpe: number
      sortino: number
      max_dd: number
      worst_30d: number
      final: number
    }
  >
  yearly: Record<string, number | string>[]
  attribution: {
    method: string
    observations: number
    r_squared: number
    factors: { factor: string; coef: number; tstat: number | null; annualised: boolean }[]
    residual_alpha_daily: number
    residual_vol_annual: number
    note: string
  }
}

export interface ManifestArtifact {
  synthetic: boolean
  disclaimer: string
  seed: number
  project: string
  spec_version: string
  universe_version: string
  research_window: { start: string; end_inclusive: string }
  generated_at: string
  real_vs_synthetic: { surface: string; status: string; source: string }[]
  pending_real_artifacts: string[]
}

// ---------------------------------------------------------------------------
// Singleton accessors. Artifacts are immutable and loaded once.
// ---------------------------------------------------------------------------

export const universe = universeRaw as unknown as UniverseArtifact
export const market = marketRaw as unknown as MarketArtifact
export const fundamentals = fundamentalsRaw as unknown as FundamentalsArtifact
export const models = modelsRaw as unknown as ModelsArtifact
export const portfolio = portfolioRaw as unknown as PortfolioArtifact
export const risk = riskRaw as unknown as RiskArtifact
export const backtest = backtestRaw as unknown as BacktestArtifact
export const manifest = manifestRaw as unknown as ManifestArtifact

export const TICKERS: string[] = universe.constituents.map((c) => c.ticker)
export const TICKER_META: Record<string, Constituent> = Object.fromEntries(
  universe.constituents.map((c) => [c.ticker, c]),
)
export const FUND: Record<string, FundamentalRow> = Object.fromEntries(
  fundamentals.constituents.map((f) => [f.ticker, f]),
)

export const BENCHMARKS = ['QQQ', 'SOXX', 'SPY'] as const
export const RESEARCH_START = universe.research_window.start
export const RESEARCH_END = universe.research_window.end_inclusive

/** Return a ticker's price series aligned to the global calendar (null pre-listing). */
export function seriesFor(ticker: string): (number | null)[] {
  const start = market.start_idx[ticker] ?? 0
  const lv = market.levels[ticker] ?? []
  const out: (number | null)[] = new Array(market.dates.length).fill(null)
  for (let i = 0; i < lv.length; i++) out[start + i] = lv[i]
  return out
}

/** First tradable date for a ticker (listing truncation is a documented bias). */
export function historyStart(ticker: string): string {
  return market.dates[market.start_idx[ticker] ?? 0]
}

export const TRUNCATED = TICKERS.filter(
  (t) => market.start_idx[t] > 0,
).map((t) => ({ ticker: t, start: historyStart(t) }))
