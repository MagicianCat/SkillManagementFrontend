import { onBeforeUnmount, ref } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EfficiencyFilters } from '../api/skill-usage.api'
import { chartTheme, onThemeChange } from '../../utils/theme'

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

function colors() { return chartTheme() }

export function useEfficiencyCharts() {
  const chartInstances = new Set<echarts.ECharts>()
  const builders = new Map<HTMLElement, () => echarts.EChartsCoreOption>()

  function mount(el: HTMLElement | null, option: echarts.EChartsCoreOption) {
    if (!el) return
    const existing = echarts.getInstanceByDom(el)
    const chart = existing ?? echarts.init(el)
    chartInstances.add(chart)
    chart.setOption(option, { notMerge: true })
  }

  /** 挂载并注册 option-builder，主题切换时用新配色自动重渲 */
  function mountReactive(el: HTMLElement | null, build: () => echarts.EChartsCoreOption) {
    if (!el) return
    builders.set(el, build)
    mount(el, build())
  }

  function horizontalBar(labels: string[], values: number[], color?: string) {
    const c = colors()
    const axisLabel = { color: c.axisLabel, fontSize: 11 }
    const splitLine = { lineStyle: { color: c.splitLine } }
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 6, right: 34, top: 6, bottom: 2, containLabel: true },
      xAxis: { type: 'value' as const, splitLine, axisLabel },
      yAxis: {
        type: 'category' as const,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabel, width: 118, overflow: 'truncate' },
      },
      series: [{ type: 'bar' as const, data: values, barMaxWidth: 14, itemStyle: { color: color ?? c.primary, borderRadius: [0, 6, 6, 0] } }],
    }
  }

  function trendLine(labels: string[], values: number[], name: string) {
    const c = colors()
    const axisLabel = { color: c.axisLabel, fontSize: 11 }
    const splitLine = { lineStyle: { color: c.splitLine } }
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 6, right: 6, top: 30, bottom: 4, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: c.axisLine } }, axisLabel },
      yAxis: [{ type: 'value', splitLine, axisLabel }],
      series: [{ name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: values, itemStyle: { color: c.primary }, lineStyle: { color: c.primary, width: 2.5 }, areaStyle: { color: c.primaryArea } }],
    }
  }

  function donut(data: Array<{ name: string; value: number }>) {
    const c = colors()
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: c.axisLabel, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['46%', '68%'], center: ['50%', '42%'],
        itemStyle: { borderRadius: 6, borderColor: c.donutBorder, borderWidth: 2 },
        label: { show: false },
        data: data.filter((d) => d.value > 0).map((d, idx) => ({ ...d, itemStyle: { color: c.palette[idx % c.palette.length] } })),
      }],
    }
  }

  /** 主题切换时重跑所有 builder，用新配色重渲 */
  function refreshTheme() {
    builders.forEach((build, el) => {
      const chart = echarts.getInstanceByDom(el)
      if (chart) chart.setOption(build(), { notMerge: true })
    })
  }

  function resize() { chartInstances.forEach((chart) => chart.resize()) }
  function dispose() {
    unsubscribeTheme()
    chartInstances.forEach((chart) => chart.dispose())
    chartInstances.clear()
    builders.clear()
  }

  const unsubscribeTheme = onThemeChange(() => refreshTheme())

  return { mount, mountReactive, horizontalBar, trendLine, donut, resize, dispose, refreshTheme }
}

export function useEfficiencyPage() {
  const preset = ref('30d')
  const fromDate = ref('')
  const toDate = ref('')
  const loading = ref(false)
  const errorMessage = ref('')

  function localDate(value: Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function applyPreset(value: string) {
    preset.value = value
    const now = new Date()
    const start = new Date(now)
    if (value === 'today') start.setHours(0, 0, 0, 0)
    else start.setDate(now.getDate() - Number(value.replace('d', '')))
    fromDate.value = localDate(start)
    toDate.value = localDate(now)
  }

  function filters(): EfficiencyFilters {
    const from = fromDate.value ? new Date(`${fromDate.value}T00:00:00`).toISOString() : undefined
    const to = toDate.value ? new Date(`${toDate.value}T23:59:59.999`).toISOString() : undefined
    return { from, to }
  }

  function errorText(error: unknown, fallback: string) {
    return axios.isAxiosError(error) ? String(error.response?.data?.message ?? fallback) : fallback
  }

  return { preset, fromDate, toDate, loading, errorMessage, applyPreset, filters, errorText }
}

export function formatNumber(value: number | null | undefined) { return value == null ? '-' : value.toLocaleString('zh-CN') }
export function formatTokens(value: number | null | undefined) {
  if (value == null) return '-'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}
export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}min`
}
export function round2(value: number | null | undefined) { return value == null ? '-' : Math.round(value * 100) / 100 }
export function formatPercent(value: number | null | undefined) { return value == null ? '-' : `${(value * 100).toFixed(1)}%` }
export function formatTime(value: string | null | undefined) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }

export function stageLabel(stage: string | null | undefined) {
  return ({
    REQUIREMENT: '需求', PRODUCT: '产品', ARCHITECTURE_DESIGN: '架构设计', UI_DESIGN: 'UI设计',
    BACKEND_CODING: '后端编码', FRONTEND_CODING: '前端编码', SECURITY_REVIEW: '安全评审',
    TESTING: '测试', DEPLOYMENT: '部署', MULTI_STAGE: '多阶段', UNKNOWN: '未分类',
  } as Record<string, string>)[stage ?? 'UNKNOWN'] ?? stage ?? '未分类'
}

export function onChartsUnmount(dispose: () => void) {
  onBeforeUnmount(() => { window.removeEventListener('resize', () => {}); dispose() })
}
