import { useState } from 'react'
import clsx from 'clsx'
import { ROUTES, useApp } from '@/lib/store'
import { TICKER_META, TICKERS, market, universe } from '@/lib/data'
import { dataMode } from '@/lib/provenance'
import { humanise, fmtDate } from '@/lib/format'
import { Badge } from '@/components/ui/Value'

export function Topbar() {
  const { route, navigate, ticker, selectTicker, auditMode, toggleAuditMode, setPaletteOpen } =
    useApp()
  const [pickerOpen, setPickerOpen] = useState(false)

  const current = ROUTES.find((r) => r.id === route)!
  const meta = TICKER_META[ticker]

  return (
    <header className="flex h-[46px] shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900 px-4">
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-[13px] font-semibold tracking-tight text-fg-hi">
          {current.label}
        </h1>
        <span className="hidden truncate text-2xs text-fg-mute lg:inline">{current.hint}</span>
      </div>

      <div className="flex-1" />

      {/* Global ticker context - selection persists across every page. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={clsx(
            'flex items-center gap-2 rounded-sm border px-2 py-[3px] transition-colors',
            pickerOpen || route === 'stock'
              ? 'border-sig-pos/30 bg-sig-pos/[0.07]'
              : 'border-ink-700 bg-ink-850 hover:border-ink-650',
          )}
          title="Switch the globally-selected name (used by every page)"
        >
          <span className="font-mono text-[12px] font-semibold text-fg-hi">{ticker}</span>
          <span className="hidden max-w-[180px] truncate text-2xs text-fg-dim md:inline">
            {meta?.company.replace(/,? Inc\.? Class A| Inc\.| Corporation| Incorporated/, '')}
          </span>
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className="text-fg-mute">
            <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setPickerOpen(false)} aria-hidden />
            <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-[62vh] w-[290px] overflow-y-auto rounded border border-ink-650 bg-ink-850 p-1 shadow-pop">
              {TICKERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    selectTicker(t)
                    setPickerOpen(false)
                  }}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-[5px] text-left transition-colors',
                    t === ticker ? 'bg-sig-pos/10' : 'hover:bg-ink-750',
                  )}
                >
                  <span
                    className={clsx(
                      'w-12 shrink-0 font-mono text-[11.5px] font-semibold',
                      t === ticker ? 'text-sig-pos' : 'text-fg-hi',
                    )}
                  >
                    {t}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-fg-dim">
                    {humanise(TICKER_META[t].ai_category)}
                  </span>
                  {market.start_idx[t] > 0 && (
                    <span
                      title={`History begins ${fmtDate(market.dates[market.start_idx[t]])}`}
                      className="shrink-0 font-mono text-3xs text-sig-warn"
                    >
                      IPO
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <span className="vrule hidden sm:block" aria-hidden />

      {/* As-of / frozen cutoff */}
      <div className="hidden items-center gap-2 sm:flex">
        <span className="text-3xs uppercase tracking-[0.12em] text-fg-mute">Cutoff</span>
        <span className="font-mono text-[11.5px] text-fg-dim">{universe.research_window.end_inclusive}</span>
      </div>

      {/* Audit mode: reveals inline provenance markers across every panel. */}
      <button
        type="button"
        onClick={toggleAuditMode}
        aria-pressed={auditMode}
        title="Toggle inline provenance markers on every panel"
        className={clsx(
          'flex items-center gap-1.5 rounded-sm border px-2 py-[3px] font-mono text-3xs font-semibold uppercase tracking-wider transition-colors',
          auditMode
            ? 'border-sig-warn/40 bg-sig-warn/15 text-sig-warn'
            : 'border-ink-700 bg-ink-850 text-fg-dim hover:border-ink-650 hover:text-fg-base',
        )}
      >
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            auditMode ? 'bg-sig-warn' : 'bg-fg-mute',
          )}
          aria-hidden
        />
        Audit mode
      </button>

      <Badge tone={dataMode.tone} title={dataMode.title}>
        {dataMode.label}
      </Badge>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden items-center gap-1 rounded-sm border border-ink-700 bg-ink-850 px-2 py-[3px] text-fg-mute transition-colors hover:border-ink-650 hover:text-fg-dim md:flex"
        title="Command palette"
      >
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <circle cx="4" cy="4" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 6l2.4 2.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="font-mono text-3xs">Search</span>
        <kbd className="font-mono text-3xs">⌘K</kbd>
      </button>

      <button
        type="button"
        onClick={() => navigate('audit')}
        className={clsx(
          'rounded-sm border px-2 py-[3px] text-3xs font-medium transition-colors',
          route === 'audit'
            ? 'border-sig-pos/30 bg-sig-pos/10 text-sig-pos'
            : 'border-ink-700 bg-ink-850 text-fg-dim hover:border-ink-650 hover:text-fg-base',
        )}
        title="Provenance and limitations"
      >
        v{universe.universe_version}
      </button>
    </header>
  )
}
