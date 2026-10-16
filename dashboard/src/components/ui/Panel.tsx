import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useApp } from '@/lib/store'
import { provLabel, provTone } from '@/lib/provenance'
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
  provenance,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
  pad?: boolean
  /** What this panel's figures are made of. Shown inline in audit mode. */
  provenance?: ProvStatus
}) {
  const { auditMode } = useApp()
  return (
    <section className={clsx('panel edge-lit flex flex-col', className)}>
      {(title || actions) && (
        <header className="panel-header shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[13px] font-semibold tracking-tight text-fg-hi">
                {title}
              </h2>
              {auditMode && (provenance ? <ProvChip status={provenance} /> : <Sim />)}
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

/** Inline provenance marker, visible always in audit mode. */
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

/** Typed variant of the audit-mode marker, used when a panel's provenance is known. */
export function ProvChip({ status }: { status: ProvStatus }) {
  const tone = provTone(status)
  return (
    <span
      title={
        status === 'real'
          ? 'Real artifact - traceable to a versioned Colab run'
          : status === 'synthetic'
            ? 'Synthetic fixture - not research output'
            : status === 'pending'
              ? 'Not yet produced - awaiting a later phase'
              : 'Mixed provenance - see Research Audit ledger'
      }
      className={clsx(
        'shrink-0 rounded-xs border px-1 py-px font-mono text-3xs font-semibold uppercase tracking-wider',
        tone === 'pos' && 'border-sig-pos/30 bg-sig-pos/10 text-sig-pos',
        tone === 'warn' && 'border-sig-warn/30 bg-sig-warn/10 text-sig-warn',
        tone === 'info' && 'border-sig-info/30 bg-sig-info/10 text-sig-info',
      )}
    >
      {provLabel(status)}
    </span>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('eyebrow', className)}>{children}</div>
}
