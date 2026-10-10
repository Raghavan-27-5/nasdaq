import { useMemo } from 'react'
import clsx from 'clsx'
import { C } from '@/lib/palette'

/**
 * Inline sparkline. Pure SVG - thousands of these can exist on a page without
 * the canvas/DOM cost of a charting library, and they inherit CSS colours.
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  tone,
  strokeWidth = 1.25,
  fill = false,
  baseline,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  tone?: 'pos' | 'neg' | 'auto' | string
  strokeWidth?: number
  fill?: boolean
  /** Draw a dashed reference line at this value (e.g. 0 or the cost level). */
  baseline?: number
  className?: string
}) {
  const { d, area, color } = useMemo(() => {
    if (values.length < 2) return { d: '', area: '', color: C.dim }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const pad = strokeWidth
    const x = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad
    const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)
    const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
    const resolved =
      tone === 'pos' ? C.pos : tone === 'neg' ? C.neg : tone === 'auto'
        ? values[values.length - 1] >= values[0] ? C.pos : C.neg
        : (tone as string)
    return {
      d: path,
      area: `${path} L${x(values.length - 1).toFixed(2)} ${height} L${x(0).toFixed(2)} ${height} Z`,
      color: resolved,
    }
  }, [values, width, height, tone, strokeWidth])

  if (!d) return <div style={{ width, height }} className={className} />

  const yBase = (() => {
    if (baseline === undefined) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    return height - strokeWidth - ((baseline - min) / span) * (height - strokeWidth * 2)
  })()

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      {fill && <path d={area} fill={color} opacity={0.1} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {yBase !== null && (
        <line
          x1={0}
          x2={width}
          y1={yBase}
          y2={yBase}
          stroke={C.hairlineStrong}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
    </svg>
  )
}

/**
 * Drawdown-underwater area. Given an equity curve, returns the running
 * peak-to-trough decline as a fraction (always <= 0).
 */
export function drawdownSeries(equity: number[]): number[] {
  let peak = equity[0] ?? 1
  return equity.map((v) => {
    if (v > peak) peak = v
    return peak > 0 ? v / peak - 1 : 0
  })
}

/**
 * Score bar: a signed, centred bar used for factor contributions and
 * risk contributions. Reads faster than a table of numbers for "who helps,
 * who hurts".
 */
export function ContributionBar({
  value,
  max,
  height = 14,
  className,
}: {
  value: number
  max: number
  height?: number
  className?: string
}) {
  const w = max > 0 ? (Math.abs(value) / max) * 50 : 0
  return (
    <div
      className={clsx('relative w-full overflow-hidden', className)}
      style={{ height }}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-ink-650" />
      <div
        className={clsx(
          'absolute inset-y-[3px] rounded-[1px]',
          value >= 0 ? 'bg-sig-pos/70 left-1/2' : 'bg-sig-neg/70',
        )}
        style={{
          width: `${w}%`,
          ...(value >= 0 ? { marginLeft: 0 } : { right: '50%' }),
        }}
      />
    </div>
  )
}
