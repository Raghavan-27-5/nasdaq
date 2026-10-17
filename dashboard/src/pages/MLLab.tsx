import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Page, Segmented } from '@/components/ui/Page'
import { Panel } from '@/components/ui/Panel'
import { Value, Badge } from '@/components/ui/Value'
import { EChart } from '@/components/charts/EChart'
import { Sparkline } from '@/components/charts/primitives'
import { timeSeriesOption, rankBarOption } from '@/lib/chartopts'
import { C } from '@/lib/palette'
import { models, market } from '@/lib/data'
import { modelsAreSynthetic } from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { nf, pct, ratioSigned, signed } from '@/lib/format'

const TARGET_ORDER = [
  'return_1d',
  'return_5d',
  'return_21d',
  'vol_5d',
  'vol_21d',
  'direction_5d',
  'direction_21d',
] as const

const FEATURE_LABEL: Record<string, string> = {
  ret_1d: '1d return',
  ret_5d: '5d return',
  ret_21d: '21d return',
  ret_63d: '63d return',
  ret_126d: '126d return',
  momentum_12_1: '12-1 momentum (252d → 21d)',
  vol_21d: '21d realised volatility',
  vol_63d: '63d realised volatility',
  dist_52w_high: 'Distance from 52w high',
  sma_20_50: 'SMA20 / SMA50 − 1',
  sma_50_200: 'SMA50 / SMA200 − 1',
  rsi_14: 'RSI(14), centred on 50',
  macd_hist: 'MACD histogram / price',
  vol_ratio_21: 'Volume / SMA21(volume) − 1',
  ret_21d_rel: '21d return − QQQ 21d',
  beta_63d: 'Beta vs QQQ (63d)',
  cs_rank_mom: 'Cross-sectional rank · 12-1 momentum',
  cs_rank_vol21: 'Cross-sectional rank · 21d vol',
}

export function MLLab() {
  const { navigate } = useApp()
  const [target, setTarget] = useState<string>('return_21d')
  const [icView, setIcView] = useState<'series' | 'decay' | 'quantile'>('series')

  const t = models.targets[target]

  // Real bundles carry exact per-date IC dates; fixture bundles fall back to
  // the old weekly-indexed approximation from the OOS start.
  const dailyIc = Array.isArray(t.ic_dates) && t.ic_dates.length === t.ic_series.length
  const icDates = useMemo(() => {
    if (dailyIc) return t.ic_dates as string[]
    const start = market.dates.findIndex((d) => d >= t.oos_start)
    return t.ic_series.map((_, i) => market.dates[Math.min(start + i * 5, market.dates.length - 1)])
  }, [t, dailyIc])

  const icOption = useMemo(
    () =>
      timeSeriesOption(
        icDates,
        [
          {
            key: 'IC',
            label: `Spearman IC (${dailyIc ? 'daily' : 'weekly'})`,
            values: t.ic_series,
            color: C.pos,
            width: 1.2,
          },
        ],
        {
          yFormat: (v) => v.toFixed(3),
          legend: false,
          markers: [{ label: '', index: 0 }],
        },
      ),
    [icDates, t],
  )

  const decayOption = useMemo(
    () =>
      timeSeriesOption(
        t.decay.map((d) => `${d.horizon}d`),
        [
          {
            key: 'IC',
            label: 'IC by horizon',
            values: t.decay.map((d) => d.ic),
            color: C.info,
            width: 2,
            area: true,
          },
        ],
        { yFormat: (v) => v.toFixed(3), legend: false },
      ),
    [t],
  )

  const qMetric = t.target.startsWith('vol')
    ? 'Mean forward realised vol'
    : t.target.startsWith('direction')
      ? 'Mean forward P(up)'
      : 'Mean forward return'
  const qv = t.quantiles.mean_forward_return
  const qSpread = qv.length > 1 ? qv[qv.length - 1] - qv[0] : 0
  const qSteps = Math.max(qv.length - 1, 0)
  const qStepsUp = qv.reduce((n, v, i) => (i > 0 && v >= qv[i - 1] - 1e-9 ? n + 1 : n), 0)
  const qLast = t.quantiles.labels[t.quantiles.labels.length - 1] ?? 'top'
  const qFirst = t.quantiles.labels[0] ?? 'bottom'

  const quantileOption = useMemo(
    () =>
      timeSeriesOption(
        t.quantiles.labels,
        [
          {
            key: 'Q',
            label: qMetric,
            values: t.quantiles.mean_forward_return,
            color: C.pos,
            width: 2,
          },
        ],
        { yFormat: (v) => `${(v * 100).toFixed(1)}%`, legend: false },
      ),
    [t],
  )

  const fiOption = useMemo(
    () =>
      rankBarOption(
        Object.entries(t.feature_importance).map(([k, v]) => ({
          label: FEATURE_LABEL[k] ?? k,
          value: v,
          sub: `raw: ${k}`,
        })),
        { valueFormat: (v) => v.toFixed(3), signed: false, color: C.cyan },
      ),
    [t],
  )

  const hp = t.hyperparameters

  return (
    <Page
      title="ML Lab"
      lede={
        <>
          Separate LightGBM per target, expanding walk-forward, labels purged and embargoed —
          no observation contributes to both sides of a split.
        </>
      }
      toolbar={
        <Segmented
          value={target}
          onChange={setTarget}
          options={TARGET_ORDER.map((k) => ({
            value: k,
            label: models.targets[k].label.replace(' Forward', '').replace(' Realised', ''),
          }))}
        />
      }
    >
      <div className="space-y-3">
        {/* Target strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {TARGET_ORDER.map((k) => {
            const m = models.targets[k]
            const active = k === target
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTarget(k)}
                className={
                  active
                    ? 'rounded border border-sig-pos/40 bg-sig-pos/[0.07] px-3 py-2 text-left'
                    : 'rounded border border-ink-700 bg-ink-850 px-3 py-2 text-left transition-colors hover:border-ink-650 hover:bg-ink-800'
                }
              >
                <div
                  className={clsx(
                    'truncate text-3xs font-medium uppercase tracking-[0.08em]',
                    active ? 'text-sig-pos' : 'text-fg-dim',
                  )}
                >
                  {k.replace(/_/g, ' ')}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono tnum text-[15px] text-fg-hi">
                    {nf(m.icir, 2)}
                  </span>
                  <span className="text-3xs text-fg-mute">ICIR</span>
                </div>
                <Sparkline
                  values={m.ic_series.length > 1 ? downsample(m.ic_series, 40) : [0, 0]}
                  width={70}
                  height={14}
                  tone={m.oos_ic_mean >= 0 ? 'pos' : 'neg'}
                />
              </button>
            )
          })}
        </div>

        {/* Headline metrics */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {(
              [
                ['Mean IC', nf(t.oos_ic_mean, 4), t.oos_ic_mean > 0, undefined],
                ['IC std', nf(t.oos_ic_std, 4), false, undefined],
                ['ICIR', nf(t.icir, 3), t.icir > 0.3, 'unannualised'],
                [
                  'Hit rate',
                  pct(t.hit_rate, 1),
                  t.hit_rate > (t.hit_rate_base ?? 0.5),
                  t.hit_rate_base != null ? `base ${pct(t.hit_rate_base, 1)}` : undefined,
                ],
                ['OOS R²', nf(t.r2, 4), false, undefined],
                ['OOS rows', nfInt(t.n_oos_rows), false, undefined],
              ] as const
            ).map(([label, value, good, sub]) => (
              <div key={label} className="rounded border border-ink-700 bg-ink-850 px-4 py-3">
                <div className="truncate text-3xs font-medium uppercase tracking-[0.1em] text-fg-dim">
                  {label}
                </div>
                <div className="mt-1.5">
                  <Value size="lg" tone={good ? 'pos' : 'flat'}>
                    {value}
                  </Value>
                  {sub && <div className="mt-0.5 text-3xs text-fg-mute">{sub}</div>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-3xs leading-relaxed text-fg-mute">
            Cross-sectional Spearman IC per out-of-sample date; ICIR is the unannualised mean IC ÷
            IC std. Hit-rate base = positive-class frequency of the same rows (vol targets: median
            split ⇒ 0.50) — a sign rate at or below base is not skill.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Panel
            title="Signal diagnostics"
            subtitle={
              icView === 'series'
                ? `${dailyIc ? 'Daily' : 'Weekly'} out-of-sample Spearman IC · ${t.oos_start} → ${t.oos_end}`
                : icView === 'decay'
                  ? 'IC decay across forward horizons (1/5/21d return labels)'
                  : `Monotonicity across prediction ${t.quantiles.labels.length >= 10 ? 'deciles' : 'quantiles'}`
            }
            actions={
              <Segmented
                value={icView}
                onChange={setIcView}
                options={[
                  { value: 'series', label: 'IC series' },
                  { value: 'decay', label: 'Decay' },
                  { value: 'quantile', label: 'Quantiles' },
                ]}
              />
            }
          >
            <EChart
              option={icView === 'series' ? icOption : icView === 'decay' ? decayOption : quantileOption}
              height={244}
            />
            {icView === 'quantile' && (
              <div className="mt-2 border-t border-ink-700 pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-3xs text-fg-mute">Monotonicity</span>
                  <Badge tone={qStepsUp === qSteps ? 'pos' : 'warn'}>
                    {qStepsUp === qSteps ? 'holds' : `${qStepsUp}/${qSteps} steps up`}
                  </Badge>
                  <span className="ml-auto font-mono text-3xs text-fg-mute">
                    {qLast} − {qFirst} spread {ratioSigned(qSpread, 2)}
                  </span>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Feature importance"
            subtitle={`Gain-based split importance${modelsAreSynthetic ? ' · synthetic' : ''}`}
          >
            <EChart option={fiOption} height={244} />
            <p className="mt-1.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
              Recent returns and realised volatility dominate gain importance on every target. That
              is expected — and is exactly why the adversarial checklist asks whether the model is
              doing anything other than restating momentum and volatility.
            </p>
          </Panel>
        </div>

        {/* Walk-forward folds */}
        <Panel
          title="Walk-forward folds"
          subtitle="Expanding training window · purged and embargoed · OOS test never used for tuning"
          pad={false}
          actions={
            modelsAreSynthetic ? (
              <Badge tone="warn" title="Model outputs are a synthetic fixture until the Phase 6/7 walk-forward training run lands.">
                synthetic
              </Badge>
            ) : (
              <Badge tone="pos">real</Badge>
            )
          }
        >
          <div className="max-h-[300px] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="text-center">Fold</th>
                  <th>Train</th>
                  <th>Validation</th>
                  <th>Test (OOS)</th>
                  <th className="text-right">Train n</th>
                  <th className="text-right">Purge</th>
                  <th className="text-right">Embargo</th>
                  <th className="text-right">Best iter</th>
                  <th className="text-right">OOS IC</th>
                  <th className="text-right">OOS R²</th>
                </tr>
              </thead>
              <tbody>
                {t.folds.map((f) => (
                  <tr key={f.fold}>
                    <td className="text-center font-mono tnum text-fg-dim">{f.fold}</td>
                    <td className="font-mono text-2xs text-fg-dim">
                      {f.train_start} → {f.train_end}
                    </td>
                    <td className="font-mono text-2xs text-fg-dim">
                      {f.val_start} → {f.val_end}
                    </td>
                    <td className="font-mono text-2xs text-fg-hi">
                      {f.test_start} → {f.test_end}
                    </td>
                    <td className="num text-fg-dim">{nfInt(f.n_train)}</td>
                    <td className="num text-sig-warn">{f.purge_days}d</td>
                    <td className="num text-sig-warn">{f.embargo_days}d</td>
                    <td className="num text-fg-dim">{f.best_iter}</td>
                    <td className="num">
                      <span className={f.oos_ic > 0 ? 'text-sig-pos' : 'text-sig-neg'}>
                        {signed(f.oos_ic, 4)}
                      </span>
                    </td>
                    <td className="num text-fg-dim">{nf(f.oos_r2, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Hyperparameters" subtitle="Selected on validation folds only">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(hp).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-ink-700/50 pb-1">
                  <dt className="truncate font-mono text-2xs text-fg-dim">{k}</dt>
                  <dd className="shrink-0 font-mono tnum text-2xs text-fg-hi">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Configuration" subtitle="Versioned lineage">
            <dl className="space-y-1.5">
              {(
                [
                  ['Target', t.target],
                  ['Objective', t.objective],
                  ['Horizon', `${t.horizon_days} trading days`],
                  ['Model version', models.model_version ?? '—'],
                  ['Engine', models.engine ?? '—'],
                  ['Feature version', models.feature_version],
                  ['Target version', models.target_version],
                  ['Universe version', models.universe_version],
                  ['OOS window', `${t.oos_start} → ${t.oos_end}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-micro text-fg-dim">{k}</dt>
                  <dd className="font-mono text-2xs text-fg-hi">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 border-t border-ink-700 pt-2 text-2xs leading-relaxed text-fg-mute">
              {models.validation}
            </p>
          </Panel>

          <Panel title="Adversarial checks" subtitle="The questions that decide whether the signal is real">
            <ul className="space-y-1.5">
              {[
                ['Learning momentum only?', 'Partly — short-horizon returns and realised vol dominate gain importance; no ablation run yet.'],
                ['Learning semi beta only?', 'No — features_v003 contains no SOXX inputs (QQQ beta only).'],
                ['Signal survives costs?', 'Not tested — the net-of-cost test arrives with the Phase 10 backtest (OI-0003).'],
                ['Survives 2022?', 'No return/direction edge in any year; volatility IC positive every year.'],
                ['Driven by one name?', 'Not yet tested — concentration screen is OPEN.'],
                ['Feature ablation run?', 'OPEN — recorded in the audit page.'],
              ].map(([q, a]) => (
                <li key={q} className="border-b border-ink-700/50 pb-1.5 last:border-0">
                  <div className="text-2xs font-medium text-fg-base">{q}</div>
                  <div className="text-2xs text-fg-mute">{a}</div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => navigate('backtest')}
              className="mt-2.5 w-full rounded-sm border border-ink-700 py-1 text-2xs text-fg-dim transition-colors hover:border-ink-650 hover:text-fg-base"
            >
              Cost & regime tests (Phase 10) →
            </button>
          </Panel>
        </div>
      </div>
    </Page>
  )
}

const nfInt = (v: number) => Math.round(v).toLocaleString('en-US')

function downsample(a: number[], n: number): number[] {
  if (a.length <= n) return a
  const step = a.length / n
  return Array.from({ length: n }, (_, i) => a[Math.floor(i * step)])
}
