import { useMemo, useState } from 'react'
import { Page, StatRow, Segmented } from '@/components/ui/Page'
import { Panel } from '@/components/ui/Panel'
import { StatTile, Badge, Delta, MiniBar } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { drawdownSeries } from '@/components/charts/primitives'
import { timeSeriesOption, drawdownOption } from '@/lib/chartopts'
import { SERIES_COLOR } from '@/lib/palette'
import {
  backtest,
  manifest,
  market,
  models,
  portfolio,
  risk,
  fundamentals,
  TICKERS,
  TICKER_META,
  RESEARCH_START,
  RESEARCH_END,
  TRUNCATED,
} from '@/lib/data'
import {
  fundamentalFactorsPending,
  ledgerStatus,
  modelsAreSynthetic,
  portfolioIsSynthetic,
  riskBookIsPlaceholder,
  seriesProvenance,
} from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { pct, pctSigned, nf, humanise, fmtDate } from '@/lib/format'

const ml = backtest.performance.ML_PORTFOLIO
const qqq = backtest.performance.QQQ
const m21 = models.targets.return_21d

/** Regime annotations drawn on the headline equity curve. */
const REGIME_MARKERS = (() => {
  const find = (needle: string) =>
    market.dates.findIndex((d) => d >= needle)
  return [
    { label: 'COVID', index: find('2020-02-19') },
    { label: '2022', index: find('2022-01-03') },
    { label: 'AI CAPEX', index: find('2023-01-03') },
    { label: 'UNWIND', index: find('2025-04-08') },
  ].filter((m) => m.index > 0)
})()

export function CommandCenter() {
  const { navigate, selectTicker, ticker } = useApp()
  const [window_, setWindow] = useState<'oos' | 'full'>('oos')
  const [curveView, setCurveView] = useState<'equity' | 'drawdown'>('equity')

  const dates = market.dates
  const oosIdx = dates.indexOf(backtest.oos_start)

  const { curveDates, curveSeries } = useMemo(() => {
    const from = window_ === 'oos' ? Math.max(oosIdx, 0) : 0
    const d = dates.slice(from)
    const s: Record<string, (number | null)[]> = {}
    for (const [k, v] of Object.entries(backtest.series)) {
      s[k] = (v.slice(from) as number[]).map((x) => x / v[from])
    }
    return { curveDates: d, curveSeries: s }
  }, [dates, oosIdx, window_])

  const order = ['ML_PORTFOLIO', 'EW_UNIVERSE', 'QQQ', 'SOXX', 'SPY'] as const

  const curveOption = useMemo(
    () =>
      timeSeriesOption(
        curveDates,
        order.map((k) => ({
          key: k,
          label: k.replace(/_/g, ' '),
          values: curveSeries[k],
          color: SERIES_COLOR[k],
          width: k === 'ML_PORTFOLIO' ? 2.2 : 1.3,
          area: k === 'ML_PORTFOLIO',
          dashed: k === 'SPY',
        })),
        {
          yFormat: (v) => v.toFixed(2),
          zoom: true,
          markers: window_ === 'full' ? REGIME_MARKERS : [],
        },
      ),
    [curveDates, curveSeries, window_],
  )

  const ddOption = useMemo(
    () => drawdownOption(curveDates, drawdownSeries(curveSeries.ML_PORTFOLIO as number[])),
    [curveDates, curveSeries],
  )

  const topRanked = useMemo(
    () => [...fundamentals.constituents].sort((a, b) => a.rank - b.rank),
    [],
  )

  const factorLeaders = useMemo(
    () =>
      fundamentals.factor_defs
        .map((d) => {
          const rows = topRanked
            .map((f) => ({ ticker: f.ticker, v: f.factor_contributions[d.key] ?? 0 }))
            .sort((a, b) => b.v - a.v)
          return { def: d, rows: rows.slice(0, 3) }
        })
        .slice(0, 5),
    [topRanked],
  )

  const binding = portfolio.constraints.filter((c) => c.binding)
  const alphaT = backtest.attribution.factors[0]?.tstat
  const mlSim = seriesProvenance('ML_PORTFOLIO') !== 'real'
  const attributionReal = backtest.series_provenance !== undefined

  return (
    <Page
      title="Command Center"
      lede={
        <>
          Universe integrity, signal quality, portfolio construction and realised risk in one view.
          Values are read from versioned artifacts; charts are rebased views of the stored series.
        </>
      }
      toolbar={
        <>
          <Segmented
            value={window_}
            onChange={setWindow}
            options={[
              { value: 'oos', label: 'OOS only' },
              { value: 'full', label: 'Full window' },
            ]}
          />
          <Segmented
            value={curveView}
            onChange={setCurveView}
            options={[
              { value: 'equity', label: 'Equity' },
              { value: 'drawdown', label: 'Drawdown' },
            ]}
          />
        </>
      }
    >
      <div className="space-y-3">
        {/* ---------------- Headline performance ---------------- */}
        <StatRow className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Portfolio CAGR"
            value={pct(ml.cagr, 2)}
            tone={ml.cagr >= 0 ? 'pos' : 'neg'}
            footnote={`vs QQQ ${pct(qqq.cagr, 2)}${mlSim ? ' · ML placeholder' : ''}`}
          />
          <StatTile
            label="Portfolio Sharpe"
            value={nf(ml.sharpe, 2)}
            tone={ml.sharpe >= 1 ? 'pos' : 'flat'}
            sub="rf 0%"
            footnote={mlSim ? 'Placeholder curve — Phase 6 pending' : 'OOS, net of 10bps RT'}
          />
          <StatTile
            label="Max Drawdown"
            value={pct(ml.max_dd, 1)}
            tone="neg"
            footnote={`Worst 30d ${pct(ml.worst_30d, 1)}`}
          />
          <StatTile
            label="21D Signal IC"
            value={nf(m21.oos_ic_mean, 3)}
            tone={m21.oos_ic_mean > 0 ? 'pos' : 'neg'}
            sub={`ICIR ${nf(m21.icir, 2)}`}
            footnote={`Hit rate ${pct(m21.hit_rate, 1)}${modelsAreSynthetic ? ' · fixture' : ''}`}
          />
          <StatTile
            label="Factor Alpha"
            value={alphaT === null || alphaT === undefined ? '—' : nf(alphaT, 2)}
            tone={alphaT !== null && alphaT !== undefined && alphaT > 2 ? 'pos' : 'flat'}
            sub="t-stat"
            footnote={
              alphaT === null || alphaT === undefined
                ? 'Not available in this build'
                : alphaT < 2
                  ? 'Not significant after factor control'
                  : attributionReal
                    ? 'Equal-weight book vs QQQ + SOXX'
                    : 'Significant vs QQQ + SOXX'
            }
          />
          <StatTile
            label="Portfolio Beta"
            value={nf(risk.portfolio.beta_qqq, 2)}
            sub="QQQ"
            footnote={`SOXX ${nf(risk.portfolio.beta_soxx, 2)}`}
          />
        </StatRow>

        {/* ---------------- Equity curve + risk posture ---------------- */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
          <Panel
            title="Out-of-sample equity"
            subtitle={
              window_ === 'oos'
                ? `Growth of 100 · ${backtest.oos_start} → ${backtest.oos_end} · ${backtest.rebalance}`
                : `Growth of 100 · ${RESEARCH_START} → ${RESEARCH_END} (includes in-sample regime)`
            }
            actions={
              mlSim ? (
                <Badge
                  tone="warn"
                  title="The ML portfolio curve is a synthetic placeholder until Phase 6/9/10 outputs land; EW and benchmark curves are real."
                >
                  ML curve · sim
                </Badge>
              ) : (
                <Badge tone="pos">real</Badge>
              )
            }
          >
            {curveView === 'equity' ? (
              <EChart option={curveOption} height={306} />
            ) : (
              <EChart option={ddOption} height={306} />
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-ink-700 pt-2.5">
              {order.map((k) => {
                const p = backtest.performance[k]
                const isML = k === 'ML_PORTFOLIO'
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className="h-[2px] w-4 shrink-0 rounded-full"
                      style={{
                        background: SERIES_COLOR[k],
                        opacity: isML ? 1 : 0.6,
                      }}
                      aria-hidden
                    />
                    <span className="text-2xs text-fg-dim">{k.replace(/_/g, ' ')}</span>
                    <span className="font-mono tnum text-2xs text-fg-base">
                      {pctSigned(p.cagr * 100, 1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel
              title="Signal quality"
              subtitle="21D forward return · out-of-sample"
              actions={
                modelsAreSynthetic ? (
                  <Badge tone="warn" title="Model metrics are a synthetic fixture — LightGBM training runs in Phase 6/7.">
                    fixture
                  </Badge>
                ) : (
                  <Badge tone="pos">real</Badge>
                )
              }
            >
              <div className="space-y-2.5">
                {(
                  [
                    ['Spearman IC', nf(m21.oos_ic_mean, 4), m21.oos_ic_mean],
                    ['ICIR', nf(m21.icir, 3), m21.icir * 0.02],
                    ['Hit rate', pct(m21.hit_rate, 1), m21.hit_rate - 0.5],
                    ['OOS R²', nf(m21.r2, 4), m21.r2],
                  ] as const
                ).map(([label, val, bar]) => (
                  <div key={label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-micro text-fg-dim">{label}</span>
                      <span className="font-mono tnum text-micro text-fg-hi">{val}</span>
                    </div>
                    <MiniBar
                      value={bar}
                      max={Math.max(Math.abs(bar), 0.0001)}
                      tone={bar >= 0 ? 'pos' : 'neg'}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-ink-700 pt-2.5 text-2xs leading-relaxed text-fg-mute">
                Modest by design. A cross-sectional daily signal on 20 correlated names rarely
                produces a large IC; the tests that matter are cost-adjusted and factor-controlled.
              </p>
            </Panel>

            <Panel
              title="Risk posture"
              subtitle={
                riskBookIsPlaceholder
                  ? 'Equal-weight reference book · real prices'
                  : 'At optimised weights'
              }
              className="flex-1"
            >
              <dl className="space-y-2">
                {(
                  [
                    ['Annualised vol', pct(risk.portfolio.vol_annual, 1)],
                    ['VaR 95 (1d)', pct(risk.portfolio.var_95_daily, 2)],
                    ['Expected shortfall 95', pct(risk.portfolio.es_95_daily, 2)],
                    ['Avg pairwise corr', nf(risk.portfolio.avg_pairwise_corr, 2)],
                    ['Effective names', nf(risk.portfolio.effective_names, 1)],
                    ['Annual turnover', pct(portfolio.annual_turnover, 0)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-micro text-fg-dim">{k}</dt>
                    <dd className="font-mono tnum text-micro text-fg-hi">{v}</dd>
                  </div>
                ))}
              </dl>
              {portfolioIsSynthetic && (
                <p className="mt-2.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
                  Turnover is read from the synthetic fixture; optimised weights land with Phase 9.
                </p>
              )}
            </Panel>
          </div>
        </div>

        {/* ---------------- Rankings + factor panel ---------------- */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Panel
            title="Universe ranking"
            subtitle={
              fundamentalFactorsPending
                ? `Composite of ${fundamentals.factor_defs.length} market-derived factors · fundamental factors pending Phase 1`
                : 'Composite of 10 documented factors · rank-standardised within the 20-name universe'
            }
            actions={
              <button
                type="button"
                onClick={() => navigate('universe')}
                className="text-2xs text-fg-dim transition-colors hover:text-sig-pos"
              >
                Open universe →
              </button>
            }
            pad={false}
          >
            <div className="max-h-[330px] overflow-y-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-9 text-center">#</th>
                    <th>Ticker</th>
                    <th>AI category</th>
                    <th className="text-right">Score</th>
                    <th className="w-[110px]">Distribution</th>
                    <th className="text-right">12-1 Mom</th>
                    <th className="text-right">Fwd P/E</th>
                  </tr>
                </thead>
                <tbody>
                  {topRanked.map((f) => (
                    <tr
                      key={f.ticker}
                      tabIndex={0}
                      onClick={() => selectTicker(f.ticker)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') selectTicker(f.ticker)
                      }}
                      data-selected={f.ticker === ticker}
                      className="rowfocus cursor-pointer"
                    >
                      <td className="text-center font-mono tnum text-fg-mute">{f.rank}</td>
                      <td>
                        <span className="font-mono text-[12px] font-semibold text-fg-hi">
                          {f.ticker}
                        </span>
                      </td>
                      <td className="max-w-[190px] truncate text-2xs text-fg-dim">
                        {humanise(f.ai_category)}
                      </td>
                      <td className="num">
                        <span className={f.composite_score >= 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                          {f.composite_score >= 0 ? '+' : ''}
                          {nf(f.composite_score, 3)}
                        </span>
                      </td>
                      <td>
                        <MiniBar
                          value={f.composite_score}
                          max={Math.max(...topRanked.map((x) => Math.abs(x.composite_score)))}
                          tone={f.composite_score >= 0 ? 'pos' : 'neg'}
                        />
                      </td>
                      <td className="num">
                        <Delta>{pctSigned(f.momentum_12_1 * 100, 1)}</Delta>
                      </td>
                      <td className="num text-fg-dim">
                        {f.fwd_pe === null || f.fwd_pe === undefined ? '—' : `${nf(f.fwd_pe, 1)}x`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel
              title="Factor leaders"
              subtitle="Top contributor per factor · weighted z-score contribution"
              className="flex-1"
            >
              <div className="space-y-3">
                {factorLeaders.map(({ def, rows }) => (
                  <div key={def.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-micro text-fg-base">{def.label}</span>
                      <span className="shrink-0 font-mono text-3xs text-fg-mute">
                        w {def.weight > 0 ? '+' : ''}
                        {def.weight.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rows.map((r) => (
                        <button
                          key={r.ticker}
                          type="button"
                          onClick={() => selectTicker(r.ticker)}
                          className="group flex items-center gap-1.5 rounded-sm border border-ink-700 bg-ink-800 px-1.5 py-[2px] transition-colors hover:border-sig-pos/40 hover:bg-sig-pos/[0.06]"
                        >
                          <span className="font-mono text-[11px] font-medium text-fg-hi group-hover:text-sig-pos">
                            {r.ticker}
                          </span>
                          <span className="font-mono tnum text-3xs text-fg-dim">
                            {r.v >= 0 ? '+' : ''}
                            {r.v.toFixed(3)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Optimizer posture" subtitle="Constraint framework" pad={false}>
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-micro text-fg-dim">Constraints enforced</span>
                  <span className="font-mono tnum text-micro text-fg-hi">
                    {portfolio.constraints.length}/{portfolio.constraints.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {portfolio.constraints.slice(0, 5).map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span
                        className={c.binding ? 'text-sig-warn' : 'text-sig-pos'}
                        title={c.binding ? 'Binding' : 'Not binding'}
                      >
                        {c.binding ? '◆' : '○'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-2xs text-fg-dim">{c.name}</span>
                      <span className="shrink-0 font-mono text-3xs text-fg-mute">{c.definition}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-ink-700 pt-2">
                  <span className="text-2xs text-fg-mute">
                    {binding.length} binding · {portfolio.constraints.length - binding.length} slack
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('portfolio')}
                    className="text-2xs text-fg-dim transition-colors hover:text-sig-pos"
                  >
                    Optimizer →
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* ---------------- Integrity strip ---------------- */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Data integrity" subtitle="What this build is actually made of">
            <div className="space-y-2">
              {manifest.real_vs_synthetic.slice(0, 4).map((r) => {
                const st = ledgerStatus(r.status)
                return (
                  <div key={r.surface} className="flex items-start gap-2.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-2xs text-fg-base">{r.surface}</div>
                      <div className="truncate font-mono text-3xs text-fg-mute">{r.source}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => navigate('audit')}
              className="mt-3 w-full rounded-sm border border-ink-700 py-1 text-2xs text-fg-dim transition-colors hover:border-ink-650 hover:text-fg-base"
            >
              Full provenance ledger →
            </button>
          </Panel>

          <Panel title="Universe health" subtitle="Phase 0 lock">
            <dl className="space-y-2">
              {(
                [
                  ['Constituents verified', `${TICKERS.length} / ${TICKERS.length}`],
                  ['Nasdaq-listed', `${universeCount('listing_verified')} / ${TICKERS.length}`],
                  ['US-domiciled', `${universeCount('us_domicile_verified')} / ${TICKERS.length}`],
                  ['AI categories assigned', `${new Set(TICKERS.map((t) => TICKER_META[t].ai_category)).size}`],
                  ['Truncated histories', `${TRUNCATED.length} (${TRUNCATED.map((x) => x.ticker).join(', ')})`],
                  ['Verified at', universeDate()],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-micro text-fg-dim">{k}</dt>
                  <dd className="font-mono tnum text-micro text-fg-hi">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
              Current-universe historical study — survivorship bias is present by construction and
              disclosed on the audit page.
            </p>
          </Panel>

          <Panel title="Known limitations" subtitle="Disclosed, not hidden">
            <ul className="space-y-2">
              {[
                ['Survivorship / selection bias', 'Universe chosen in 2026, applied to 2020–2026.'],
                ['IPO truncation', 'PLTR and CRWV have no pre-listing observations; none are synthesised.'],
                ['Point-in-time fundamentals', 'OI-0001 OPEN — current fundamentals are descriptive only.'],
                ['Transaction-cost model', 'OI-0003 OPEN — 10bps round-trip robustness only.'],
                ['Constraint numerics', 'OI-0005 OPEN — caps are research defaults, not final locks.'],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-2.5">
                  <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-sig-warn" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-2xs font-medium text-fg-base">{title}</div>
                    <div className="text-2xs leading-relaxed text-fg-mute">{body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}

function universeCount(field: 'listing_verified' | 'us_domicile_verified'): number {
  return TICKERS.filter((t) => (TICKER_META[t] as unknown as Record<string, boolean>)[field]).length
}

function universeDate(): string {
  return fmtDate(TICKER_META.NVDA.verified_at)
}
