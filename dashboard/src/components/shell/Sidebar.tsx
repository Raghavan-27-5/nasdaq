import clsx from 'clsx'
import { ROUTES, useApp } from '@/lib/store'
import type { RouteId } from '@/lib/store'
import { manifest, universe } from '@/lib/data'
import { Badge } from '@/components/ui/Value'

/** Minimal 14px stroke icons. Geometric, consistent weight, no icon library. */
const ICONS: Record<RouteId, React.ReactNode> = {
  command: <path d="M2 4.5h10M2 9.5h6" />,
  universe: (
    <>
      <circle cx="4" cy="7" r="2" />
      <circle cx="11" cy="4.5" r="2" />
      <circle cx="11" cy="9.5" r="2" />
      <path d="M5.8 6.1 9.3 5.2M5.8 7.9l3.5.9" />
    </>
  ),
  stock: <path d="M2 11.5 5.5 7l2.5 2.2L13 3.5" />,
  ml: (
    <>
      <circle cx="3.5" cy="10.5" r="1.4" />
      <circle cx="7" cy="6.5" r="1.4" />
      <circle cx="10.5" cy="8.5" r="1.4" />
      <circle cx="13" cy="4" r="1.4" />
      <path d="M4.6 9.4 6.1 7.6M8.3 6.9l1.1 1M11.6 7.6l.5-2" />
    </>
  ),
  portfolio: (
    <>
      <path d="M7 2.5v10M2.5 6.5h9M4 4 2.5 6.5 4 9M10 4l1.5 2.5L10 9" />
    </>
  ),
  risk: <path d="M7 2 12.5 12.5h-11z" />,
  backtest: (
    <>
      <path d="M2 11.5V7M5.5 11.5V4M9 11.5V8.5M12.5 11.5V2.5" />
    </>
  ),
  audit: (
    <>
      <path d="M7 2.2 11.5 4v3.4c0 2.6-1.9 4.9-4.5 5.7-2.6-.8-4.5-3.1-4.5-5.7V4z" />
      <path d="M5.4 7.1 6.6 8.3l2.6-2.7" />
    </>
  ),
}

export function Sidebar() {
  const { route, navigate, ticker } = useApp()

  return (
    <aside className="flex h-full w-[212px] shrink-0 flex-col border-r border-ink-700 bg-ink-900">
      {/* Brand */}
      <div className="border-b border-ink-700 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <svg width="17" height="17" viewBox="0 0 32 32" aria-hidden className="shrink-0">
            <rect width="32" height="32" rx="7" fill="#12151A" stroke="#242931" />
            <path
              d="M7 22.5 12.5 15l4.5 5 3.5-4.5 4.5 7"
              stroke="#4ADE9E"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold leading-tight tracking-tight text-fg-hi">
              Nasdaq AI Quant
            </div>
            <div className="truncate text-3xs uppercase tracking-[0.13em] text-fg-mute">
              Research Terminal
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Primary">
        {ROUTES.map((r, i) => {
          const active = route === r.id
          return (
            <div key={r.id}>
              {i === 4 && (
                <div className="mx-3 my-2 border-t border-ink-700" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => navigate(r.id, r.id === 'stock' ? ticker : undefined)}
                aria-current={active ? 'page' : undefined}
                title={`${r.hint}  (press ${r.key})`}
                className={clsx(
                  'group relative flex w-full items-center gap-2.5 px-3 py-[7px] text-left transition-colors duration-150',
                  active ? 'bg-sig-pos/[0.06] text-fg-hi' : 'text-fg-dim hover:bg-ink-850 hover:text-fg-base',
                )}
              >
                <span
                  className={clsx(
                    'absolute inset-y-0 left-0 w-[2px] transition-colors',
                    active ? 'bg-sig-pos' : 'bg-transparent',
                  )}
                  aria-hidden
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={clsx('shrink-0', active ? 'text-sig-pos' : 'text-fg-mute group-hover:text-fg-dim')}
                >
                  {ICONS[r.id]}
                </svg>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{r.label}</span>
                <kbd
                  className={clsx(
                    'shrink-0 font-mono text-3xs transition-colors',
                    active ? 'text-fg-dim' : 'text-fg-mute/60 group-hover:text-fg-mute',
                  )}
                >
                  {r.key}
                </kbd>
              </button>
            </div>
          )
        })}
      </nav>

      {/* Provenance block - always visible, never hidden behind a menu. */}
      <div className="space-y-2 border-t border-ink-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-3xs uppercase tracking-[0.12em] text-fg-mute">Data</span>
          <Badge tone="warn">synthetic</Badge>
        </div>
        <dl className="space-y-1 font-mono text-3xs text-fg-mute">
          <div className="flex justify-between gap-2">
            <dt>SPEC</dt>
            <dd className="text-fg-dim">v{manifest.spec_version}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>UNIVERSE</dt>
            <dd className="text-fg-dim">v{universe.universe_version}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>NAMES</dt>
            <dd className="text-fg-dim">{universe.constituents.length}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>WINDOW</dt>
            <dd className="text-fg-dim">20-01 → 26-09</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
