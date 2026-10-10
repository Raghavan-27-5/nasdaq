import type { ReactNode } from 'react'
import clsx from 'clsx'

/** Standard page frame: title block, optional toolbar, then a responsive grid. */
export function Page({
  title,
  lede,
  toolbar,
  children,
}: {
  title: string
  lede: ReactNode
  toolbar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4 lg:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-fg-hi">
            {title}
          </h1>
          <p className="mt-1 max-w-[120ch] text-micro leading-relaxed text-fg-dim">{lede}</p>
        </div>
        {toolbar && <div className="flex shrink-0 items-center gap-2">{toolbar}</div>}
      </div>
      {children}
    </div>
  )
}

/** Horizontal strip of stat tiles separated by hairlines. */
export function StatRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'grid divide-x divide-ink-700 overflow-hidden rounded border border-ink-700 bg-ink-850',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Toolbar button - small, hairline, terminal-like. */
export function ToolButton({
  children,
  active,
  onClick,
  title,
}: {
  children: ReactNode
  active?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={clsx(
        'rounded-sm border px-2 py-[3px] font-mono text-3xs font-medium uppercase tracking-wider transition-colors',
        active
          ? 'border-sig-pos/35 bg-sig-pos/10 text-sig-pos'
          : 'border-ink-700 bg-ink-850 text-fg-dim hover:border-ink-650 hover:text-fg-base',
      )}
    >
      {children}
    </button>
  )
}

/** Segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-ink-700 bg-ink-850">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            'px-2.5 py-[3px] font-mono text-3xs font-medium uppercase tracking-wider transition-colors',
            i > 0 && 'border-l border-ink-700',
            value === o.value
              ? 'bg-sig-pos/10 text-sig-pos'
              : 'text-fg-dim hover:bg-ink-750 hover:text-fg-base',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Disclosure with a monospace, low-key summary line. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="cursor-pointer list-none font-mono text-3xs uppercase tracking-[0.1em] text-fg-mute transition-colors hover:text-fg-dim">
        <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">▸</span>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}
