import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { ProvStatus } from '@/lib/provenance'

// ---------------------------------------------------------------------------
// Panel - the fundamental container. Every surface in the app is a Panel so
// density, border weight and header rhythm stay identical.
// ---------------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClass,
  pad = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
  pad?: boolean
  /**
   * What this panel's figures are made of. Retained for call-site
   * documentation; the inline marker toggle was removed 2026-10-17
   * (owner request - it flagged real panels as SIM).
   */
  provenance?: ProvStatus
}) {
  return (
    <section className={clsx('panel edge-lit flex flex-col', className)}>
      {(title || actions) && (
        <header className="panel-header shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[13px] font-semibold tracking-tight text-fg-hi">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate text-2xs text-fg-dim">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div
        className={clsx(
          'min-h-0 flex-1',
          // Full-bleed panels almost always wrap a wide table. Without this a
          // long row overflows the panel and overlaps whatever sits beside it.
          !pad && 'overflow-x-auto',
          pad && 'p-4',
          bodyClass,
        )}
      >
        {children}
      </div>
    </section>
  )
}

/** Inline synthetic-data marker (fixture rows in tables, etc.). */
export function Sim({ className }: { className?: string }) {
  return (
    <span
      title="Synthetic demo value - not research output"
      className={clsx(
        'shrink-0 rounded-xs border border-warn/30 bg-warn/10 px-1 py-px font-mono text-3xs font-semibold uppercase tracking-wider text-warn',
        className,
      )}
    >
      sim
    </span>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('eyebrow', className)}>{children}</div>
}
