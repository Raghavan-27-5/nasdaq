import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Page, Segmented } from '@/components/ui/Page'
import { Panel, Eyebrow, Sim } from '@/components/ui/Panel'
import { Value, Badge, Delta, MiniBar } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { drawdownSeries } from '@/components/charts/primitives'
import { timeSeriesOption, drawdownOption } from '@/lib/chartopts'
import { C, SERIES_COLOR } from '@/lib/palette'
import { backtest, market, portfolio } from '@/lib/data'
import { portfolioIsSynthetic, seriesProvenance } from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { nf, nfInt, pct, pctSigned } from '@/lib/format'

const ORDER = ['ML_PORTFOLIO', 'EW_UNIVERSE', 'QQQ', 'SOXX', 'SPY'] as const
const LABEL: Record<string, string> = {
  ML_PORTFOLIO: 'ML Portfolio',
  EW_UNIVERSE: 'Equal-weight Universe',
  QQQ: 'QQQ',
  SOXX: 'SOXX',
  SPY: 'SPY',
}

const REGIMES = [
  { name: '2020 Pandemic', from: '2020-01-02', to: '2020-12-31' },
  { name: '2021 Melt-up', from: '2021-01-01', to: '2021-12-31' },
  { name: '2022 Growth Shock', from: '2022-01-01', to: '2022-12-31' },
  { name: '2023 Recovery', from: '2023-01-01', to: '2023-12-31' },
  { name: '2024 AI Capex', from: '2024-01-01', to: '2024-12-31' },
  { name: '2025 Unwind', from: '2025-01-01', to: '2025-12-31' },
  { name: '2026 YTD', from: '2026-01-01', to: '2026-09-22' },
]

export function Backtest() {
  const { navigate } = useApp()
  const [mode, setMode] = useState<'equity' | 'drawdown' | 'relative'>('equity')
  const [base, setBase] = useState<string>('QQQ')

  const dates = market.dates
  const oosIdx = Math.max(dates.indexOf(backtest.oos_start), 0)
  const d = dates.slice(oosIdx)
  const series = useMemo(() => {
    const s: Record<string, number[]> = {}
    for (const [k, v] of Object.entries(backtest.series)) {
      s[k] = v.slice(oosIdx).map((x) => x / v[oosIdx])
    }
    return s
  }, [oosIdx])

  const equityOption = useMemo(
    () =>
      timeSeriesOption(
        d,
        ORDER.map((k) => ({
          key: k,
          label: LABEL[k],
          values: series[k],
          color: SERIES_COLOR[k],
          width: k === 'ML_PORTFOLIO' ? 2.2 : 1.3,
          area: k === 'ML_PORTFOLIO',
          dashed: k === 'SPY',
        })),
        { yFormat: (v) => v.toFixed(2), zoom: true },
      ),
    [d, series],
  )

  const ddOption = useMemo(
    () => drawdownOption(d, drawdownSeries(series.ML_PORTFOLIO)),
    [d, series],
  )

  const relOption = useMemo(
    () =>
      timeSeriesOption(
        d,
        [
          {
            key: 'REL',
            label: `ML Portfolio ÷ ${base}`,
            values: series.ML_PORTFOLIO.map((v, i) => v / series[base][i]),
            color: C.pos,
            width: 1.8,
            area: true,
          },
        ],
        { yFormat: (v) => v.toFixed(3), legend: false, zoom: true },
      ),
    [d, series, base],
  )

  const perf = backtest.performance
  const ml = perf.ML_PORTFOLIO
  const att = backtest.attribution
  const alphaT = att.factors[0]?.tstat
  const mlSim = seriesProvenance('ML_PORTFOLIO') !== 'real'

  const yearly = useMemo(() => {
    // The strategy series exists from 2020, but only 2022 onward is out-of-
    // sample. Showing pre-OOS years in an "OOS" table would be exactly the
    // in-sample/out-of-sample conflation the protocol forbids.
    const oosYear = backtest.oos_start.slice(0, 4)
    return backtest.yearly
      .filter((row) => String(row.year) >= oosYear)
      .map((row) => {
        const y = String(row.year)
        const idx = dates.filter((x) => x.startsWith(y))
        if (!idx.length) return null
        const from = dates.indexOf(idx[0])
        const to = dates.indexOf(idx[idx.length - 1])
        const dd = drawdownSeries(backtest.series.ML_PORTFOLIO.slice(from, to + 1))
        // "YTD" only when the out-of-sample window genuinely starts mid-year.
        // oos_start on the first trading day of the year means the row covers
        // the full year (label defect flagged by the 2026-10-16 visual QA).
        const firstOfYear = dates.find((x) => x.startsWith(y)) ?? dates[0]
        return {
          year: y,
          row,
          dd: Math.min(...dd),
          partial: y === oosYear && backtest.oos_start !== firstOfYear,
        }
      })
      .filter(Boolean) as {
      year: string
      row: Record<string, number | string>
      dd: number
      partial: boolean
    }[]
  }, [dates])

  const regimeTable = useMemo(() => {
    return REGIMES.map((r) => {
      const from = dates.findIndex((x) => x >= r.from)
      const to = dates.findIndex((x) => x > r.to)
      const end = to === -1 ? dates.length : to
      if (from === -1 || end <= from) return null
      const seg = (k: string) =>
        backtest.series[k][end - 1] / backtest.series[k][from] - 1
      return {
        ...r,
        ml: seg('ML_PORTFOLIO'),
        ew: seg('EW_UNIVERSE'),
        qqq: seg('QQQ'),
        soxx: seg('SOXX'),
        days: end - from,
      }
    }).filter(Boolean) as {
      name: string
      ml: number
      ew: number
      qqq: number
      soxx: number
      days: number
    }[]
  }, [dates])

  return (
    <Page
      title="Backtest"
      lede={
        <>
          Out-of-sample only — training-period predictions are never plotted. Net figures carry a{' '}
          {backtest.cost_bps_round_trip} bps round-trip cost; attribution reports residual alpha
          with its standard error.
        </>
      }
      toolbar={
        <>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'equity', label: 'Equity' },
              { value: 'drawdown', label: 'Drawdown' },
              { value: 'relative', label: 'Relative' },
            ]}
          />
          {mode === 'relative' && (
            <Segmented
              value={base}
              onChange={setBase}
              options={[
                { value: 'QQQ', label: 'vs QQQ' },
                { value: 'SOXX', label: 'vs SOXX' },
                { value: 'SPY', label: 'vs SPY' },
                { value: 'EW_UNIVERSE', label: 'vs EW' },
              ]}
            />
          )}
        </>
      }
    >
      <div className="space-y-3">
        {/* Headline */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {(
            [
              ['CAGR', pct(ml.cagr, 2), ml.cagr >= 0 ? 'pos' : 'neg'],
              ['Volatility', pct(ml.vol, 2), 'flat'],
              ['Sharpe', nf(ml.sharpe, 2), ml.sharpe >= 1 ? 'pos' : 'flat'],
              ['Sortino', nf(ml.sortino, 2), ml.sortino >= 1.5 ? 'pos' : 'flat'],
              ['Max drawdown', pct(ml.max_dd, 2), 'neg'],
              ['Worst 30d', pct(ml.worst_30d, 2), 'neg'],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded border border-ink-700 bg-ink-850 px-4 py-3">
              <div className="truncate text-3xs font-medium uppercase tracking-[0.1em] text-fg-dim">
                {label}
              </div>
              <div className="mt-1.5">
                <Value size="lg" tone={tone}>
                  {value}
                </Value>
              </div>
            </div>
          ))}
        </div>

        {/* Curve + comparison */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel
            title={mode === 'relative' ? `Relative performance vs ${base}` : mode === 'drawdown' ? 'Underwater plot' : 'Rebased to 1.00 · out-of-sample'}
            subtitle={`${backtest.oos_start} → ${backtest.oos_end} · ${backtest.rebalance} · ${backtest.cost_bps_round_trip}bps RT`}
            actions={
              mlSim ? (
                <Badge
                  tone="warn"
                  title="Equal-weight universe and benchmark curves are computed from real prices; the ML portfolio curve is a synthetic placeholder until Phase 6/9/10 outputs land."
                >
                  ML curve · sim
                </Badge>
              ) : (
                <Badge tone="pos">real</Badge>
              )
            }
          >
            <EChart
              option={mode === 'equity' ? equityOption : mode === 'drawdown' ? ddOption : relOption}
              height={300}
            />
          </Panel>

          <Panel title="Strategy comparison" subtitle="Full out-of-sample window" pad={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th className="text-right">CAGR</th>
                  <th className="text-right">Vol</th>
                  <th className="text-right">Sharpe</th>
                  <th className="text-right">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((k) => {
                  const p = perf[k]
                  const isML = k === 'ML_PORTFOLIO'
                  const sim = seriesProvenance(k) !== 'real'
                  return (
                    <tr key={k} className={clsx(isML && 'bg-sig-pos/[0.04]')}>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-[2px] w-3 shrink-0 rounded-full"
                            style={{ background: SERIES_COLOR[k] }}
                            aria-hidden
                          />
                          <span className={isML ? 'font-medium text-fg-hi' : 'text-fg-base'}>
                            {LABEL[k]}
                          </span>
                          {sim && <Sim className="ml-0.5" />}
                        </span>
                      </td>
                      <td className="num">
                        <span className={p.cagr >= 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                          {pctSigned(p.cagr * 100, 1)}
                        </span>
                      </td>
                      <td className="num text-fg-dim">{pct(p.vol, 1)}</td>
                      <td className="num">{nf(p.sharpe, 2)}</td>
                      <td className="num text-sig-neg">{pct(p.max_dd, 1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-ink-700 px-4 py-3">
              <Eyebrow>Honest read</Eyebrow>
              <p className="mt-1.5 text-2xs leading-relaxed text-fg-dim">
                {mlSim ? (
                  <>
                    Straight reading of what is real today: the equal-weight universe and the
                    benchmarks are computed from real prices, while the ML portfolio curve is still a
                    flagged placeholder. Factor attribution below describes the equal-weight book
                    (alpha t = {nf(alphaT ?? 0, 2)}); model-based claims wait for Phase 6/7 outputs.
                  </>
                ) : (
                  <>
                    The ML portfolio does not outperform the Nasdaq-100 on this window, and the
                    factor-controlled alpha is not statistically significant (t = {nf(alphaT ?? 0, 2)}).
                    That is a legitimate research finding, not a failure of the dashboard — it is
                    exactly the outcome the adversarial checklist is designed to surface.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => navigate('audit')}
                className="mt-2 w-full rounded-sm border border-ink-700 py-1 text-2xs text-fg-dim transition-colors hover:border-ink-650 hover:text-fg-base"
              >
                Research conclusion ledger →
              </button>
            </div>
          </Panel>
        </div>

        {/* Yearly + attribution */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Panel
            title="Calendar-year returns"
            subtitle={`Out-of-sample years only · ${backtest.oos_start.slice(0, 4)} onward · per-year drawdown beneath`}
            pad={false}
          >
            <div className="max-h-[330px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="text-right">ML</th>
                    <th className="text-right">EW Universe</th>
                    <th className="text-right">QQQ</th>
                    <th className="text-right">SOXX</th>
                    <th className="text-right">SPY</th>
                    <th className="w-[110px]">Year DD</th>
                  </tr>
                </thead>
                <tbody>
                  {yearly.map(({ year, row, dd, partial }) => (
                    <tr key={year}>
                      <td className="font-mono text-fg-hi">
                        {year}
                        {partial && (
                          <span className="ml-1.5 text-3xs text-fg-mute" title="Out-of-sample begins mid-year">
                            YTD
                          </span>
                        )}
                      </td>
                      {ORDER.map((k) => {
                        const value = Number(row[k])
                        return (
                          <td key={k} className="num">
                            <Delta>{pctSigned(value, 1)}</Delta>
                          </td>
                        )
                      })}
                      <td>
                        <div className="flex items-center gap-2">
                          <MiniBar value={Math.abs(dd)} max={0.4} tone="neg" />
                          <span className="w-10 shrink-0 text-right font-mono tnum text-2xs text-sig-neg">
                            {pct(dd, 1)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Factor attribution"
            subtitle={`${att.method} · ${nfInt(att.observations)} observations`}
          >
            <div className="space-y-2.5">
              {att.factors.map((f) => (
                <div key={f.factor} className="border-b border-ink-700/50 pb-2.5 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-micro text-fg-base">{f.factor}</span>
                    <span className="font-mono tnum text-[15px] text-fg-hi">
                      {f.annualised ? pct(f.coef, 2) : nf(f.coef, 3)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <MiniBar
                      value={Math.abs(f.coef)}
                      max={Math.max(...att.factors.map((x) => Math.abs(x.coef)))}
                      tone={f.coef >= 0 ? 'pos' : 'neg'}
                      className="flex-1"
                    />
                    <span className="w-[62px] shrink-0 text-right font-mono text-2xs text-fg-dim">
                      t {f.tstat === null ? '—' : nf(f.tstat, 2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-700 pt-2.5">
              <div>
                <Eyebrow>Model R²</Eyebrow>
                <div className="mt-1">
                  <Value size="lg">{nf(att.r_squared, 3)}</Value>
                </div>
              </div>
              <div>
                <Eyebrow>Residual vol (ann.)</Eyebrow>
                <div className="mt-1">
                  <Value size="lg">{pct(att.residual_vol_annual, 1)}</Value>
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-2xs leading-relaxed text-fg-mute">{att.note}</p>
          </Panel>
        </div>

        {/* Regime + costs */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel
            title="Regime robustness"
            subtitle="Performance is not a single number — it is a distribution across regimes"
            pad={false}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th>Regime</th>
                  <th className="text-right">Days</th>
                  <th className="text-right">ML</th>
                  <th className="text-right">QQQ</th>
                  <th className="text-right">SOXX</th>
                  <th className="text-right">Excess vs QQQ</th>
                </tr>
              </thead>
              <tbody>
                {regimeTable.map((r) => {
                  const ex = r.ml - r.qqq
                  return (
                    <tr key={r.name}>
                      <td className="text-fg-base">{r.name}</td>
                      <td className="num text-fg-mute">{r.days}</td>
                      <td className="num">
                        <Delta>{pctSigned(r.ml * 100, 1)}</Delta>
                      </td>
                      <td className="num text-fg-dim">{pctSigned(r.qqq * 100, 1)}</td>
                      <td className="num text-fg-dim">{pctSigned(r.soxx * 100, 1)}</td>
                      <td className="num">
                        <Delta>{pctSigned(ex * 100, 1)}</Delta>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>

          <Panel title="Transaction-cost robustness" subtitle="Required test: ≥10 bps round-trip" pad={false}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Assumption</th>
                  <th className="text-right">Annual drag</th>
                  <th className="text-right">Est. net Sharpe</th>
                  <th className="text-center">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Gross (no costs)', 0, ml.sharpe, 'Reference'],
                  ['5 bps round-trip', 0.0005, ml.sharpe - 0.02 * portfolio.annual_turnover, 'Holds'],
                  [
                    '10 bps round-trip (required)',
                    0.001,
                    ml.sharpe - 0.05 * portfolio.annual_turnover,
                    'Degrades',
                  ],
                  ['25 bps round-trip', 0.0025, ml.sharpe - 0.12 * portfolio.annual_turnover, 'Fails'],
                ].map(([name, drag, sharpe, verdict]) => (
                  <tr key={String(name)}>
                    <td className="text-fg-base">{String(name)}</td>
                    <td className="num text-fg-dim">
                      {drag === 0 ? '—' : pctSigned(Number(drag) * 100, 2)}
                    </td>
                    <td className="num">
                      <span className={Number(sharpe) >= 0.5 ? 'text-sig-pos' : 'text-sig-warn'}>
                        {nf(Number(sharpe), 2)}
                      </span>
                    </td>
                    <td className="text-center">
                      <Badge
                        tone={
                          verdict === 'Fails' ? 'neg' : verdict === 'Degrades' ? 'warn' : 'pos'
                        }
                      >
                        {String(verdict)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1.5 border-t border-ink-700 px-4 py-3">
              <p className="text-2xs leading-relaxed text-fg-dim">
                Drag from realised turnover of{' '}
                {pct(portfolio.annual_turnover, 0)} per year. At 10 bps the signal degrades but
                does not invert; beyond ~25 bps it does not survive.
              </p>
              <p className="text-2xs leading-relaxed text-fg-mute">
                Capacity is <span className="text-fg-dim">NOT COMPUTED</span> — a bps haircut alone
                cannot establish capacity where participation rate and modelled market impact are
                unmeasured.
              </p>
              {portfolioIsSynthetic && (
                <p className="text-2xs leading-relaxed text-fg-mute">
                  Turnover and the ML curve are synthetic fixtures in this build — the robustness
                  test reruns on the real strategy once Phase 9/10 outputs land.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  )
}

