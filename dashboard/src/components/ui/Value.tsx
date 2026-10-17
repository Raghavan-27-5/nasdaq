import type { ReactNode } from 'react'
import clsx from 'clsx'
import { dir } from '@/lib/format'

// ---------------------------------------------------------------------------
// Value display primitives. Numerals are always mono + tabular so a column
// of figures never shifts as values change.
// ---------------------------------------------------------------------------

export function Value({
  children,
  tone,
  className,
  size = 'md',
}: {
  children: ReactNode
  tone?: 'pos' | 'neg' | 'flat' | 'auto'
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const t =
    tone === 'auto'
      ? typeof children === 'number'
        ? dir(children)
        : 'flat'
      : (tone ?? 'flat')
  return (
    <span
      className={clsx(
        'font-mono tnum',
        t === 'pos' && 'text-sig-pos',
        t === 'neg' && 'text-sig-neg',
        t === 'flat' && 'text-fg-hi',
        size === 'sm' && 'text-micro',
        size === 'md' && 'text-[15px]',
        size === 'lg' && 'text-xl',
        size === 'xl' && 'text-[28px] leading-none tracking-tight',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Headline metric tile: label, big figure, optional delta + footnote. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  footnote,
  size = 'lg',
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'pos' | 'neg' | 'flat' | 'auto'
  footnote?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  className?: string
}) {
  return (
    <div className={clsx('min-w-0 px-4 py-3', className)}>
      <div className="truncate text-3xs font-medium uppercase tracking-[0.1em] text-fg-dim">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <Value size={size} tone={tone}>
          {value}
        </Value>
        {sub && <span className="font-mono text-2xs text-fg-dim">{sub}</span>}
      </div>
      {footnote && <div className="mt-1 text-2xs leading-snug text-fg-mute">{footnote}</div>}
    </div>
  )
}

/** Delta chip: "+2.41%" with arrow, coloured by sign. */
export function Delta({
  children,
  tone = 'auto',
  className,
  arrow = true,
}: {
  children: ReactNode
  tone?: 'pos' | 'neg' | 'flat' | 'auto'
  className?: string
  arrow?: boolean
}) {
  // Sign inference: numbers via `dir`; formatted strings via their explicit
  // sign prefix ("+x%"/"-x%"/"−x%"). Previously every string child rendered
  // the flat-dash glyph in neutral colour, so signed figures such as
  // "+68.5%" showed a leading dash that read as a minus sign (visual QA
  // finding, 2026-10-16).
  const s = typeof children === 'string' ? children.trim() : null
  const t =
    tone !== 'auto'
      ? tone
      : typeof children === 'number'
        ? dir(children)
        : s === null
          ? 'flat'
          : s.startsWith('+')
            ? 'pos'
            : s.startsWith('-') || s.startsWith('−')
              ? 'neg'
              : 'flat'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-mono tnum text-micro',
        t === 'pos' && 'text-sig-pos',
        t === 'neg' && 'text-sig-neg',
        t === 'flat' && 'text-fg-base',
        className,
      )}
    >
      {arrow && (
        <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden className="shrink-0">
          {/* Up-triangle for positive, down for negative. The two paths were
              swapped since the component was written: with the tone fix above
              resolving real signs, positive deltas rendered a DOWN arrow and
              negative deltas an UP arrow (reported by the owner, 2026-10-17). */}
          <path
            d={t === 'pos' ? 'M4 0.5 L7.5 7 L0.5 7 Z' : t === 'neg' ? 'M4 7.5 L0.5 1 L7.5 1 Z' : 'M0.5 3.5 H7.5 V4.5 H0.5 Z'}
            fill="currentColor"
          />
        </svg>
      )}
      {children}
    </span>
  )
}

type BadgeTone = 'neutral' | 'pos' | 'neg' | 'warn' | 'info' | 'alt'

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  title?: string
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-ink-650 bg-ink-800 text-fg-base',
    pos: 'border-sig-pos/25 bg-sig-pos/10 text-sig-pos',
    neg: 'border-sig-neg/25 bg-sig-neg/10 text-sig-neg',
    warn: 'border-sig-warn/25 bg-sig-warn/10 text-sig-warn',
    info: 'border-sig-info/25 bg-sig-info/10 text-sig-info',
    alt: 'border-sig-alt/25 bg-sig-alt/10 text-sig-alt',
  }
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-xs border px-1.5 py-px font-mono text-3xs font-medium uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Proportional horizontal bar used for weights/factor contributions. */
export function MiniBar({
  value,
  max,
  tone = 'pos',
  className,
}: {
  value: number
  max: number
  tone?: 'pos' | 'neg' | 'info' | 'warn'
  className?: string
}) {
  const w = max > 0 ? Math.min(Math.abs(value) / max, 1) * 100 : 0
  const colors = {
    pos: 'bg-sig-pos/70',
    neg: 'bg-sig-neg/70',
    info: 'bg-sig-info/70',
    warn: 'bg-sig-warn/70',
  }
  return (
    <div className={clsx('h-1 w-full overflow-hidden rounded-full bg-ink-750', className)}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', colors[tone])}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

/** Empty-state used wherever the correct answer is "not computed" rather
 *  than a fabricated number (AGENTS.md §10). */
export function NotComputed({ reason }: { reason?: string }) {
  return (
    <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 text-center">
      <div className="font-mono text-micro text-fg-dim">NOT COMPUTED</div>
      {reason && <div className="max-w-[42ch] text-2xs leading-relaxed text-fg-mute">{reason}</div>}
    </div>
  )
}
