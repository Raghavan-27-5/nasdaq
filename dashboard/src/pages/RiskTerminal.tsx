import { useMemo, useState } from 'react'
import { Page, Segmented } from '@/components/ui/Page'
import { Panel, Eyebrow } from '@/components/ui/Panel'
import { Value, Badge } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { ContributionBar } from '@/components/charts/primitives'
import { C, CORR_RAMP } from '@/lib/palette'
import { risk, portfolio } from '@/lib/data'
import { riskBookIsPlaceholder, riskIsReal } from '@/lib/provenance'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import { useApp } from '@/lib/store'
import { nf, pct, pctSigned } from '@/lib/format'

export function RiskTerminal() {
  const { selectTicker, ticker } = useApp()
  const [mode, setMode] = useState<'corr' | 'beta'>('corr')

  const tickers = risk.tickers

  // Book weights follow the artifact basis: equal-weight reference weights while
  // the optimised (Phase 9) book does not exist, fixture weights otherwise.
  const wOf = (t: string): number =>
    riskBookIsPlaceholder
      ? (risk.reference_weights?.[t] ?? 0)
      : (portfolio.weights[t] ?? 0)

  const heatmapData = useMemo(() => {
    const out: [number, number, number][] = []
    for (let i = 0; i < tickers.length; i++) {
      for (let j = 0; j < tickers.length; j++) {
        out.push([j, tickers.length - 1 - i, risk.correlation[i][j]])
      }
    }
    return out
  }, [tickers])

  const corrOption = useMemo(
    () => ({
      grid: { left: 4, right: 4, top: 6, bottom: 52, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: tickers,
        position: 'top' as const,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: C.dim,
          fontFamily: '"JetBrains Mono Variable", monospace',
          fontSize: 9,
          rotate: 90,
          interval: 0,
        },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category' as const,
        data: [...tickers].reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: C.dim, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 9.5 },
        splitArea: { show: false as const },
      },
      visualMap: {
        // Correlations in this universe run ~0.25-1.0 and are all positive; a
        // -1..+1 scale would render every cell identically hot.
        min: 0.2,
        max: 1,
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 2,
        itemWidth: 11,
        itemHeight: 74,
        text: ['1.00', '0.20'],
        textStyle: { color: C.dim, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 9 },
        inRange: { color: CORR_RAMP },
        precision: 2,
      },
      tooltip: {
        position: 'top' as const,
        backgroundColor: 'rgba(14,16,19,.97)',
        borderColor: C.hairlineStrong,
        borderWidth: 1,
        padding: [7, 9],
        textStyle: { color: C.hi, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 11 },
        extraCssText: 'box-shadow:0 12px 32px -8px rgba(0,0,0,.8);border-radius:3px;',
        formatter: (p: unknown) => {
          const it = p as { value: [number, number, number] }
          const [x, y, v] = it.value
          return `<div style="color:${C.hi};font-weight:600">${tickers[x]} × ${tickers[y]}</div>
            <div style="margin-top:3px">ρ = ${v.toFixed(3)}</div>`
        },
      },
      series: [
        {
          type: 'heatmap' as const,
          data: heatmapData,
          label: {
            show: true,
            fontFamily: '"JetBrains Mono Variable", monospace',
            fontSize: 8.5,
            color: '#E9ECEF',
            formatter: (p: CallbackDataParams) =>
              Number(
                (p.value as [number, number, number] | undefined)?.[2] ?? 0,
              )
                .toFixed(2)
                .replace('0.', '.'),
          },
          itemStyle: { borderColor: C.panel, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: C.hi, borderWidth: 1.2 } },
        },
      ],
    }),
    [heatmapData, tickers],
  )

  const betaOption = useMemo(
    () => ({
      grid: { left: 6, right: 14, top: 12, bottom: 6, containLabel: true },
      xAxis: {
        type: 'value' as const,
        name: 'Beta vs QQQ',
        nameLocation: 'middle' as const,
        nameGap: 24,
        nameTextStyle: { color: C.dim, fontSize: 10 },
        scale: true,
        axisLine: { lineStyle: { color: C.hairline } },
        axisTick: { show: false },
        axisLabel: { color: C.dim, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: C.hairline, opacity: 0.5 } },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Beta vs SOXX',
        nameLocation: 'middle' as const,
        nameGap: 32,
        nameTextStyle: { color: C.dim, fontSize: 10 },
        scale: true,
        axisLine: { lineStyle: { color: C.hairline } },
        axisTick: { show: false },
        axisLabel: { color: C.dim, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: C.hairline, opacity: 0.5 } },
      },
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(14,16,19,.97)',
        borderColor: C.hairlineStrong,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: C.hi, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 11 },
        extraCssText: 'box-shadow:0 12px 32px -8px rgba(0,0,0,.8);border-radius:3px;',
        formatter: (p: unknown) => {
          const d = (p as { data: { name: string; w: number }[] }).data[0]
          return `<div style="color:${C.hi};font-weight:600">${d.name}</div>
            <div style="color:${C.dim};margin-top:3px">weight ${pct(d.w, 1)}</div>`
        },
      },
      series: [
        {
          type: 'scatter' as const,
          data: tickers.map((t) => ({
            name: t,
            value: [risk.per_ticker[t].beta_qqq, risk.per_ticker[t].beta_soxx] as [
              number,
              number,
            ],
            w: wOf(t),
          })),
          symbolSize: (d: unknown) => 7 + Math.sqrt((d as { w: number }).w) * 30,
          itemStyle: {
            color: C.pos,
            opacity: 0.72,
            borderColor: C.canvas,
            borderWidth: 1,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: C.hairlineStrong, type: 'dashed' as const, width: 1 },
            label: { show: false },
            data: [{ xAxis: 1 }, { yAxis: 1 }],
          },
          emphasis: { itemStyle: { opacity: 1, borderColor: C.hi } },
        },
      ],
    }),
    [tickers],
  )

  const contribRows = useMemo(
    () =>
      tickers
        .map((t) => ({
          label: t,
          cctr: risk.cctr[t] ?? 0,
          mctr: risk.mctr[t] ?? 0,
          w: riskBookIsPlaceholder
            ? (risk.reference_weights?.[t] ?? 0)
            : (portfolio.weights[t] ?? 0),
        }))
        .sort((a, b) => b.cctr - a.cctr),
    [tickers],
  )

  const maxCctr = Math.max(...contribRows.map((r) => Math.abs(r.cctr)))

  return (
    <Page
      title="Risk Terminal"
      lede={
        <>
          Trailing-window covariance, Ledoit-Wolf shrunk — at n = 20 the raw sample matrix is near
          singular, so shrinkage is correctness, not refinement.
        </>
      }
      toolbar={
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'corr', label: 'Correlation' },
            { value: 'beta', label: 'Beta map' },
          ]}
        />
      }
    >
      <div className="space-y-3">
        {/* Portfolio risk summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {(
            [
              ['Portfolio vol', pct(risk.portfolio.vol_annual, 1), 'flat'],
              ['VaR 95 (1d)', pct(risk.portfolio.var_95_daily, 2), 'neg'],
              ['ES 95 (1d)', pct(risk.portfolio.es_95_daily, 2), 'neg'],
              ['Beta QQQ', nf(risk.portfolio.beta_qqq, 2), 'flat'],
              ['Beta SOXX', nf(risk.portfolio.beta_soxx, 2), 'flat'],
              ['Avg pairwise ρ', nf(risk.portfolio.avg_pairwise_corr, 2), 'flat'],
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

        {riskBookIsPlaceholder && (
          <p className="text-2xs leading-relaxed text-fg-mute">
            Portfolio-level statistics describe the equal-weight reference book of all tradable
            names — optimised weights land with Phase 9.
          </p>
        )}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Panel
            title={mode === 'corr' ? 'Correlation matrix' : 'Benchmark beta map'}
            subtitle={
              mode === 'corr'
                ? 'Trailing 756 trading days · overlapping windows truncated at the later listing date'
                : 'Bubble area = portfolio weight · dashed crosshair at beta 1.0'
            }
            actions={
              riskIsReal ? (
                <Badge
                  tone="pos"
                  title="Correlation, betas and volatility are computed from real acquired prices. Contributions describe the equal-weight reference book."
                >
                  real
                </Badge>
              ) : (
                <Badge tone="warn">synthetic</Badge>
              )
            }
          >
            <EChart option={mode === 'corr' ? corrOption : betaOption} height={424} />
          </Panel>

          <Panel
            title="Risk contributions"
            subtitle={
              riskBookIsPlaceholder
                ? 'Component contribution to volatility · equal-weight reference book'
                : 'Component contribution to portfolio volatility at target weights'
            }
            pad={false}
          >
            <div className="max-h-[424px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="w-[110px]">CCTR</th>
                    <th className="text-right">% of risk</th>
                    <th className="text-right">MCTR</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {contribRows.map((r) => (
                    <tr
                      key={r.label}
                      tabIndex={0}
                      onClick={() => selectTicker(r.label)}
                      onKeyDown={(e) => e.key === 'Enter' && selectTicker(r.label)}
                      data-selected={r.label === ticker}
                      className="rowfocus cursor-pointer"
                    >
                      <td>
                        <span className="font-mono text-[12px] font-semibold text-fg-hi">
                          {r.label}
                        </span>
                      </td>
                      <td>
                        <ContributionBar value={r.cctr} max={maxCctr} height={9} />
                      </td>
                      <td className="num text-fg-base">{pct(r.cctr, 1)}</td>
                      <td className="num text-fg-dim">{nf(r.mctr, 3)}</td>
                      <td className="num text-fg-dim">{pct(r.w, 1)}</td>
                      <td className="num text-fg-dim">{pct(risk.per_ticker[r.label].vol_annual, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Covariance estimator" subtitle="Ledoit-Wolf shrinkage">
            <dl className="space-y-2">
              {(
                [
                  ['Method', risk.covariance.method],
                  ['Estimation window', `${risk.covariance.window_days} trading days`],
                  ['Shrinkage intensity', nf(risk.covariance.shrinkage_intensity, 3)],
                  ['Condition no. (raw)', nf(risk.covariance.condition_number_raw, 1)],
                  ['Condition no. (shrunk)', nf(risk.covariance.condition_number_shrunk, 1)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-1.5 last:border-0">
                  <dt className="text-micro text-fg-dim">{k}</dt>
                  <dd className="font-mono tnum text-micro text-fg-hi">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-2xs leading-relaxed text-fg-mute">{risk.covariance.note}</p>
          </Panel>

          <Panel title="Concentration" subtitle="Diversification quality of the current book">
            <dl className="space-y-2.5">
              {(
                [
                  ['Effective names', nf(risk.portfolio.effective_names, 2)],
                  ['Herfindahl index', nf(risk.portfolio.herfindahl, 4)],
                  ['Max pairwise ρ', nf(risk.portfolio.max_pairwise_corr, 2)],
                  ['Avg pairwise ρ', nf(risk.portfolio.avg_pairwise_corr, 2)],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-micro text-fg-dim">{k}</span>
                    <span className="font-mono tnum text-micro text-fg-hi">{v}</span>
                  </div>
                </div>
              ))}
            </dl>
            <div className="mt-3 border-t border-ink-700 pt-2.5">
              <Eyebrow>Interpretation</Eyebrow>
              <p className="mt-1 text-2xs leading-relaxed text-fg-dim">
                An average pairwise correlation near {nf(risk.portfolio.avg_pairwise_corr, 2)} means
                roughly {Math.round((1 - risk.portfolio.avg_pairwise_corr) * 100)}% of single-name
                variance is idiosyncratic — the remaining systematic component cannot be diversified
                away within this universe.
              </p>
            </div>
          </Panel>

          <Panel title="Stress scenarios" subtitle="Shocks applied to the current book">
            <div className="space-y-2">
              {risk.stress.map((s) => (
                <div key={s.name} className="border-b border-ink-700/50 pb-2 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-micro text-fg-base">{s.name}</span>
                    <span className="font-mono tnum text-micro text-sig-neg">
                      {pctSigned(s.shock * 100, 1)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs leading-relaxed text-fg-mute">{s.basis}</p>
                </div>
              ))}
            </div>
            <p className="mt-2.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
              Scenarios are historical analogues, not forecasts. No probability is attached.
            </p>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
