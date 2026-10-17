import { useState } from 'react'
import clsx from 'clsx'
import { Page, Segmented } from '@/components/ui/Page'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Value'
import {
  backtest,
  manifest,
  market,
  models,
  portfolio,
  universe,
  TICKERS,
  TRUNCATED,
  historyStart,
  RESEARCH_START,
  RESEARCH_END,
} from '@/lib/data'
import {
  dataMode,
  ledgerStatus,
  modelsAreSynthetic,
  pendingSurfaces,
  realSurfaces,
  riskIsReal,
  syntheticSurfaces,
} from '@/lib/provenance'
import { useApp } from '@/lib/store'
import { humanise, fmtDate, nfInt } from '@/lib/format'

// Decision ledger and open issues transcribed from PHASE_LOG.md. These are
// REAL project records, not fixtures.
const DECISIONS = [
  ['D0001', '2026-09-25', '0A', 'Local laptop is control plane only; Colab is compute plane', 'User task specification', 'LOCKED'],
  ['D0002', '2026-09-25', '0A', 'Google Drive is canonical durable artifact store', 'User task specification', 'LOCKED'],
  ['D0003', '2026-09-25', '0A', 'Parquet is default analytical storage format', 'Project architecture', 'LOCKED'],
  ['D0004', '2026-09-25', '0A', 'Historical window frozen at 2020-01-01 through 2026-09-22 EOD', 'Project specification', 'LOCKED'],
  ['D0005', '2026-09-25', '0', 'SNOW excluded because NYSE-listed', 'Nasdaq official market listing evidence', 'LOCKED'],
  ['D0006', '2026-09-25', '0', 'ARM excluded because UK-domiciled foreign issuer', 'SEC EDGAR CIK 0001973239', 'LOCKED'],
  ['D0007', '2026-09-25', '0', '20-name universe verified: all Nasdaq-listed, US-domiciled, AI-categorised', 'universe_verification_v001.json · 131/131 tests passed', 'LOCKED'],
  ['D0008', '2026-09-25', '0', 'Universe version 0.1.0 frozen', 'validate_universe.py exit 0', 'LOCKED'],
  ['D0009', '2026-09-25', '0', 'MSFT incorporated in Washington; valid US domicile', 'SEC filing / company IR', 'NOTED'],
  ['D0010', '2026-09-25', '0', 'MRVL redomiciled Bermuda → Delaware, April 2021', 'SEC EDGAR CIK 1835632', 'NOTED'],
  ['D0011', '2026-09-25', '0', 'DDOG redomiciled Delaware → Nevada, April 2026', 'SEC filing / investor relations', 'NOTED'],
  ['D0012', '2026-09-25', '0', 'AVGO redomiciled Singapore → Delaware, April 2018', 'Certificate of Incorporation', 'NOTED'],
  ['D0013', '2026-09-25', '0', 'PLTR transferred NYSE → Nasdaq, November 2022', 'Nasdaq official page', 'NOTED'],
  ['D0014', '2026-10-10', '11', 'Dashboard built as React/Vite/TS SPA rather than Streamlit + Plotly', 'CONTEXT.md permits documented deviation; terminal visual quality', 'LOCKED'],
  ['D0015', '2026-10-10', '11', 'Dashboard renders synthetic fixtures until Phase 3–10 artifacts land', 'gen_demo_data.py seed 20260925; every artifact flagged synthetic: true', 'NOTED'],
  ['D0016', '2026-10-10', '11', 'Synthetic market data is internally consistent by construction, not hand-authored', 'Correlations/betas/vol/drawdowns computed from generated series', 'NOTED'],
  ['D0017', '2026-10-16', '3', 'Acquisition notebook corrected as v002 (VaR/ES fix, real Ledoit-Wolf, realised stress, corporate actions)', 'build_notebook.py; offline dry run 103/103 checks green', 'LOCKED'],
  ['D0018', '2026-10-16', '11', 'Dashboard provenance is fully artifact-driven — no hardcoded synthetic badges', 'lib/provenance.ts; ledger REAL/SYNTHETIC/PENDING vocabulary', 'LOCKED'],
  ['D0019', '2026-10-16', '3/11', 'Canonical 12-row provenance ledger is a shared contract: notebook ⇄ gen_demo_data.py', 'identical surface keys/order; dry-run parity check', 'LOCKED'],
  ['D0020', '2026-10-16', '11', 'gen_demo_data.py never overwrites synthetic:false artifacts; --force = full fixture reset', 'real-artifact guard + manifest merge; partial-real tree tested', 'LOCKED'],
  ['D0021', '2026-10-16', '3/11', 'Pre-Phase-9 risk stats describe the equal-weight reference book, not a fitted portfolio', 'portfolio_basis: equal_weight_placeholder + reference_weights', 'NOTED'],
  ['D0022', '2026-10-16', '3', 'Stooq proof-of-work solver disabled; Yahoo remains the designated source', 'ALLOW_STOOQ_POW=False in acquisition notebook', 'LOCKED'],
  ['D0023', '2026-10-16', '3', 'Offline dry-run harness is the pre-flight gate for any live Colab acquisition run', 'dry_run_notebook.py — executes all cells, audits bundle contract', 'LOCKED'],
  ['D0024', '2026-10-16', '3', 'First real acquisition executed (live mode): fixed normalise() tz-alignment frame loss + yfinance corporate-action capture; 23/23 series, 320 actions, 0 failures', 'validation PASS 26 checks; audit 103/103; bundle installed to dashboard (partial-real)', 'LOCKED'],
  ['D0025', '2026-10-16', '11', 'Acquisition bundle committed to the public repo — GitHub Pages renders real data; CI regenerates only fixture surfaces via the synthetic:false guard', 'dashboard/src/data no longer gitignored; owner-approved (public EOD prices)', 'LOCKED'],
  ['D0026', '2026-10-16', '3', 'End-to-end QA audit: six confirmed defects fixed (factor z-rank inversion, 12-1 momentum, Sharpe definition, worst_30d rolling-mean, truncated-name CAGR, chart copy); shipped via --from-parquet reprocess of the frozen acquisition; run_context recorded in manifests', 'docs/QA_REVIEW_2026-10-16.md; dry 123/123; reprocess 119/119', 'LOCKED'],
  ['D0027', '2026-10-16', '3/11', 'Round-2 visual QA: 18 findings fixed. Strategy stats moved out-of-sample (ML CAGR 28.4% → 20.18%, Sharpe 0.645, maxDD −36.68%); fixture projection repaired (NVDA binds the 12% cap; 2 binding · 10 slack); caps unified 34/34/34; manifest flavour convergence; UI fixes across all pages; bundle reprocessed and fully re-shot', 'docs/QA_REVIEW_2026-10-16.md §6.1; dry 123/123; reprocess 119/119', 'LOCKED'],
  ['D0028', '2026-10-17', '11', 'Owner QA round: brand renamed NASDAQ AI EQUITIES PORTFOLIO; audit-mode toggle removed (overlay mislabeled real panels as SIM); delta-chip arrow defect fixed (positive = ▲); Command-Center ranking dead space root-caused (fixed max-height cap in a stretched panel — now fills the body); AI-Universe header metrics + Stock-Intelligence snapshot panel filled from a current-state snapshot (Yahoo market cap + fwd P/E; manual exposure estimates; descriptive-only, never used in predictive computation)', 'docs/QA_REVIEW_2026-10-16.md §6.2; re-shoot verification; current_snapshot.json', 'LOCKED'],
  ['D0029', '2026-10-17', '5/6', 'Phase 5/6 training pipeline built and rehearsed offline (24/24 checks): feature/target factories, purged walk-forward, pre-registered artifact names', 'build_train_notebook.py · dry_run_train.py · D0029', 'LOCKED'],
  ['D0030', '2026-10-17', '5/6', 'First real walk-forward ML run executed in Colab — 24/24 checks, SHA-256 verified: volatility targets strongly predictable (vol_21d IC +0.52 / ICIR 1.94); return and direction targets show no OOS edge (IC ≈ 0, mildly negative R²) — honest null recorded', 'training_report_v001.json · PHASE_LOG D0030', 'LOCKED'],
] as const

const OPEN_ISSUES = [
  ['OI-0001', 'Historical point-in-time fundamentals', 'OPEN',
    'Determine which fundamental fields can be reconstructed with valid information-available dates. Current values must not be backfilled into the 2020–2026 predictive dataset.'],
  ['OI-0002', 'Benchmark / factor source', 'OPEN',
    'Finalise historical factor-data sources for QQQ, SOXX, SPY and any additional factor model used in alpha attribution.'],
  ['OI-0003', 'Exact transaction-cost model', 'OPEN',
    '10 bps round-trip is a required robustness test, but the baseline execution/cost model must be specified before portfolio backtesting.'],
  ['OI-0004', 'Rebalance cadence', 'OPEN',
    'Candidates: daily, weekly, monthly. Select using research justification, not convenience.'],
  ['OI-0005', 'Portfolio constraint numerics', 'OPEN',
    'The 12% single-name and category limits are research defaults, not final locks.'],
] as const

const GATES_STATIC = [
  ['0A', 'Agent operating system', 'PASS', 'Context, compute boundary, source hierarchy and bias rules are explicit.'],
  ['0', 'Universe lock', 'PASS', '20 tickers, all exchange-verified, schema validation 131/131.'],
  ['1', 'Fundamental dataset', 'NOT RUN', 'Phase 1 has not produced a sourced point-in-time factor dataset; a descriptive current-state snapshot (market cap, fwd P/E, exposure estimates) now feeds the AI-Universe header cards and the Stock-Intelligence snapshot panel.'],
  ['4', 'Feature / target integrity', 'REVIEW', 'Walk-forward integrity checks executed in the Phase 5/6 run (24/24: truncated-history recompute, label alignment, purge/embargo geometry, date-local cross-sections). Formal gate review pending.'],
  ['6', 'Signal validation', 'REVIEW', 'IC, ICIR, decay, annual breakdown and quantile profiles computed out-of-sample (PHASE_LOG D0030). Transaction-cost, concentration and regime tests pending (OI-0003 / OI-0005).'],
] as const

export function ResearchAudit() {
  const { selectTicker } = useApp()
  const [tab, setTab] = useState<'provenance' | 'universe' | 'ledger' | 'gates' | 'limits'>('provenance')

  const realCount = realSurfaces.length
  const syntheticCount = syntheticSurfaces.length
  const pendingCount = pendingSurfaces.length
  const acq = manifest.acquisition
  const train = manifest.training
  const backtestReal = backtest.series_provenance !== undefined

  const gates: readonly (readonly [string, string, string, string])[] = [
    GATES_STATIC[0],
    GATES_STATIC[1],
    GATES_STATIC[2],
    [
      '2',
      'Raw EOD data',
      acq ? 'PASS' : 'NOT RUN',
      acq
        ? `Acquired ${acq.trading_days.toLocaleString('en-US')} trading days via ${acq.notebook} (${acq.sources}).`
        : 'No market dataset has been acquired yet.',
    ],
    [
      '3',
      'Data quality',
      acq ? (acq.validation === 'PASS' ? 'PASS' : 'REVIEW') : 'NOT RUN',
      acq
        ? `Validation ${acq.validation}: schema, duplicates, missingness, OHLC consistency and listing-start checks in the acquisition notebook.`
        : 'Depends on Gate 2.',
    ],
    GATES_STATIC[3],
    [
      '5',
      'Walk-forward ML',
      modelsAreSynthetic ? 'NOT RUN' : 'REVIEW',
      modelsAreSynthetic
        ? 'Models not trained in Colab.'
        : train
          ? `Trained in Colab (${fmtDate(train.executed_at.slice(0, 10))}, ${train.checks} checks). Return/direction targets show no OOS edge; volatility targets are strongly predictable — PHASE_LOG D0030. Protocol review pending.`
          : 'Model artifact present — awaiting protocol review.',
    ],
    GATES_STATIC[4],
    [
      '7',
      'Risk / optimisation',
      riskIsReal ? 'REVIEW' : 'NOT RUN',
      riskIsReal
        ? 'Covariance estimated and shrunk from real prices; contributions describe the equal-weight reference book until Phase 9.'
        : 'No covariance or optimisation run exists.',
    ],
    [
      '8',
      'Backtest / attribution',
      backtestReal ? 'REVIEW' : 'NOT RUN',
      backtestReal
        ? 'Equal-weight universe and benchmark curves computed from real prices; ML strategy curve pending Phases 6/9/10.'
        : 'No real backtest exists.',
    ],
    [
      '9',
      'Dashboard',
      dataMode.label === 'live data' ? 'PASS' : 'REVIEW',
      `Frontend renders versioned artifacts with artifact-level provenance — ${realCount} of ${manifest.real_vs_synthetic.length} surfaces real.`,
    ],
  ]

  return (
    <Page
      title="Research Audit"
      lede={
        <>
          Every claim elsewhere in the terminal traces to a named source, a version and an explicit
          real-or-simulated status. Nothing is claimed real unless it traces to a versioned run.
        </>
      }
      toolbar={
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'provenance', label: 'Provenance' },
            { value: 'universe', label: 'Universe' },
            { value: 'ledger', label: 'Decisions' },
            { value: 'gates', label: 'Gates' },
            { value: 'limits', label: 'Limitations' },
          ]}
        />
      }
    >
      <div className="space-y-3">
        {/* Banner */}
        {dataMode.label === 'live data' ? (
          <div className="flex items-start gap-3 rounded border border-sig-pos/30 bg-sig-pos/[0.06] px-4 py-3">
            <span className="mt-[3px] shrink-0 font-mono text-[13px] text-sig-pos" aria-hidden>
              ✓
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-sig-pos">
                All rendered surfaces trace to real versioned artifacts.
              </div>
              <p className="mt-1 max-w-[140ch] text-micro leading-relaxed text-fg-base">
                Every table in this terminal is read from a versioned artifact with a recorded
                acquisition timestamp and checksum.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded border border-sig-warn/30 bg-sig-warn/[0.06] px-4 py-3">
            <span className="mt-[3px] shrink-0 text-sig-warn">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 1.6 15 14H1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M8 6v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-sig-warn">
                {realCount > 2
                  ? `Partial-real build — ${realCount} of ${manifest.real_vs_synthetic.length} surfaces real, ${syntheticCount} synthetic, ${pendingCount} pending.`
                  : 'This build displays synthetic demo data, not research output.'}
              </div>
              {realCount > 2 ? (
                <p className="mt-1 max-w-[140ch] text-micro leading-relaxed text-fg-base">
                  Market prices and risk statistics, the equal-weight / benchmark backtest curves
                  and the walk-forward model metrics come from real versioned runs
                  {acq ? ` (acquisition: ${acq.notebook}, ${fmtDate(acq.executed_at.slice(0, 10))})` : ''}
                  {train ? ` (training: ${train.notebook}, ${fmtDate(train.executed_at.slice(0, 10))}, ${train.checks} checks)` : ''}.
                  Surfaces flagged <code className="font-mono text-fg-hi">SYNTHETIC</code> are
                  fixtures generated by{' '}
                  <code className="font-mono text-fg-hi">dashboard/scripts/gen_demo_data.py</code>
                  {syntheticCount > 0 ? ` with seed ${manifest.seed}` : ''}; surfaces flagged{' '}
                  <code className="font-mono text-fg-hi">PENDING</code> have no artifact yet. The
                  ledger below is the full accounting.
                </p>
              ) : (
                <p className="mt-1 max-w-[140ch] text-micro leading-relaxed text-fg-base">
                  The frontend was completed ahead of the Colab compute plane. Only the universe
                  verification artifact is real; every price, model statistic, portfolio weight and
                  backtest figure is produced by{' '}
                  <code className="font-mono text-fg-hi">dashboard/scripts/gen_demo_data.py</code>{' '}
                  with seed {manifest.seed}. When the real versioned artifacts land on Drive, the
                  dashboard swaps to them without any change to how a number is computed or
                  displayed.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'provenance' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title="Real vs synthetic ledger"
              subtitle={`${realCount} real · ${syntheticCount} synthetic${pendingCount ? ` · ${pendingCount} pending` : ''}`}
              pad={false}
            >
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Surface</th>
                    <th className="w-[110px]">Status</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.real_vs_synthetic.map((r) => {
                    const st = ledgerStatus(r.status)
                    return (
                      <tr key={r.surface}>
                        <td className="whitespace-normal text-fg-base">{r.surface}</td>
                        <td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="font-mono text-2xs text-fg-mute">
                          <span className="block max-w-[320px] truncate" title={r.source}>
                            {r.source}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Panel>

            <div className="flex flex-col gap-3">
              <Panel title="Artifact versions" subtitle="Every number traces to one of these">
                <dl className="space-y-1.5">
                  {(
                    [
                      ['Specification', `v${manifest.spec_version}`],
                      ['Universe', `v${manifest.universe_version}`],
                      ['Features', models.feature_version],
                      ['Targets', models.target_version],
                      ['Model', models.model_version ?? '—'],
                      ['Trained', train ? fmtDate(train.executed_at.slice(0, 10)) : '—'],
                      ['Portfolio', portfolio.portfolio_version],
                      ['Optimizer', portfolio.optimizer_version],
                      ['Objective', portfolio.objective_version],
                      ['Generated', fmtDate(manifest.generated_at.slice(0, 10))],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-1.5 last:border-0">
                      <dt className="text-micro text-fg-dim">{k}</dt>
                      <dd className="font-mono text-2xs text-fg-hi">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <Panel title="Real-artifact checklist" subtitle="Produced on the Colab compute plane — delivered items checked">
                <ul className="space-y-1">
                  {manifest.pending_real_artifacts.map((a) => {
                    const done = a.includes('DELIVERED')
                    return (
                      <li key={a} className="flex items-center gap-2">
                        <span className={done ? 'text-sig-pos' : 'text-fg-mute'} aria-hidden>
                          {done ? '✓' : '○'}
                        </span>
                        <span
                          className={clsx(
                            'truncate font-mono text-2xs',
                            done ? 'text-fg-base' : 'text-fg-mute',
                          )}
                        >
                          {a}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Panel>

              <Panel title="Frozen research window" subtitle="Locked for reproducibility">
                <div className="space-y-2">
                  {(
                    [
                      ['Window start', RESEARCH_START],
                      ['Cutoff (EOD)', RESEARCH_END],
                      ['Trading days', nfInt(market.dates.length)],
                      ['Constituents', String(TICKERS.length)],
                      ['Benchmarks', Object.keys(market.benchmarks).join(' · ')],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <span className="text-micro text-fg-dim">{k}</span>
                      <span className="font-mono tnum text-micro text-fg-hi">{v}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        {tab === 'universe' && (
          <Panel
            title="Universe verification"
            subtitle={`Phase 0 · universe v${universe.universe_version} · verified ${universe.verified_at} · source: artifacts/manifests/universe_verification_v001.json`}
            pad={false}
            actions={<Badge tone="pos">real artifact</Badge>}
          >
            <div className="max-h-[560px] overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ticker</th>
                    <th>Company</th>
                    <th>Class</th>
                    <th>AI category</th>
                    <th>Domicile</th>
                    <th className="text-center">Listed</th>
                    <th className="text-center">US</th>
                    <th className="text-right">History from</th>
                    <th>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {universe.constituents.map((c, i) => (
                    <tr
                      key={c.ticker}
                      tabIndex={0}
                      onClick={() => selectTicker(c.ticker)}
                      onKeyDown={(e) => e.key === 'Enter' && selectTicker(c.ticker)}
                      className="rowfocus cursor-pointer"
                    >
                      <td className="text-center font-mono tnum text-fg-mute">{i + 1}</td>
                      <td>
                        <span className="font-mono text-[12px] font-semibold text-fg-hi">
                          {c.ticker}
                        </span>
                      </td>
                      <td className="whitespace-normal text-fg-base">{c.company}</td>
                      <td className="text-2xs text-fg-dim">{c.security_class}</td>
                      <td className="text-2xs text-fg-dim">{humanise(c.ai_category)}</td>
                      <td className="max-w-[240px] truncate text-2xs text-fg-mute" title={c.domicile_detail}>
                        {c.domicile_detail.split('(')[0].trim()}
                      </td>
                      <td className="text-center">
                        {c.listing_verified ? (
                          <span className="text-sig-pos">✓</span>
                        ) : (
                          <span className="text-sig-neg">✗</span>
                        )}
                      </td>
                      <td className="text-center">
                        {c.us_domicile_verified ? (
                          <span className="text-sig-pos">✓</span>
                        ) : (
                          <span className="text-sig-neg">✗</span>
                        )}
                      </td>
                      <td className="num text-fg-dim">
                        {historyStart(c.ticker)}
                        {TRUNCATED.some((t) => t.ticker === c.ticker) && (
                          <span className="ml-1.5 text-sig-warn">IPO</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {c.source_urls.map((u, j) => (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={u}
                              className="rounded-xs border border-ink-700 px-1 font-mono text-3xs text-fg-mute transition-colors hover:border-sig-pos/40 hover:text-sig-pos"
                            >
                              {j + 1}
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'ledger' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel title="Decision ledger" subtitle="Transcribed from PHASE_LOG.md — real project record" pad={false}>
              <div className="max-h-[520px] overflow-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Phase</th>
                      <th>Decision</th>
                      <th>Evidence</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DECISIONS.map(([id, date, phase, decision, evidence, status]) => (
                      <tr key={id}>
                        <td className="font-mono text-2xs text-fg-dim">{id}</td>
                        <td className="font-mono text-2xs text-fg-mute">
                          {phase} · {date}
                        </td>
                        <td className="whitespace-normal text-fg-base">{decision}</td>
                        <td className="max-w-[300px] truncate text-2xs text-fg-mute" title={evidence}>
                          {evidence}
                        </td>
                        <td className="text-center">
                          <Badge tone={status === 'LOCKED' ? 'pos' : 'info'}>{status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Open issues" subtitle="Unresolved methodology decisions — recorded, not hidden" pad={false}>
              <div className="space-y-2.5 p-4">
                {OPEN_ISSUES.map(([id, title, status, body]) => (
                  <div key={id} className="border-b border-ink-700/50 pb-2.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-fg-mute">{id}</span>
                      <span className="min-w-0 flex-1 truncate text-micro text-fg-base">{title}</span>
                      <Badge tone="warn">{status}</Badge>
                    </div>
                    <p className="mt-1 text-2xs leading-relaxed text-fg-mute">{body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {tab === 'gates' && (
          <Panel
            title="Quality gate status"
            subtitle="A later phase cannot repair a failed earlier phase silently"
            pad={false}
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-[70px]">Gate</th>
                  <th>Scope</th>
                  <th className="w-[110px] text-center">Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {gates.map(([id, scope, status, notes]) => (
                  <tr key={id}>
                    <td className="font-mono text-2xs text-fg-dim">{id}</td>
                    <td className="text-fg-base">{scope}</td>
                    <td className="text-center">
                      <Badge
                        tone={
                          status === 'PASS'
                            ? 'pos'
                            : status === 'REVIEW'
                              ? 'info'
                              : 'neutral'
                        }
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="whitespace-normal text-2xs text-fg-dim">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {tab === 'limits' && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Known biases and limitations" subtitle="Disclosed in the terminal, not only in the report">
              <div className="space-y-3">
                {(
                  [
                    ['Survivorship / selection bias',
                      'The 20-name universe is selected using 2026 information and then examined backward from 2020. This is a current-universe historical study, not a point-in-time universe reconstruction. Historical returns are therefore subject to selection bias and should not be read as an unbiased estimate of strategy expectancy.'],
                    ['IPO / listing truncation',
                      'PLTR has no public history before September 2020 and CRWV before its March 2025 IPO. No synthetic pre-listing prices are generated, and both names are excluded from the portfolio at dates where they were not tradable. The panel is unbalanced by construction.'],
                    ['Point-in-time fundamentals',
                      'Current 2026 fundamentals are descriptive only. They are not used as historical model features anywhere, because information-available dates for historical fundamental values have not been reconstructed (OI-0001).'],
                    ['Signal correlation vs existing alpha',
                      'No pre-existing alpha signal set exists in this project, so the required correlation comparison is reported as NOT APPLICABLE rather than fabricated.'],
                    ['Capacity',
                      'NOT COMPUTED. A fixed basis-point haircut cannot establish capacity where traded notional, participation rate and modelled market impact are unmeasured.'],
                  ] as const
                ).map(([title, body]) => (
                  <div key={title} className="border-b border-ink-700/50 pb-3 last:border-0">
                    <div className="flex items-start gap-2">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-sig-warn" aria-hidden />
                      <div>
                        <div className="text-micro font-medium text-fg-hi">{title}</div>
                        <p className="mt-1 max-w-[90ch] text-2xs leading-relaxed text-fg-dim">{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="flex flex-col gap-3">
              <Panel
                title="Research conclusion"
                subtitle="Required by the protocol — outcomes must be distinguished"
                provenance={modelsAreSynthetic ? 'pending' : 'mixed'}
              >
                <div className="space-y-2">
                  {(modelsAreSynthetic
                    ? ([
                        ['Predictive but not profitable', 'PENDING', 'Requires Phase 6/7 model outputs — no trained model exists yet.'],
                        ['Profitable but factor-driven', 'PENDING', 'Requires the Phase 10 ML strategy backtest, not the placeholder curve.'],
                        ['Profitable but capacity-limited', 'NOT TESTED', 'Capacity analysis not run.'],
                        ['Statistically significant but economically trivial', 'PENDING', 'Requires trained-model OOS statistics and factor-controlled alpha.'],
                      ] as const)
                    : ([
                        ['Predictive but not profitable', 'NOT ESTABLISHED', 'Return and direction targets show no out-of-sample edge (IC ≈ 0; |t| < 1.7; hit rates at or below the always-up base rate). There is no signal to monetise.'],
                        ['Profitable but factor-driven', 'PENDING', 'Requires the Phase 10 ML-strategy backtest — the ML portfolio curve is still a labelled placeholder.'],
                        ['Profitable but capacity-limited', 'NOT TESTED', 'Capacity analysis not run.'],
                        ['Statistically significant but economically trivial', 'N/A', 'No return/direction statistic is significant. Volatility predictability is strong but is a risk model, not alpha.'],
                      ] as const)
                  ).map(([k, verdict, note]) => (
                    <div key={k} className="flex items-start justify-between gap-3 border-b border-ink-700/50 pb-2 last:border-0">
                      <div className="min-w-0">
                        <div className="text-micro text-fg-base">{k}</div>
                        <div className="mt-0.5 text-2xs leading-relaxed text-fg-mute">{note}</div>
                      </div>
                      <Badge
                        tone={verdict === 'PENDING' ? 'info' : 'neutral'}
                        className="mt-0.5 shrink-0"
                      >
                        {verdict}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Adversarial review"
                subtitle="Questions asked before accepting any result"
                provenance={modelsAreSynthetic ? 'pending' : 'mixed'}
              >
                <ol className="space-y-1.5">
                  {(
                    [
                      'Could the model be learning momentum only? — Partly; short-horizon returns and realised volatility dominate importance; no ablation run yet.',
                      'Could it be learning semiconductor beta only? — No; features_v003 contains no SOXX inputs (QQQ beta only).',
                      'Could it be learning volatility/crowding only? — Cannot be excluded; volatility features rank highest on the vol targets.',
                      'Does the signal disappear after costs? — NOT TESTED; the net-of-cost test arrives with the Phase 10 backtest (OI-0003).',
                      'Does the signal survive 2022? — Return/direction IC ≈ 0 in every year including 2022; volatility IC positive across years.',
                      'Does the signal survive 2025/2026? — No return edge in any year; volatility predictability persists.',
                      'Does it survive removing the largest-cap names? — OPEN, not yet run.',
                      'Does it survive feature ablation? — OPEN, not yet run.',
                      'Does it survive a stricter universe screen? — OPEN, not yet run.',
                      'Is the result driven by one stock or one year? — OPEN, concentration screen required.',
                    ] as const
                  ).map((q, i) => (
                    <li key={q} className="flex items-start gap-2.5 border-b border-ink-700/40 pb-1.5 last:border-0">
                      <span className="shrink-0 font-mono text-3xs text-fg-mute">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-2xs leading-relaxed text-fg-dim">
                        {modelsAreSynthetic
                          ? `${q.slice(0, q.indexOf(' — '))} — PENDING · no model trained yet (Phases 5–7).`
                          : q}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel title="Reproducibility" subtitle="What is needed to re-run this exactly">
                <dl className="space-y-1.5">
                  {(
                    [
                      [
                        'Market data',
                        acq
                          ? `Yahoo Finance EOD · ${acq.notebook} · ${fmtDate(acq.executed_at.slice(0, 10))}`
                          : 'Not yet acquired',
                      ],
                      [
                        'Model metrics',
                        train
                          ? `training_report_v001.json · ${train.notebook} · ${fmtDate(train.executed_at.slice(0, 10))}`
                          : 'Not yet trained',
                      ],
                      [
                        'Synthetic surfaces',
                        syntheticCount > 0
                          ? `dashboard/scripts/gen_demo_data.py · seed ${manifest.seed}`
                          : 'none in this build',
                      ],
                      ['Spec version', `v${manifest.spec_version}`],
                      ['Universe version', `v${manifest.universe_version}`],
                      ['Validation', '131/131 schema tests passed'],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-micro text-fg-dim">{k}</dt>
                      <dd className="font-mono text-2xs text-fg-hi">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </Page>
  )
}
