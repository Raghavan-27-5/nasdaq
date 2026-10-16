import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Page, Segmented, Disclosure } from '@/components/ui/Page'
import { Panel, Eyebrow } from '@/components/ui/Panel'
import { Value, Badge, MiniBar } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { timeSeriesOption, rankBarOption } from '@/lib/chartopts'
import { C } from '@/lib/palette'
import { portfolio, risk, backtest, TICKERS, TICKER_META, FUND, universe } from '@/lib/data'
import { portfolioIsSynthetic, riskBookIsPlaceholder } from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { nf, pct, pctSigned, bps, humanise, fmtDate } from '@/lib/format'

type Sol = 'constrained' | 'unconstrained' | 'ew'

const SOL_COLOR: Record<Sol, string> = {
  constrained: C.pos,
  unconstrained: C.warn,
  ew: C.info,
}

const SECTOR_LABEL: Record<string, string> = {
  SEMI: 'Semiconductor / equipment / EDA',
  HYPER: 'Hyperscaler / platform',
  SOFT: 'Software / security / AI cloud',
}

export function PortfolioOptimizer() {
  const { selectTicker, ticker } = useApp()
  const [sol, setSol] = useState<Sol>('constrained')
  // Fixture weights exist while the risk artifact describes a different book
  // (equal-weight reference). Risk contributions for fixture weights are then
  // not computed anywhere and must not be implied.
  const bookMismatch = portfolioIsSynthetic && riskBookIsPlaceholder

  const weights =
    sol === 'constrained' ? portfolio.weights : sol === 'unconstrained' ? portfolio.unconstrained_weights : portfolio.equal_weight

  const rows = useMemo(
    () =>
      TICKERS.map((t) => ({
        t,
        w: weights[t] ?? 0,
        unconstrained: portfolio.unconstrained_weights[t] ?? 0,
        mu: portfolio.prediction_inputs.find((p) => p.ticker === t)?.mu_21d ?? 0,
        pv: portfolio.prediction_inputs.find((p) => p.ticker === t)?.pred_vol_21d ?? 0,
        sector: portfolio.sector_of[t],
        mctr: riskBookIsPlaceholder ? null : (risk.mctr[t] ?? 0),
        cctr: riskBookIsPlaceholder ? null : (risk.cctr[t] ?? 0),
        rank: FUND[t].rank,
      })).sort((a, b) => b.w - a.w),
    [weights],
  )

  const maxW = Math.max(...rows.map((r) => Math.max(r.w, r.unconstrained)))

  const sectorTotals = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.sector] = (m[r.sector] ?? 0) + r.w
    return m
  }, [rows])

  const turnoverOption = useMemo(
    () =>
      timeSeriesOption(
        portfolio.rebalance_dates,
        [
          {
            key: 'T',
            label: 'Turnover',
            values: portfolio.turnover,
            color: C.pos,
            width: 1.6,
            area: true,
          },
        ],
        { yFormat: (v) => `${(v * 100).toFixed(0)}%`, legend: false },
      ),
    [],
  )

  const weightOption = useMemo(
    () =>
      rankBarOption(
        rows.map((r) => ({
          label: `${r.t} · ${humanise(TICKER_META[r.t].ai_category).slice(0, 22)}`,
          value: r.w,
          sub: `Sector ${r.sector} · predicted 21d μ ${pctSigned(r.mu * 100, 1)} · MCTR ${nf(r.mctr, 3)}`,
        })),
        { valueFormat: (v) => pct(v, 1), signed: false, color: SOL_COLOR[sol] },
      ),
    [rows, sol],
  )

  const total = rows.reduce((s, r) => s + r.w, 0)
  const binding = portfolio.constraints.filter((c) => c.binding)

  return (
    <Page
      title="Portfolio Optimizer"
      lede={
        <>
          Predicted 21-day returns enter the objective alongside a shrinkage covariance estimate,
          explicit concentration limits, a turnover cap and an explicit transaction-cost penalty.
          All three reference solutions are retained so the cost of the constraints is measurable.
        </>
      }
      toolbar={
        <Segmented
          value={sol}
          onChange={setSol}
          options={[
            { value: 'constrained', label: 'Constrained' },
            { value: 'unconstrained', label: 'Unconstrained' },
            { value: 'ew', label: 'Equal weight' },
          ]}
        />
      }
    >
      <div className="space-y-3">
        {bookMismatch && (
          <div className="rounded border border-sig-warn/30 bg-sig-warn/[0.06] px-4 py-2.5 text-2xs leading-relaxed text-fg-base">
            <span className="font-semibold text-sig-warn">Fixture preview. </span>
            Weights, predicted returns and constraint results on this page are synthetic until the
            Phase-6 predictions and Phase-9 optimiser run. MCTR / CCTR columns are suppressed: the
            real risk artifact describes the equal-weight reference book, not these weights.
          </div>
        )}

        {/* Headline */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {(
            [
              ['Gross exposure', pct(total, 1), 'flat'],
              ['Largest position', pct(Math.max(...rows.map((r) => r.w)), 1), 'flat'],
              ['Positions', String(rows.filter((r) => r.w > 0.0001).length), 'flat'],
              ['Annual turnover', pct(portfolio.annual_turnover, 0), 'flat'],
              ['Cost / turnover', bps(portfolio.annual_turnover * 10, 0), 'flat'],
              ['Effective names', bookMismatch ? '—' : nf(risk.portfolio.effective_names, 1), 'flat'],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded border border-ink-700 bg-ink-850 px-4 py-3">
              <div className="truncate text-3xs font-medium uppercase tracking-[0.1em] text-fg-dim">
                {label}
              </div>
              <div className="mt-1.5">
                <Value size="lg" tone={tone === 'flat' ? 'flat' : tone}>
                  {value}
                </Value>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel
            title="Target weights"
            subtitle={
              sol === 'constrained'
                ? 'Optimised under the full constraint set'
                : sol === 'unconstrained'
                  ? 'Same objective without concentration limits — reference only'
                  : 'Equal-weight reference benchmark'
            }
            actions={
              portfolioIsSynthetic ? (
                <Badge
                  tone="warn"
                  title="Weights are a synthetic fixture until the Phase-6 predictions and Phase-9 optimiser run land."
                >
                  synthetic
                </Badge>
              ) : (
                <Badge tone="pos">real</Badge>
              )
            }
            pad={false}
          >
            <div className="max-h-[420px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Sector</th>
                    <th className="w-[120px]">Weight</th>
                    <th className="text-right">Unconstr.</th>
                    <th className="text-right">μ 21d</th>
                    <th className="text-right">Pred vol</th>
                    <th className="text-right">MCTR</th>
                    <th className="text-right">CCTR</th>
                    <th className="text-right">Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const capped = r.unconstrained > 0.12
                    return (
                      <tr
                        key={r.t}
                        tabIndex={0}
                        onClick={() => selectTicker(r.t)}
                        onKeyDown={(e) => e.key === 'Enter' && selectTicker(r.t)}
                        data-selected={r.t === ticker}
                        className="rowfocus cursor-pointer"
                      >
                        <td>
                          <span className="font-mono text-[12px] font-semibold text-fg-hi">{r.t}</span>
                        </td>
                        <td className="text-2xs text-fg-dim">{SECTOR_LABEL[r.sector] ?? r.sector}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <MiniBar value={r.w} max={maxW} tone="pos" />
                            <span className="w-10 shrink-0 text-right font-mono tnum text-2xs text-fg-hi">
                              {pct(r.w, 1)}
                            </span>
                          </div>
                        </td>
                        <td className="num text-fg-mute">{pct(r.unconstrained, 1)}</td>
                        <td className="num">
                          <span className={r.mu >= 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                            {pctSigned(r.mu * 100, 1)}
                          </span>
                        </td>
                        <td className="num text-fg-dim">{pct(r.pv, 0)}</td>
                        <td className="num text-fg-dim">{nf(r.mctr, 3)}</td>
                        <td className="num text-fg-dim">{nf(r.cctr, 3)}</td>
                        <td className="num">
                          {capped ? (
                            <Badge tone="warn">capped</Badge>
                          ) : (
                            <span className="text-fg-mute">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {sol === 'unconstrained' && (
              <p className="border-t border-ink-700 px-4 py-2.5 text-2xs leading-relaxed text-sig-warn">
                The unconstrained solution concentrates far beyond the mandate:{' '}
                {pct(Math.max(...rows.map((r) => r.unconstrained)), 1)} in a single name versus a 12%
                cap. This is the cost of constraints, shown rather than asserted.
              </p>
            )}
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel title="Weight profile" subtitle="Sorted by target weight" className="flex-1">
              <EChart option={weightOption} height={262} />
            </Panel>

            <Panel title="Sector concentration" subtitle="Caps: SEMI 34% · HYPER 26% · SOFT 26%">
              <div className="space-y-2.5">
                {(['SEMI', 'HYPER', 'SOFT'] as const).map((s) => {
                  const cap = s === 'SEMI' ? 0.34 : 0.26
                  const v = sectorTotals[s] ?? 0
                  const over = v > cap
                  return (
                    <div key={s}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-micro text-fg-dim">{SECTOR_LABEL[s]}</span>
                        <span className="shrink-0 font-mono tnum text-micro text-fg-hi">
                          {pct(v, 1)}
                          <span className="text-fg-mute"> / {pct(cap, 0)}</span>
                        </span>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-750">
                        <div
                          className={clsx(
                            'absolute inset-y-0 left-0 rounded-full',
                            over ? 'bg-sig-neg' : 'bg-sig-pos/70',
                          )}
                          style={{ width: `${Math.min(v / cap, 1) * 100}%` }}
                        />
                        <div
                          className="absolute inset-y-0 w-px bg-sig-warn"
                          style={{ left: '100%' }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 border-t border-ink-700 pt-2.5">
                <Eyebrow>Hirschman index</Eyebrow>
                <div className="mt-1 flex items-baseline gap-2">
                  {bookMismatch ? (
                    <span className="text-2xs leading-relaxed text-fg-mute">
                      Risk-artifact concentration statistics describe the equal-weight book —
                      recomputed for these weights with Phase 9.
                    </span>
                  ) : (
                    <>
                      <Value size="lg">{nf(risk.portfolio.herfindahl, 4)}</Value>
                      <span className="text-2xs text-fg-mute">
                        {risk.portfolio.effective_names} effective names
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Constraint register" subtitle={`${binding.length} binding · ${portfolio.constraints.length - binding.length} slack`} pad={false}>
            <div className="max-h-[268px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Constraint</th>
                    <th>Definition</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.constraints.map((c) => (
                    <tr key={c.name}>
                      <td className="text-fg-base">{c.name}</td>
                      <td className="font-mono text-2xs text-fg-dim">{c.definition}</td>
                      <td className="text-center">
                        {c.binding ? <Badge tone="warn">binding</Badge> : <Badge tone="pos">slack</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Turnover & cost" subtitle={`${portfolio.rebalance_dates.length} rebalances to date`}>
            <EChart option={turnoverOption} height={150} />
            <dl className="mt-2 space-y-1.5 border-t border-ink-700 pt-2">
              {(
                [
                  ['Rebalance', backtest.rebalance],
                  ['Cost model', `${backtest.cost_bps_round_trip} bps round-trip`],
                  ['Latest rebalance', fmtDate(portfolio.rebalance_dates[portfolio.rebalance_dates.length - 1])],
                  ['Annual turnover', pct(portfolio.annual_turnover, 1)],
                  ['Cost drag / year', pct(portfolio.annual_turnover * 0.001, 3)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-micro text-fg-dim">{k}</dt>
                  <dd className="font-mono tnum text-micro text-fg-hi">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Provenance" subtitle="Every weight is auditable to its run">
            <dl className="space-y-1.5">
              {(
                [
                  ['Portfolio version', portfolio.portfolio_version],
                  ['Optimizer version', portfolio.optimizer_version],
                  ['Objective version', portfolio.objective_version],
                  ['As of', portfolio.as_of],
                  ['Universe version', `v${universe.universe_version}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-micro text-fg-dim">{k}</dt>
                  <dd className="font-mono text-2xs text-fg-hi">{v}</dd>
                </div>
              ))}
            </dl>
            <Disclosure summary="Covariance estimator">
              <p className="text-2xs leading-relaxed text-fg-dim">
                {risk.covariance.method} over a trailing {risk.covariance.window_days}-day window,
                shrinkage intensity {nf(risk.covariance.shrinkage_intensity, 3)}. Condition number
                falls from {nf(risk.covariance.condition_number_raw, 0)} (raw sample) to{' '}
                {nf(risk.covariance.condition_number_shrunk, 0)}.
              </p>
            </Disclosure>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
