import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Page, Segmented, Disclosure } from '@/components/ui/Page'
import { Panel, Eyebrow } from '@/components/ui/Panel'
import { Badge, Delta, MiniBar } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { C } from '@/lib/palette'
import {
  fundamentals,
  universe,
  TICKERS,
  TICKER_META,
  market,
  TRUNCATED,
  historyStart,
  RESEARCH_END,
} from '@/lib/data'
import type { FundamentalRow } from '@/lib/data'
import { useApp } from '@/lib/store'
import { nf, pct, pctSigned, humanise, bn } from '@/lib/format'

type SortKey =
  | 'rank' | 'ticker' | 'composite_score' | 'ai_revenue_exposure' | 'revenue_growth'
  | 'fcf_quality' | 'fwd_pe' | 'aicapex_exposure' | 'earnings_revisions'
  | 'momentum_12_1' | 'vol_3m' | 'drawdown_52w' | 'avg_corr' | 'market_cap_bn'

const CAT_COLOR: Record<string, string> = {
  AI_COMPUTE: C.pos,
  AI_MEMORY: C.warn,
  CUSTOM_SILICON_NETWORKING: C.info,
  AI_NETWORKING_CUSTOM_SILICON: C.info,
  SEMICONDUCTOR_EQUIPMENT_AI_CAPEX: C.cyan,
  EDA_AI_SEMICONDUCTIC_DESIGN: C.alt,
  EDA_AI_SEMICONDUCT_DESIGN: C.alt,
  HYPERSCALER_AI_PLATFORM: '#F472B6',
  AI_PLATFORM_INFRASTRUCTURE: '#F472B6',
  ENTERPRISE_AI: '#A3E635',
  AI_CYBERSECURITY: '#FB923C',
  GENERATIVE_AI_SOFTWARE: '#F472B6',
  AI_CLOUD_OBSERVABILITY: C.info,
  AI_CLOUD_INFRASTRUCTURE: C.pos,
  EDGE_AI_COMPUTE: C.cyan,
}

const catColor = (cat: string) => CAT_COLOR[cat] ?? C.dim

export function AIUniverse() {
  const { selectTicker, ticker } = useApp()
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [scatter, setScatter] = useState<'pe' | 'growth' | 'mcap'>('pe')

  const rows = useMemo(() => {
    const r = [...fundamentals.constituents]
    r.sort((a, b) => {
      const av = a[sortKey as keyof FundamentalRow]
      const bv = b[sortKey as keyof FundamentalRow]
      if (typeof av === 'string' || typeof bv === 'string') {
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return r
  }, [sortKey, sortDir])

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'rank' || k === 'ticker' ? 'asc' : 'desc')
    }
  }

  const SortTh = (k: SortKey, label: string) => (
    <th
      className={clsx(
        'cursor-pointer select-none transition-colors hover:text-fg-base',
        sortKey === k && 'text-sig-pos',
      )}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 whitespace-nowrap"
      >
        {label}
        {sortKey === k && <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  const scatterOption = useMemo(() => {
    const xKey = scatter === 'pe' ? 'fwd_pe' : scatter === 'growth' ? 'revenue_growth' : 'market_cap_bn'
    return {
      grid: { left: 6, right: 12, top: 12, bottom: 6, containLabel: true },
      legend: { show: false as const },
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(14,16,19,.97)',
        borderColor: C.hairlineStrong,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: C.hi, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 11 },
        extraCssText: 'box-shadow:0 12px 32px -8px rgba(0,0,0,.8);border-radius:3px;',
        formatter: (p: unknown) => {
          const d = (p as { data: { name: string; value: number[] }[] }).data?.[0]
          if (!d) return ''
          const t = String(d.name)
          return `<div style="font-weight:600;color:${C.hi}">${t}</div>
            <div style="color:${C.dim};margin-top:3px">${humanise(TICKER_META[t].ai_category)}</div>
            <div style="margin-top:3px">${nf(d.value[0], 1)} · score ${nf(d.value[1], 2)} · $${nf(d.value[2], 0)}B</div>`
        },
      },
      xAxis: {
        type: 'value' as const,
        name: scatter === 'pe' ? 'Forward P/E' : scatter === 'growth' ? 'Revenue growth' : 'Market cap ($B)',
        nameLocation: 'middle' as const,
        nameGap: 22,
        nameTextStyle: { color: C.dim, fontSize: 10 },
        scale: true,
        axisLine: { lineStyle: { color: C.hairline } },
        axisTick: { show: false },
        axisLabel: {
          color: C.dim,
          fontFamily: '"JetBrains Mono Variable", monospace',
          fontSize: 10,
          formatter: (v: number) => (scatter === 'mcap' ? `$${v}B` : scatter === 'growth' ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(0)}x`),
        },
        splitLine: { lineStyle: { color: C.hairline, opacity: 0.5 } },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Composite score',
        nameLocation: 'middle' as const,
        nameGap: 34,
        nameTextStyle: { color: C.dim, fontSize: 10 },
        scale: true,
        axisLine: { lineStyle: { color: C.hairline } },
        axisTick: { show: false },
        axisLabel: { color: C.dim, fontFamily: '"JetBrains Mono Variable", monospace', fontSize: 10, formatter: (v: number) => v.toFixed(2) },
        splitLine: { lineStyle: { color: C.hairline, opacity: 0.5 } },
      },
      series: [
        {
          type: 'scatter' as const,
          data: rows.map((f) => ({
            name: f.ticker,
            value: [
              f[xKey as keyof FundamentalRow] as number,
              f.composite_score,
              f.market_cap_bn,
            ] as [number, number, number],
          })),
          symbolSize: (d: unknown) => {
            // Market caps span ~$150bn-$3.8tn; sqrt keeps the size readable
            // instead of producing 170px blobs that merge together.
            const v = ((d as { value?: number[] }).value ?? [])[2] ?? 0
            return 6 + Math.sqrt(Math.max(v, 0)) * 0.36
          },
          itemStyle: {
            color: (p: unknown) => {
              // The data key is `name` (see the `data` map above) — reading
              // `data.t` here returns undefined and takes down the chart.
              const t = ((p as { data: { name: string } }).data).name
              return catColor(TICKER_META[t]?.ai_category ?? '')
            },
            opacity: 0.9,
            borderColor: C.canvas,
            borderWidth: 1.2,
          },
          emphasis: { itemStyle: { opacity: 1, borderColor: C.hi, borderWidth: 1.5 } },
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, scatter])

  const catCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of TICKERS) {
      const c = TICKER_META[t].ai_category
      m.set(c, (m.get(c) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [])

  const stats = useMemo(() => {
    const cs = fundamentals.constituents
    return {
      medCap: [...cs].sort((a, b) => a.market_cap_bn - b.market_cap_bn)[Math.floor(cs.length / 2)].market_cap_bn,
      medPe: [...cs].sort((a, b) => a.fwd_pe - b.fwd_pe)[Math.floor(cs.length / 2)].fwd_pe,
      aiAvg: cs.reduce((s, f) => s + f.ai_revenue_exposure, 0) / cs.length,
      capexAvg: cs.reduce((s, f) => s + f.aicapex_exposure, 0) / cs.length,
    }
  }, [])

  return (
    <Page
      title="AI Universe"
      lede={
        <>
          Stage-A structural screen (Nasdaq listing, US domicile, material AI exposure, disclosure
          and liquidity) followed by Stage-B quantitative ranking across ten documented factors. No
          subjective adjustment is applied to the composite.
        </>
      }
      toolbar={
        <Segmented
          value={scatter}
          onChange={setScatter}
          options={[
            { value: 'pe', label: 'Valuation' },
            { value: 'growth', label: 'Growth' },
            { value: 'mcap', label: 'Size' },
          ]}
        />
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTileInPanel label="Constituents" value={TICKERS.length} sub="locked" />
          <StatTileInPanel label="Median market cap" value={bn(stats.medCap)} />
          <StatTileInPanel label="Median fwd P/E" value={nf(stats.medPe, 1)} sub="x" />
          <StatTileInPanel label="Mean AI exposure" value={pct(stats.aiAvg, 0)} />
          <StatTileInPanel label="Mean capex exposure" value={pct(stats.capexAvg, 0)} />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel
            title="Factor matrix"
            subtitle="Click any row to drill into Stock Intelligence · click a header to sort"
            actions={<Badge tone="warn">scores synthetic</Badge>}
            pad={false}
          >
            <div className="max-h-[560px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-9 text-center">#</th>
                    {SortTh('ticker', 'Ticker')}
                    <th>AI category</th>
                    {SortTh('composite_score', 'Score')}
                    {SortTh('ai_revenue_exposure', 'AI exp')}
                    {SortTh('revenue_growth', 'Rev gr')}
                    {SortTh('fcf_quality', 'FCF q')}
                    {SortTh('fwd_pe', 'Fwd P/E')}
                    {SortTh('aicapex_exposure', 'Capex')}
                    {SortTh('earnings_revisions', 'EPS rev')}
                    {SortTh('momentum_12_1', 'Mom 12-1')}
                    {SortTh('vol_3m', 'Vol 3m')}
                    {SortTh('avg_corr', 'Corr')}
                    <th className="text-right">Mkt cap</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f) => (
                    <tr
                      key={f.ticker}
                      tabIndex={0}
                      onClick={() => selectTicker(f.ticker)}
                      onKeyDown={(e) => e.key === 'Enter' && selectTicker(f.ticker)}
                      data-selected={f.ticker === ticker}
                      className="rowfocus cursor-pointer"
                    >
                      <td className="text-center font-mono tnum text-fg-mute">{f.rank}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-[7px] w-[2px] shrink-0 rounded-full"
                            style={{ background: catColor(f.ai_category) }}
                            aria-hidden
                          />
                          <span className="font-mono text-[12px] font-semibold text-fg-hi">
                            {f.ticker}
                          </span>
                          {market.start_idx[f.ticker] > 0 && (
                            <span title={`History from ${historyStart(f.ticker)}`} className="font-mono text-3xs text-sig-warn">
                              IPO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[168px] truncate text-2xs text-fg-dim">
                        {humanise(f.ai_category)}
                      </td>
                      <td className="num">
                        <span className={f.composite_score >= 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                          {f.composite_score >= 0 ? '+' : ''}
                          {f.composite_score.toFixed(3)}
                        </span>
                      </td>
                      <td className="num">{pct(f.ai_revenue_exposure, 0)}</td>
                      <td className="num">
                        <Delta>{pctSigned(f.revenue_growth * 100, 1)}</Delta>
                      </td>
                      <td className="num">{nf(f.fcf_quality, 2)}</td>
                      <td className="num text-fg-dim">{nf(f.fwd_pe, 1)}</td>
                      <td className="num">{pct(f.aicapex_exposure, 0)}</td>
                      <td className="num">
                        <Delta>{f.earnings_revisions >= 0 ? '+' : ''}{nf(f.earnings_revisions, 2)}</Delta>
                      </td>
                      <td className="num">
                        <Delta>{pctSigned(f.momentum_12_1 * 100, 1)}</Delta>
                      </td>
                      <td className="num text-fg-dim">{pct(f.vol_3m, 0)}</td>
                      <td className="num text-fg-dim">{nf(f.avg_corr, 2)}</td>
                      <td className="num">{bn(f.market_cap_bn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel title="Score vs factor" subtitle="Bubble area = market cap · colour = AI category" className="flex-1">
              <EChart option={scatterOption} height={252} />
            </Panel>

            <Panel title="Value-chain coverage" subtitle="Constituents per AI layer">
              <div className="space-y-1.5">
                {catCounts.map(([cat, n]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span
                      className="h-[7px] w-[2px] shrink-0 rounded-full"
                      style={{ background: catColor(cat) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-2xs text-fg-dim">
                      {humanise(cat)}
                    </span>
                    <span className="font-mono tnum text-2xs text-fg-hi">{n}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
                Coverage is a construction criterion, not a ranking input — no layer is weighted
                preferentially in the composite.
              </p>
            </Panel>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Factor definitions" subtitle="Weights are frozen; signs are inverted where lower is better">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Unit</th>
                    <th className="text-right">Weight</th>
                    <th className="w-[150px]">Contribution spread</th>
                  </tr>
                </thead>
                <tbody>
                  {fundamentals.factor_defs.map((d) => {
                    const vals = fundamentals.constituents.map(
                      (f) => f.factor_contributions[d.key] ?? 0,
                    )
                    const spread = Math.max(...vals.map(Math.abs))
                    return (
                      <tr key={d.key}>
                        <td className="text-fg-hi">{d.label}</td>
                        <td className="font-mono text-2xs text-fg-mute">{d.unit}</td>
                        <td className="num">
                          <span className={d.weight >= 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                            {d.weight >= 0 ? '+' : ''}
                            {d.weight.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <MiniBar value={spread} max={spread || 1} tone="info" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Disclosure summary="Standardisation method">
              <p className="text-2xs leading-relaxed text-fg-dim">
                {fundamentals.method} Each factor is converted to a within-universe rank in [0, 1],
                mapped linearly to [-1, +1], multiplied by its weight, and summed. No z-score is
                computed against an external reference set, so the ranking is stable under changes
                to the universe's composition.
              </p>
            </Disclosure>
          </Panel>

          <div className="flex flex-col gap-3">
            <Panel title="Exclusions & history truncation" subtitle="Documented, never silently dropped">
              <div className="space-y-2">
                {universe.exclusions.map((e) => (
                  <div key={e.ticker} className="flex items-start gap-2.5">
                    <Badge tone="neg">{e.ticker}</Badge>
                    <p className="min-w-0 flex-1 text-2xs leading-relaxed text-fg-dim">{e.reason}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 border-t border-ink-700 pt-2.5">
                {TRUNCATED.map((t) => (
                  <div key={t.ticker} className="flex items-start gap-2.5">
                    <Badge tone="warn">{t.ticker}</Badge>
                    <p className="min-w-0 flex-1 text-2xs leading-relaxed text-fg-dim">
                      Tradable history begins {t.start}. No synthetic pre-listing observations are
                      created; the name is excluded from the portfolio while untradable.
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Verification" subtitle="Phase 0 · exchange and domicile screens">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Eyebrow>Listing screen</Eyebrow>
                  <p className="mt-1 text-2xs leading-relaxed text-fg-dim">
                    Every constituent confirmed on its official Nasdaq market-activity page.
                  </p>
                </div>
                <div>
                  <Eyebrow>Domicile screen</Eyebrow>
                  <p className="mt-1 text-2xs leading-relaxed text-fg-dim">
                    US-domiciled operating companies. MRVL, AVGO and DDOG redomiciled at dates
                    recorded in the decision ledger.
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-ink-700 pt-2 font-mono text-3xs text-fg-mute">
                Universe v{universe.universe_version} · frozen {universe.verified_at} · as of{' '}
                {RESEARCH_END}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </Page>
  )
}

function StatTileInPanel({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded border border-ink-700 bg-ink-850 px-4 py-3">
      <div className="truncate text-3xs font-medium uppercase tracking-[0.1em] text-fg-dim">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono tnum text-xl leading-none tracking-tight text-fg-hi">{value}</span>
        {sub && <span className="font-mono text-2xs text-fg-mute">{sub}</span>}
      </div>
    </div>
  )
}
