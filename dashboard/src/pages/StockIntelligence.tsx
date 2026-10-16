import { useMemo, useState } from 'react'
import { Page, Segmented } from '@/components/ui/Page'
import { Panel, Eyebrow } from '@/components/ui/Panel'
import { Value, Badge, MiniBar, NotComputed } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { Sparkline, drawdownSeries, ContributionBar } from '@/components/charts/primitives'
import { timeSeriesOption, drawdownOption } from '@/lib/chartopts'
import { C, SERIES_COLOR } from '@/lib/palette'
import {
  market,
  FUND,
  TICKER_META,
  TICKERS,
  risk,
  portfolio,
  seriesFor,
  historyStart,
} from '@/lib/data'
import { fundamentalFactorsPending, fundamentalsStatus, marketIsReal, riskBookIsPlaceholder, riskIsReal } from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { nf, nfInt, pct, pctSigned, ratioSigned, humanise, bn, money } from '@/lib/format'

type Range = '3m' | '1y' | '3y' | 'all'

const RANGE_DAYS: Record<Range, number> = { '3m': 63, '1y': 252, '3y': 756, all: 99999 }
const RANGE_YEARS: Record<Range, number> = { '3m': 63 / 252, '1y': 1, '3y': 3, all: 6.72 }

export function StockIntelligence() {
  const { ticker, selectTicker, navigate } = useApp()
  const [range, setRange] = useState<Range>('3y')
  const [cmp, setCmp] = useState<'QQQ' | 'SOXX' | 'SPY'>('QQQ')
  const [view, setView] = useState<'price' | 'drawdown'>('price')

  const meta = TICKER_META[ticker]
  const f = FUND[ticker]
  const r = risk.per_ticker[ticker]

  const full = useMemo(() => seriesFor(ticker), [ticker])

  const { dates, px, bench } = useMemo(() => {
    const all = market.dates
    const n = RANGE_DAYS[range]
    const from = Math.max(market.start_idx[ticker], all.length - n)
    const d = all.slice(from)
    const p = full.slice(from).map((v) => (v === null ? null : v / (full[from] as number)))
    const bIdx = market.start_idx[cmp] ?? 0
    const bRaw = market.benchmarks[cmp].levels
    const b = all.slice(from).map((_, i) => {
      const gi = from + i
      return gi >= bIdx ? bRaw[gi - bIdx] / bRaw[from - bIdx] : null
    })
    return { dates: d, px: p, bench: b }
  }, [full, ticker, range, cmp])

  const years = RANGE_YEARS[range]

  const perf = useMemo(() => {
    const clean = px.filter((v): v is number => v !== null)
    if (clean.length < 2) return null
    const total = clean[clean.length - 1] / clean[0] - 1
    const rets = clean.slice(1).map((v, i) => Math.log(v / clean[i]))
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length
    const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(rets.length - 1, 1))
    const vol = sd * Math.sqrt(252)
    let peak = -Infinity
    let mdd = 0
    for (const v of clean) {
      if (v > peak) peak = v
      mdd = Math.min(mdd, v / peak - 1)
    }
    const cagr = (1 + total) ** (1 / years) - 1
    return {
      total,
      cagr,
      vol,
      sharpe: vol > 0 ? cagr / vol : 0,
      mdd,
      rel: total - (bench.filter((v): v is number => v !== null).slice(-1)[0] / bench.filter((v): v is number => v !== null)[0] - 1),
    }
  }, [px, bench, years])

  const priceOption = useMemo(
    () =>
      timeSeriesOption(
        dates,
        [
          { key: 'STOCK', label: ticker, values: px, color: C.pos, width: 2.1, area: true },
          { key: cmp, label: cmp, values: bench, color: SERIES_COLOR[cmp], width: 1.3, dashed: true },
        ],
        { yFormat: (v) => `${((v - 1) * 100).toFixed(0)}%`, zoom: true },
      ),
    [dates, px, bench, ticker, cmp],
  )

  const ddOption = useMemo(
    () => drawdownOption(dates, drawdownSeries(px.filter((v): v is number => v !== null))),
    [dates, px],
  )

  const contributions = useMemo(() => {
    const fc = f.factor_contributions ?? {}
    const keys = Object.keys(fc)
    return keys
      .map((k) => ({ key: k, label: k.replace(/_/g, ' '), v: fc[k] }))
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  }, [f])

  const weight = portfolio.weights[ticker] ?? 0

  return (
    <Page
      title={`${ticker} · ${meta.company}`}
      lede={
        <>
          <span className="text-fg-base">{humanise(meta.ai_category)}</span> · {meta.security_class}{' '}
          · {meta.exchange} · history from {historyStart(ticker)}
        </>
      }
      toolbar={
        <>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '3m', label: '3M' },
              { value: '1y', label: '1Y' },
              { value: '3y', label: '3Y' },
              { value: 'all', label: 'All' },
            ]}
          />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'price', label: 'Rel. price' },
              { value: 'drawdown', label: 'Drawdown' },
            ]}
          />
        </>
      }
    >
      <div className="space-y-3">
        {/* Identity strip */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Panel title="Identity" subtitle="Verified Phase-0 fields">
            <div className="space-y-2.5">
              {(
                [
                  ['Security class', meta.security_class],
                  ['Exchange', meta.exchange],
                  ['AI category', humanise(meta.ai_category)],
                  ['Domicile', meta.domicile_detail],
                  ['Universe', `v${meta.universe_version}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <Eyebrow>{k}</Eyebrow>
                  <p className="mt-0.5 text-micro leading-snug text-fg-base">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-1.5 border-t border-ink-700 pt-2.5">
              <Badge tone="pos">listing ✓</Badge>
              <Badge tone="pos">US domicile ✓</Badge>
              {market.start_idx[ticker] > 0 && <Badge tone="warn">truncated</Badge>}
            </div>
          </Panel>

          <Panel
            title="AI exposure rationale"
            subtitle="Sourced, not inferred"
            actions={
              <a
                href={meta.source_urls[0]}
                target="_blank"
                rel="noreferrer"
                className="text-2xs text-fg-dim transition-colors hover:text-sig-pos"
              >
                Nasdaq ↗
              </a>
            }
          >
            <p className="text-micro leading-relaxed text-fg-base">{meta.inclusion_rationale}</p>
            <div className="mt-3 space-y-1 border-t border-ink-700 pt-2.5">
              {meta.source_urls.map((u, i) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate font-mono text-3xs text-fg-mute transition-colors hover:text-sig-pos"
                >
                  [{i + 1}] {u}
                </a>
              ))}
            </div>
          </Panel>
        </div>

        {/* Price + metrics */}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <Panel
            title={`${ticker} vs ${cmp}`}
            subtitle={
              view === 'price'
                ? `Rebased to 1.00 at ${dates[0]} · growth of 100 in the tooltip`
                : 'Drawdown from running peak'
            }
            provenance={marketIsReal ? 'real' : 'synthetic'}
            actions={
              <Segmented
                value={cmp}
                onChange={setCmp}
                options={[
                  { value: 'QQQ', label: 'QQQ' },
                  { value: 'SOXX', label: 'SOXX' },
                  { value: 'SPY', label: 'SPY' },
                ]}
              />
            }
          >
            <EChart
              option={view === 'price' ? priceOption : ddOption}
              height={272}
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ink-700 pt-2">
              <LegendItem color={C.pos} label={ticker} />
              <LegendItem color={SERIES_COLOR[cmp]} label={cmp} dashed />
              <span className="ml-auto font-mono text-3xs text-fg-mute">
                {dates[0]} → {dates[dates.length - 1]}
              </span>
            </div>
          </Panel>

          <Panel
            title="Period statistics"
            subtitle={`Trailing ${range.toUpperCase()} · ${marketIsReal ? 'computed from real adjusted prices' : 'synthetic prices'}`}
            provenance={marketIsReal ? 'real' : 'synthetic'}
          >
            {!perf ? (
              <NotComputed reason="Insufficient price history in the selected window." />
            ) : (
              <div className="space-y-2.5">
                {(
                  [
                    ['Total return', ratioSigned(perf.total, 1), perf.total],
                    ['Annualised', ratioSigned(perf.cagr, 1), perf.cagr],
                    ['Volatility', pct(perf.vol, 1), -perf.vol],
                    ['Sharpe (rf 0)', nf(perf.sharpe, 2), perf.sharpe],
                    ['Max drawdown', pct(perf.mdd, 1), perf.mdd],
                    [`Relative to ${cmp}`, ratioSigned(perf.rel, 1), perf.rel],
                  ] as const
                ).map(([k, v, val]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-2 last:border-0"
                  >
                    <span className="text-micro text-fg-dim">{k}</span>
                    <Value tone={val >= 0 ? 'pos' : 'neg'}>{v}</Value>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Factor + risk + valuation */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel
            title="Factor contributions"
            subtitle="Weighted z-score · drives composite rank"
            provenance={fundamentalFactorsPending ? 'mixed' : 'real'}
          >
            <div className="space-y-1.5">
              {contributions.map((c) => (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-2xs text-fg-dim">{c.label}</span>
                    <span className="shrink-0 font-mono tnum text-2xs text-fg-base">
                      {c.v >= 0 ? '+' : ''}
                      {c.v.toFixed(3)}
                    </span>
                  </div>
                  <ContributionBar
                    value={c.v}
                    max={Math.max(...contributions.map((x) => Math.abs(x.v))) || 1}
                    height={9}
                    className="mt-0.5"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-ink-700 pt-2.5">
              <span className="text-micro text-fg-dim">Composite</span>
              <Value tone={f.composite_score >= 0 ? 'pos' : 'neg'} size="lg">
                {f.composite_score >= 0 ? '+' : ''}
                {nf(f.composite_score, 3)}
              </Value>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-2xs text-fg-mute">Universe rank</span>
              <span className="font-mono tnum text-2xs text-fg-base">
                #{f.rank} of {TICKERS.length}
              </span>
            </div>
          </Panel>

          <Panel
            title="Fundamental snapshot"
            subtitle="Current-state, descriptive only"
            provenance={fundamentalsStatus}
          >
            <div className="space-y-2">
              {(
                [
                  ['Price', money(f.price), 'flat'],
                  ['Market cap', bn(f.market_cap_bn), 'flat'],
                  ['Forward P/E', f.fwd_pe === null || f.fwd_pe === undefined ? '—' : `${nf(f.fwd_pe, 1)}x`, 'flat'],
                  [
                    'Revenue growth',
                    f.revenue_growth === null || f.revenue_growth === undefined
                      ? '—'
                      : pctSigned(f.revenue_growth * 100, 1),
                    f.revenue_growth === null || f.revenue_growth === undefined
                      ? 'flat'
                      : f.revenue_growth >= 0
                        ? 'pos'
                        : 'neg',
                  ],
                  ['FCF quality', nf(f.fcf_quality, 2), 'flat'],
                  [
                    'EPS revision 3m',
                    f.earnings_revisions === null || f.earnings_revisions === undefined
                      ? '—'
                      : `${f.earnings_revisions >= 0 ? '+' : ''}${nf(f.earnings_revisions, 2)}`,
                    f.earnings_revisions === null || f.earnings_revisions === undefined
                      ? 'flat'
                      : f.earnings_revisions >= 0
                        ? 'pos'
                        : 'neg',
                  ],
                  ['AI revenue exposure', pct(f.ai_revenue_exposure, 0), 'flat'],
                  ['AI capex exposure', pct(f.aicapex_exposure, 0), 'flat'],
                ] as const
              ).map(([k, v, tone]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="text-micro text-fg-dim">{k}</span>
                  <span
                    className={`font-mono tnum text-micro ${
                      tone === 'pos' ? 'text-sig-pos' : tone === 'neg' ? 'text-sig-neg' : 'text-fg-hi'
                    }`}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
            {fundamentalFactorsPending ? (
              <p className="mt-3 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
                Valuation, growth, FCF and revision fields require the Phase-1 sourced dataset —
                shown as an em dash until then.
              </p>
            ) : (
              <p className="mt-3 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
                Not eligible as a historical model feature — point-in-time reconstruction is open
                (OI-0001).
              </p>
            )}
          </Panel>

          <Panel
            title="Risk profile"
            subtitle={
              riskIsReal
                ? riskBookIsPlaceholder
                  ? 'Real prices · contributions to the equal-weight book'
                  : 'Computed from real prices'
                : 'Trailing 756 trading days'
            }
            provenance={riskIsReal ? 'real' : 'synthetic'}
          >
            <div className="space-y-2">
              {(
                [
                  ['Realised vol', pct(r.vol_annual, 1)],
                  ['Beta vs QQQ', nf(r.beta_qqq, 2)],
                  ['Beta vs SOXX', nf(r.beta_soxx, 2)],
                  ['R² vs QQQ', nf(r.r2_qqq, 2)],
                  ['Avg universe corr', nf(f.avg_corr, 2)],
                  ['MCTR', nf(risk.mctr[ticker], 3)],
                  ['CCTR', nf(risk.cctr[ticker], 3)],
                  ['Observations', nfInt(r.observations)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="text-micro text-fg-dim">{k}</span>
                  <span className="font-mono tnum text-micro text-fg-hi">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-ink-700 pt-2.5">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-2xs text-fg-mute">Portfolio weight</span>
                <span className="font-mono tnum text-2xs text-fg-hi">{pct(weight, 1)}</span>
              </div>
              <MiniBar value={weight} max={0.12} tone={weight > 0 ? 'pos' : 'info'} />
              <button
                type="button"
                onClick={() => navigate('portfolio')}
                className="mt-2 w-full text-right text-2xs text-fg-dim transition-colors hover:text-sig-pos"
              >
                Optimizer view →
              </button>
            </div>
          </Panel>
        </div>

        {/* Peer strip */}
        <Panel
          title="Universe context"
          subtitle="Every name ranked · this one highlighted"
          pad={false}
          actions={
            <button
              type="button"
              onClick={() => navigate('universe')}
              className="text-2xs text-fg-dim transition-colors hover:text-sig-pos"
            >
              Full matrix →
            </button>
          }
        >
          <div className="flex gap-1 overflow-x-auto p-3">
            {[...Object.values(FUND)]
              .sort((a, b) => b.composite_score - a.composite_score)
              .map((p) => {
                const series = seriesFor(p.ticker)
                const tail = series.slice(-63).filter((v): v is number => v !== null)
                const sel = p.ticker === ticker
                return (
                  <button
                    key={p.ticker}
                    type="button"
                    onClick={() => selectTicker(p.ticker)}
                    className={
                      sel
                        ? 'flex min-w-[92px] shrink-0 flex-col items-start gap-1 rounded-sm border border-sig-pos/40 bg-sig-pos/[0.07] px-2 py-1.5'
                        : 'flex min-w-[92px] shrink-0 flex-col items-start gap-1 rounded-sm border border-ink-700 bg-ink-800 px-2 py-1.5 transition-colors hover:border-ink-650 hover:bg-ink-750'
                    }
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span
                        className={`font-mono text-[11.5px] font-semibold ${sel ? 'text-sig-pos' : 'text-fg-hi'}`}
                      >
                        {p.ticker}
                      </span>
                      <span className="font-mono text-3xs text-fg-mute">#{p.rank}</span>
                    </span>
                    <Sparkline
                      values={tail.length > 1 ? tail : [0, 0]}
                      width={72}
                      height={18}
                      tone={sel ? 'pos' : 'auto'}
                    />
                    <span className="font-mono tnum text-3xs text-fg-dim">
                      {money(p.price)}
                    </span>
                  </button>
                )
              })}
          </div>
        </Panel>
      </div>
    </Page>
  )
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-[2px] w-4 rounded-full"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
            : color,
        }}
        aria-hidden
      />
      <span className="text-2xs text-fg-dim">{label}</span>
    </span>
  )
}
