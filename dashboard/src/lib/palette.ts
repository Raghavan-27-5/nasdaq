/**
 * Chart + UI palette. Single source of truth so a colour means the same thing
 * on every surface. Restrained on purpose: one signal colour, two alert
 * colours, and a muted categorical set for series identity.
 */

export const C = {
  canvas: '#08090B',
  panel: '#0E1013',
  raised: '#12151A',
  hairline: '#1C1F24',
  hairlineStrong: '#2E343D',

  pos: '#4ADE9E',
  posDim: '#2F8F63',
  neg: '#F4553F',
  warn: '#F5A524',
  info: '#5B8DEF',
  alt: '#A78BFA',
  cyan: '#22D3EE',

  hi: '#E9ECEF',
  base: '#AEB6C1',
  dim: '#7A828E',
  mute: '#565E69',
} as const

/** Series identity order. Stable across every chart so colour = series. */
export const SERIES = [C.pos, C.info, C.warn, C.alt, C.cyan, '#F472B6', '#A3E635', '#FB923C'] as const

export const SERIES_COLOR: Record<string, string> = {
  ML_PORTFOLIO: C.pos,
  EW_UNIVERSE: C.info,
  QQQ: '#8B93A1',
  SOXX: '#6E7683',
  SPY: C.alt,
  CONSTRAINED: C.pos,
  UNCONSTRAINED: C.warn,
  EQUAL_WEIGHT: C.info,
}

/** Green->amber->red ramp for signed magnitudes. */
export const DIVERGING = ['#2A6F55', '#4ADE9E', '#0E1013', '#C9704A', '#F4553F']

/**
 * Sequential ramp for correlation. Every pairwise correlation in a concentrated
 * universe is positive and high (0.25-1.0), so a -1..+1 diverging scale paints
 * every cell the same hot colour and hides all structure.
 *
 * The light end stops at a medium green so that light in-cell labels stay
 * legible across the whole ramp.
 */
export const CORR_RAMP = ['#12242B', '#17414A', '#1C6067', '#2A8178', '#39A184', '#4FC096']

export const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'
export const SANS = '"Inter Variable", system-ui, sans-serif'

/** Shared ECharts scaffolding so every chart in the app looks like one system. */
export const axisCommon = {
  axisLine: { show: true, lineStyle: { color: C.hairline } },
  axisTick: { show: false },
  axisLabel: { color: C.dim, fontFamily: MONO, fontSize: 10 },
  splitLine: { show: true, lineStyle: { color: C.hairline, opacity: 0.55, type: 'solid' as const } },
}

export const tooltipCommon = {
  backgroundColor: 'rgba(14,16,19,0.97)',
  borderColor: C.hairlineStrong,
  borderWidth: 1,
  padding: [8, 10] as [number, number],
  textStyle: { color: C.hi, fontFamily: MONO, fontSize: 11 },
  extraCssText: 'box-shadow: 0 12px 32px -8px rgba(0,0,0,.8); border-radius: 3px; backdrop-filter: blur(6px);',
}
