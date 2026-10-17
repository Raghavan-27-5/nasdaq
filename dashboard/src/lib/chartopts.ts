import { axisCommon, C, MONO, SERIES_COLOR, tooltipCommon } from './palette'
import type { EChartsOption } from '@/components/charts/EChart'
import type { CallbackDataParams } from 'echarts/types/dist/shared'

type NullNum = number | null

/**
 * Shared ECharts option builders. Keeping these in one place is what makes
 * eight different pages look like a single product rather than eight charts
 * that happen to be in the same app.
 */

export interface SeriesSpec {
  key: string
  label: string
  values: NullNum[]
  color?: string
  width?: number
  dashed?: boolean
  area?: boolean
  /** Plot on a second (right-hand) axis. */
  yAxisIndex?: number
}

/** Multi-series time-series line chart with a shared crosshair tooltip. */
export function timeSeriesOption(
  dates: string[],
  series: SeriesSpec[],
  opts: {
    height?: number
    yFormat?: (v: number) => string
    zoom?: boolean
    markers?: { label: string; index: number; color?: string }[]
    logScale?: boolean
    legend?: boolean
  } = {},
): EChartsOption {
  const { yFormat = (v: number) => v.toFixed(2), zoom = false, markers = [], legend = true } = opts

  const hasRight = series.some((s) => s.yAxisIndex === 1)

  return {
    grid: { left: 4, right: hasRight ? 4 : 10, top: legend ? 30 : 10, bottom: zoom ? 34 : 4, containLabel: true },
    legend: legend
      ? {
          top: 0,
          left: 0,
          itemWidth: 10,
          itemHeight: 2,
          itemGap: 14,
          icon: 'roundRect',
          textStyle: { color: C.dim, fontFamily: MONO, fontSize: 10 },
        }
      : { show: false },
    tooltip: {
      trigger: 'axis',
      ...tooltipCommon,
      axisPointer: { type: 'line', lineStyle: { color: C.hairlineStrong, width: 1 } },
      formatter: (params: unknown) => {
        const arr = params as { axisValue: string; seriesName: string; value: [number, number]; color: string; seriesIndex: number }[]
        if (!arr?.length) return ''
        const head = `<div style="color:${C.dim};font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">${arr[0].axisValue}</div>`
        const rows = arr
          .map(
            (p) =>
              `<div style="display:flex;align-items:center;gap:7px;margin-top:2px">
                 <span style="width:8px;height:2px;background:${p.color};border-radius:2px;display:inline-block"></span>
                 <span style="color:${C.dim};flex:1">${p.seriesName}</span>
                 <span style="color:${C.hi};font-weight:500">${yFormat(Number(p.value[1]))}</span>
               </div>`,
          )
          .join('')
        return head + rows
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      ...axisCommon,
      splitLine: { show: false },
      axisLabel: { ...axisCommon.axisLabel, hideOverlap: true },
    },
    yAxis: [
      {
        type: 'value',
        scale: true,
        ...axisCommon,
        axisLabel: { ...axisCommon.axisLabel, formatter: yFormat },
      },
      ...(hasRight
        ? [
            {
              type: 'value' as const,
              scale: true,
              ...axisCommon,
              splitLine: { show: false },
              axisLabel: { ...axisCommon.axisLabel, formatter: yFormat },
            },
          ]
        : []),
    ],
    dataZoom: zoom
      ? [
          { type: 'inside' as const, start: 0, end: 100 },
          {
            type: 'slider' as const,
            height: 16,
            bottom: 8,
            borderColor: C.hairline,
            backgroundColor: 'transparent',
            fillerColor: 'rgba(74,222,158,.07)',
            handleStyle: { color: '#2E343D', borderColor: C.hairlineStrong },
            moveHandleStyle: { color: '#242931' },
            dataBackground: { lineStyle: { color: C.hairlineStrong }, areaStyle: { color: C.raised } },
            selectedDataBackground: { lineStyle: { color: C.posDim }, areaStyle: { color: 'rgba(74,222,158,.10)' } },
            textStyle: { color: C.mute, fontFamily: MONO, fontSize: 9 },
          },
        ]
      : undefined,
    series: series.map((s, i) => ({
      name: s.label,
      type: 'line' as const,
      data: s.values,
      yAxisIndex: s.yAxisIndex ?? 0,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 4,
      smooth: false,
      connectNulls: false,
      lineStyle: {
        width: s.width ?? 1.6,
        color: s.color ?? SERIES_COLOR[s.key] ?? C.dim,
        type: s.dashed ? ('dashed' as const) : ('solid' as const),
      },
      itemStyle: { color: s.color ?? SERIES_COLOR[s.key] ?? C.dim },
      areaStyle: s.area
        ? {
            opacity: 0.13,
            color: s.color ?? SERIES_COLOR[s.key] ?? C.dim,
          }
        : undefined,
      z: i === 0 ? 3 : 2,
      markLine:
        markers.length && i === 0
          ? {
              silent: true,
              symbol: 'none',
              label: {
                formatter: (p: { name: string }) => p.name,
                color: C.dim,
                fontFamily: MONO,
                fontSize: 9,
                position: 'insideEndTop' as const,
              },
              lineStyle: { color: C.hairlineStrong, width: 1, type: 'dashed' as const },
              data: markers.map((m) => ({
                xAxis: dates[m.index],
                name: m.label,
                lineStyle: m.color ? { color: m.color, width: 1 } : undefined,
              })),
            }
          : undefined,
    })),
  }
}

/** Underwater drawdown area chart. */
export function drawdownOption(dates: string[], values: NullNum[]): EChartsOption {
  return {
    grid: { left: 4, right: 10, top: 6, bottom: 4, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'axis',
      ...tooltipCommon,
      axisPointer: { type: 'line', lineStyle: { color: C.hairlineStrong, width: 1 } },
      formatter: (params: unknown) => {
        const arr = params as { axisValue: string; value: [number, number] }[]
        if (!arr?.length) return ''
        const v = Number(arr[0].value[1])
        return `<div style="color:${C.dim};font-size:10px;margin-bottom:4px">${arr[0].axisValue}</div>
                <span style="color:${C.neg};font-weight:500">${(v * 100).toFixed(2)}%</span>`
      },
    },
    // Date labels shown: all drawdown views previously hid the x-axis,
    // making the window unreadable next to the equity views (visual QA,
    // 2026-10-16).
    xAxis: { type: 'category', boundaryGap: false, data: dates, ...axisCommon, splitLine: { show: false } },
    yAxis: {
      type: 'value',
      max: 0,
      ...axisCommon,
      axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
    },
    series: [
      {
        type: 'line',
        data: values,
        showSymbol: false,
        lineStyle: { width: 1, color: C.neg },
        areaStyle: { color: C.neg, opacity: 0.18 },
      },
    ],
  }
}

/** Horizontal ranked bar chart (factor weights, risk contributions, etc). */
export function rankBarOption(
  rows: { label: string; value: number; color?: string; sub?: string }[],
  opts: {
    valueFormat?: (v: number) => string
    signed?: boolean
    color?: string
    labelWidth?: number
  } = {},
): EChartsOption {
  const { valueFormat = (v: number) => v.toFixed(3), signed = true, color } = opts
  const sorted = [...rows].sort((a, b) => a.value - b.value)
  const vals = sorted.map((r) => r.value)
  const useColor = sorted.map((r) =>
    r.color ?? (signed ? (r.value >= 0 ? C.pos : C.neg) : (color ?? C.info)),
  )

  return {
    grid: { left: 4, right: 34, top: 4, bottom: 4, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      ...tooltipCommon,
      formatter: (p: unknown) => {
        const it = p as { name: string; value: number; dataIndex: number }
        const r = sorted[it.dataIndex]
        return `<div style="font-weight:600;color:${C.hi}">${it.name}</div>
                <div style="color:${C.dim};margin-top:3px">${valueFormat(it.value)}</div>
                ${r.sub ? `<div style="color:${C.mute};margin-top:3px;max-width:260px;white-space:normal">${r.sub}</div>` : ''}`
      },
    },
    xAxis: {
      type: 'value',
      ...axisCommon,
      splitLine: { ...axisCommon.splitLine, show: false },
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((r) => r.label),
      ...axisCommon,
      splitLine: { show: false },
      axisLabel: { ...axisCommon.axisLabel, fontSize: 10.5, color: C.base },
    },
    series: [
      {
        type: 'bar',
        data: vals.map((v, i) => ({ value: v, itemStyle: { color: useColor[i], borderRadius: [0, 2, 2, 0] } })),
        barMaxWidth: 13,
        label: {
          show: true,
          position: 'right' as const,
          formatter: (p: CallbackDataParams) => valueFormat(Number(p.value)),
          color: C.dim,
          fontFamily: MONO,
          fontSize: 10,
        },
      },
    ],
  }
}
