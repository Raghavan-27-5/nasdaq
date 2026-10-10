import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart, HeatmapChart, CandlestickChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  AxisPointerComponent,
  VisualMapComponent,
  GraphicComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { C, MONO } from '@/lib/palette'

// Tree-shaken registration - importing all of echarts would roughly triple
// the bundle for components this app never uses.
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  HeatmapChart,
  CandlestickChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  AxisPointerComponent,
  VisualMapComponent,
  GraphicComponent,
  TitleComponent,
  CanvasRenderer,
])

/** Neutral ECharts theme so charts inherit the app's visual language. */
const BASE = {
  backgroundColor: 'transparent',
  animation: true,
  animationDuration: 420,
  animationEasing: 'cubicOut' as const,
  textStyle: { fontFamily: MONO, color: C.base },
}

// The full option type is imported from `echarts` (types are erased at build
// time, so this costs nothing at runtime) rather than composed from the
// tree-shaken core, which does not re-export the option namespaces.
import type { EChartsCoreOption, EChartsOption } from 'echarts'

export function EChart({
  option,
  height = 260,
  className,
  onEvent,
}: {
  option: EChartsOption
  height?: number | string
  className?: string
  onEvent?: Record<string, (params: unknown) => void>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const instRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const inst = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    instRef.current = inst

    const ro = new ResizeObserver(() => inst.resize())
    ro.observe(ref.current)

    return () => {
      ro.disconnect()
      inst.dispose()
      instRef.current = null
    }
  }, [])

  useEffect(() => {
    const inst = instRef.current
    if (!inst) return
    inst.setOption({ ...BASE, ...option } as EChartsCoreOption, true)
  }, [option])

  useEffect(() => {
    const inst = instRef.current
    if (!inst || !onEvent) return
    for (const [name, fn] of Object.entries(onEvent)) {
      inst.on(name, fn)
    }
    return () => {
      for (const name of Object.keys(onEvent)) inst.off(name)
    }
  }, [onEvent])

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height, minHeight: 0 }}
      role="img"
    />
  )
}

export { echarts }
export type { EChartsOption }
