<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getTeamMembers } from '../api/org.api'
import { searchWikiTeams } from '../api/wiki.api'
import {
  getEfficiencyDashboard,
  getSkillUsageAccessScope,
  listGenerations,
  type EfficiencyDashboard,
  type EfficiencyFilters,
  type GenerationPage,
  type GenerationRow,
  type SkillUsageAccessScope,
} from '../api/skill-usage.api'

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const router = useRouter()
const scope = ref<SkillUsageAccessScope | null>(null)
const dashboard = ref<EfficiencyDashboard | null>(null)
const generations = ref<GenerationPage | null>(null)
const members = ref<Array<{ userId: number; displayName: string; username: string }>>([])
const teams = ref<SkillUsageAccessScope['teams']>([])
const selectedTeamId = ref<number | undefined>()
const selectedUserId = ref<number | undefined>()
const preset = ref('30d')
const fromDate = ref('')
const toDate = ref('')
const page = ref(1)
const loading = ref(false)
const teamSearchLoading = ref(false)
const memberLoading = ref(false)
const errorMessage = ref('')
const trendMetric = ref<'linesAdded' | 'totalTokens' | 'locPer1k' | 'activeUsers' | 'generations' | 'avgDuration'>('linesAdded')
const selectedGeneration = ref<GenerationRow | null>(null)
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined
let teamSearchRequestId = 0

const teamOptions = computed(() => teams.value)
const memberOptions = computed(() => members.value.map((member) => ({
  label: `${member.displayName}（${member.username}）`,
  value: member.userId,
})))

// ---- 图表配色 ----
const PALETTE = ['#26c6ff', '#0fb5ec', '#60a5fa', '#4dd2ff', '#34d399', '#a78bfa', '#fbbf24', '#8b9bb5']
const axisLabel = { color: '#8b9bb5', fontSize: 11 }
const splitLine = { lineStyle: { color: 'rgba(160,195,255,0.09)' } }

const trendRef = ref<HTMLElement | null>(null)
const stageBarRef = ref<HTMLElement | null>(null)
const teamBarRef = ref<HTMLElement | null>(null)
const projectBarRef = ref<HTMLElement | null>(null)
const skillBarRef = ref<HTMLElement | null>(null)
const fileTypeRef = ref<HTMLElement | null>(null)
const tokenPieRef = ref<HTMLElement | null>(null)
const chartInstances = new Set<echarts.ECharts>()

const trendMetricOptions = [
  { key: 'linesAdded', label: 'AI代码量' },
  { key: 'totalTokens', label: 'Token消耗' },
  { key: 'locPer1k', label: 'Token效率' },
  { key: 'activeUsers', label: '活跃开发者' },
  { key: 'generations', label: 'Generation数' },
  { key: 'avgDuration', label: '平均任务耗时' },
] as const

function mountChart(el: HTMLElement | null, option: echarts.EChartsCoreOption) {
  if (!el) return
  const existing = echarts.getInstanceByDom(el)
  const chart = existing ?? echarts.init(el)
  chartInstances.add(chart)
  chart.setOption(option, { notMerge: true })
}

function horizontalBar(labels: string[], values: number[], color = '#26c6ff') {
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
    series: [{ type: 'bar' as const, data: values, barMaxWidth: 14, itemStyle: { color, borderRadius: [0, 6, 6, 0] } }],
  }
}

function trendSeries(o: EfficiencyDashboard): { labels: string[]; values: number[]; name: string } {
  const t = o.trend
  const labels = t.map((i) => i.bucket)
  switch (trendMetric.value) {
    case 'totalTokens': return { labels, values: t.map((i) => i.totalTokens), name: 'Token消耗' }
    case 'activeUsers': return { labels, values: t.map((i) => i.activeUsers), name: '活跃开发者' }
    case 'generations': return { labels, values: t.map((i) => i.generations), name: 'Generation数' }
    case 'locPer1k': return { labels, values: t.map((i) => (i.totalTokens ? round2((i.linesAdded / i.totalTokens) * 1000) : 0)), name: 'Token效率 (LOC/1K)' }
    case 'avgDuration': return { labels, values: t.map((i) => (i.generations ? round2(i.totalTokens && 0) : 0)), name: '平均任务耗时' }
    default: return { labels, values: t.map((i) => i.linesAdded), name: 'AI代码量' }
  }
}

function renderCharts() {
  const o = dashboard.value
  if (!o) return

  const series = trendSeries(o)
  mountChart(trendRef.value, {
    tooltip: { trigger: 'axis' },
    grid: { left: 6, right: 6, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: series.labels, axisLine: { lineStyle: { color: 'rgba(160,195,255,0.20)' } }, axisLabel },
    yAxis: [{ type: 'value', splitLine, axisLabel }],
    series: [{ name: series.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: series.values, itemStyle: { color: '#26c6ff' }, lineStyle: { color: '#26c6ff', width: 2.5 }, areaStyle: { color: 'rgba(38,198,255,.12)' } }],
  })

  const top = (arr: typeof o.stageRanking, n: number) => arr.slice(0, n)
  mountChart(stageBarRef.value, horizontalBar(top(o.stageRanking, 8).map((i) => stageLabel(i.key)).reverse(), top(o.stageRanking, 8).map((i) => i.linesAdded).reverse(), '#60a5fa'))
  mountChart(teamBarRef.value, horizontalBar(top(o.teamRanking, 6).map((i) => i.name).reverse(), top(o.teamRanking, 6).map((i) => i.linesAdded).reverse()))
  mountChart(projectBarRef.value, horizontalBar(top(o.projectRanking, 6).map((i) => i.name).reverse(), top(o.projectRanking, 6).map((i) => i.linesAdded).reverse(), '#4dd2ff'))
  mountChart(skillBarRef.value, horizontalBar(top(o.skillRanking as unknown as Array<{ displayName: string }>, 8).map((i) => (i as unknown as { displayName: string; skillKey: string }).displayName || (i as unknown as { skillKey: string }).skillKey).reverse(), (o.skillRanking as unknown as Array<{ generations: number }>).slice(0, 8).map((i) => i.generations).reverse(), '#a78bfa'))

  const ft = o.fileTypes.slice(0, 8)
  mountChart(fileTypeRef.value, horizontalBar(ft.map((i) => i.category).reverse(), ft.map((i) => i.linesAdded).reverse(), '#34d399'))

  const tb = o.tokenBreakdown
  mountChart(tokenPieRef.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#8b9bb5', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['46%', '68%'], center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: '#0d1420', borderWidth: 2 },
      label: { show: false },
      data: [
        { name: '缓存命中', value: tb.cacheReadTokens, itemStyle: { color: '#34d399' } },
        { name: '缓存未命中', value: tb.cacheMissTokens, itemStyle: { color: '#fbbf24' } },
        { name: '缓存写入', value: tb.cacheWriteTokens, itemStyle: { color: '#60a5fa' } },
        { name: '思考 Token', value: tb.thinkingTokens, itemStyle: { color: '#a78bfa' } },
        { name: '回答 Token', value: tb.answerTokens, itemStyle: { color: '#26c6ff' } },
      ].filter((d) => d.value > 0),
    }],
  })
}

function onResize() { chartInstances.forEach((chart) => chart.resize()) }
watch([dashboard, trendMetric], async () => { await nextTick(); renderCharts() })

// ---- 业务逻辑 ----
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

function filterValues(): EfficiencyFilters {
  const from = fromDate.value ? new Date(`${fromDate.value}T00:00:00`).toISOString() : undefined
  const to = toDate.value ? new Date(`${toDate.value}T23:59:59.999`).toISOString() : undefined
  return { from, to, teamId: selectedTeamId.value, userId: selectedUserId.value }
}

function errorText(error: unknown, fallback: string) {
  return axios.isAxiosError(error) ? String(error.response?.data?.message ?? fallback) : fallback
}

async function loadTeams(keyword = '') {
  const requestId = ++teamSearchRequestId
  teamSearchLoading.value = true
  try {
    const result = await searchWikiTeams(keyword.trim(), 0, 50)
    if (requestId !== teamSearchRequestId) return
    const accessibleIds = new Set(scope.value?.teams.map((team) => team.id) ?? [])
    const currentIds = new Set([selectedTeamId.value].filter((id): id is number => typeof id === 'number'))
    const nextTeams = result.items
      .filter((team) => accessibleIds.has(team.id))
      .map((team) => ({ id: team.id, name: team.name, parentId: team.parentId }))
    teams.value = [
      ...nextTeams,
      ...teams.value.filter((team) => currentIds.has(team.id) && !nextTeams.some((item) => item.id === team.id)),
    ]
  } catch (error) {
    if (requestId === teamSearchRequestId) errorMessage.value = errorText(error, '团队加载失败，请稍后重试')
  } finally {
    if (requestId === teamSearchRequestId) teamSearchLoading.value = false
  }
}

function searchTeams(keyword = '') {
  if (teamSearchTimer) clearTimeout(teamSearchTimer)
  teamSearchTimer = setTimeout(() => { void loadTeams(keyword) }, 300)
}

async function loadMembers() {
  members.value = []
  selectedUserId.value = undefined
  if (!selectedTeamId.value) return
  memberLoading.value = true
  try {
    members.value = (await getTeamMembers(selectedTeamId.value)).map((item) => ({ userId: item.userId, displayName: item.displayName, username: item.username }))
  } catch (error) {
    errorMessage.value = errorText(error, '团队成员加载失败')
  } finally { memberLoading.value = false }
}

async function loadDashboard() {
  loading.value = true
  errorMessage.value = ''
  try {
    const filters = filterValues()
    const [nextDashboard, nextGenerations] = await Promise.all([
      getEfficiencyDashboard(filters),
      listGenerations(filters, page.value - 1, 20),
    ])
    dashboard.value = nextDashboard
    generations.value = nextGenerations
  } catch (error) {
    errorMessage.value = errorText(error, 'AI 研发效能数据加载失败，请检查管理员权限或稍后重试')
  } finally { loading.value = false }
}

function search() { page.value = 1; void loadDashboard() }
function changePage(next: number) { page.value = next; void loadDashboard() }

function formatTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }
function formatNumber(value: number | null | undefined) { return value == null ? '-' : value.toLocaleString('zh-CN') }
function formatTokens(value: number | null | undefined) {
  if (value == null) return '-'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}
function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}min`
}
function round2(value: number) { return Math.round(value * 100) / 100 }
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%` }

function stageLabel(stage: string | null | undefined) {
  return ({
    REQUIREMENT: '需求', PRODUCT: '产品', ARCHITECTURE_DESIGN: '架构设计', UI_DESIGN: 'UI设计',
    BACKEND_CODING: '后端编码', FRONTEND_CODING: '前端编码', SECURITY_REVIEW: '安全评审',
    TESTING: '测试', DEPLOYMENT: '部署', MULTI_STAGE: '多阶段', UNKNOWN: '未分类',
  } as Record<string, string>)[stage ?? 'UNKNOWN'] ?? stage ?? '未分类'
}
function statusTheme(status: string) { return status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : status === 'RUNNING' ? 'warning' : 'default' }
function statusLabel(status: string) { return ({ COMPLETED: '已完成', FAILED: '失败', RUNNING: '进行中', CANCELLED: '已取消', PARTIAL: '部分完成' } as Record<string, string>)[status] ?? status }
function qualityTheme(quality: string | null) { return quality === 'EXACT' ? 'success' : quality === 'PARTIAL' ? 'warning' : 'default' }

function goStage(stage: string) { void router.push({ name: 'skill-usage-stage', params: { stage } }) }
function goTeam(teamId: number) { void router.push({ name: 'skill-usage-team', params: { teamId } }) }
function goProject(projectKey: string | null) { if (projectKey) void router.push({ name: 'skill-usage-project', params: { projectKey } }) }
function goSkill(skillKey: string) { void router.push({ name: 'skill-usage-skill', params: { skillKey } }) }
function openGeneration(row: GenerationRow) { selectedGeneration.value = row }
function closeGeneration() { selectedGeneration.value = null }

watch(selectedTeamId, () => { void loadMembers() })
onMounted(async () => {
  applyPreset('30d')
  window.addEventListener('resize', onResize)
  try {
    scope.value = await getSkillUsageAccessScope()
    teams.value = scope.value.teams
    if (!scope.value.global && scope.value.teams.length) selectedTeamId.value = scope.value.teams[0].id
    await loadMembers()
    await loadDashboard()
  } catch (error) { errorMessage.value = errorText(error, '看板权限范围加载失败') }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chartInstances.forEach((chart) => chart.dispose())
  chartInstances.clear()
})
</script>

<template>
  <main class="usage-page">
    <header class="usage-heading usage-card">
      <div class="usage-heading__top">
        <p class="eyebrow">AI EFFICIENCY</p>
        <span v-if="scope?.global" class="scope-badge">超级管理员 · 全平台</span>
        <span v-else class="scope-badge">团队管理员 · {{ scope?.teams.length ?? 0 }} 个团队</span>
      </div>
      <div class="usage-heading__main">
        <div class="usage-heading__title">
          <h1>AI 研发效能看板</h1>
          <p>以 AI Generation 为事实中心，洞察 AI 代码产出、Token 消耗与研发阶段效能。</p>
        </div>
        <div class="usage-filters" aria-label="效能筛选">
          <div class="filter-row">
            <div class="preset-group"><button v-for="item in [{ key: 'today', label: '今天' }, { key: '7d', label: '近 7 天' }, { key: '30d', label: '近 30 天' }, { key: '90d', label: '近 90 天' }]" :key="item.key" :class="{ active: preset === item.key }" @click="applyPreset(item.key)">{{ item.label }}</button></div>
            <div class="date-range">
              <input v-model="fromDate" type="date" aria-label="开始日期" @change="preset = 'custom'" />
              <span class="date-sep">~</span>
              <input v-model="toDate" type="date" aria-label="结束日期" @change="preset = 'custom'" />
            </div>
          </div>
          <div class="filter-row">
            <t-select v-model="selectedTeamId" clearable filterable :loading="!scope || teamSearchLoading" placeholder="全部可见团队" :options="teamOptions.map((team) => ({ label: team.name, value: team.id }))" @search="searchTeams" />
            <t-select v-model="selectedUserId" clearable filterable :loading="memberLoading" placeholder="全部成员" :options="memberOptions" />
            <t-button theme="primary" :loading="loading" @click="search">查询</t-button>
          </div>
        </div>
      </div>
    </header>

    <p v-if="errorMessage" class="usage-alert" role="alert">{{ errorMessage }}</p>

    <template v-if="dashboard">
      <section class="summary-grid">
        <t-tooltip content="筛选范围内，AI 通过 Write/Edit 写入的代码行数（只统计新增行，不含删除）。" placement="top" theme="light">
          <article class="metric-card metric-card--success"><header><span>AI代码产出</span><i class="metric-dot"></i></header><strong>{{ formatNumber(dashboard.summary.linesAdded) }}</strong><small>行（新增）</small></article>
        </t-tooltip>
        <t-tooltip content="这些 Generation 累计消耗的大模型 Token 总数（输入+输出）。覆盖率=拿到精确 Token 数据的轮数占比，越高越可信。" placement="top" theme="light">
          <article class="metric-card metric-card--primary"><header><span>Token消耗</span><em class="metric-chip">Total</em></header><strong>{{ formatTokens(dashboard.summary.totalTokens) }}</strong><small>覆盖率 {{ formatPercent(dashboard.summary.tokenCoverageRate) }}</small></article>
        </t-tooltip>
        <t-tooltip content="在筛选范围内，至少产生过一轮 Generation 的去重开发者人数。" placement="top" theme="light">
          <article class="metric-card metric-card--info"><header><span>活跃开发者</span><i class="metric-dot"></i></header><strong>{{ dashboard.summary.activeUsers }}</strong><small>产生过 Generation</small></article>
        </t-tooltip>
        <t-tooltip content="每消耗 1000 个 Token 平均产出多少行新增代码。= 总新增行数 ÷ 总 Token × 1000（先求和再相除，不是逐轮平均），越高说明单位 Token 产码越多。" placement="top" theme="light">
          <article class="metric-card metric-card--success"><header><span>Token产码效率</span><em class="metric-chip">LOC</em></header><strong>{{ round2(dashboard.summary.locPer1kTokens) }}</strong><small>LOC / 1K Token</small></article>
        </t-tooltip>
        <t-tooltip content="一次 Generation = 一轮完整的 AI 任务（从发起 prompt 到结束）。这里是筛选范围内的总轮数；下方为平均每轮调用模型的次数。" placement="top" theme="light">
          <article class="metric-card metric-card--purple"><header><span>Generation数</span><em class="metric-chip">Calls</em></header><strong>{{ formatNumber(dashboard.summary.generations) }}</strong><small>平均 {{ round2(dashboard.summary.avgModelCalls) }} 次模型调用</small></article>
        </t-tooltip>
        <t-tooltip content="平均每轮 Generation 从发起到结束的耗时；下方为该范围内失败工具调用占总工具调用的比例。" placement="top" theme="light">
          <article class="metric-card metric-card--warning"><header><span>平均任务耗时</span><i class="metric-dot"></i></header><strong>{{ formatDuration(dashboard.summary.avgGenerationDurationMs) }}</strong><small>工具失败率 {{ formatPercent(dashboard.summary.toolFailureRate) }}</small></article>
        </t-tooltip>
      </section>

      <section class="usage-card">
        <div class="card-heading">
          <div><h2>AI 研发效能趋势</h2><p>按时间观察效能指标变化</p></div>
          <div class="metric-switch"><button v-for="m in trendMetricOptions" :key="m.key" :class="{ active: trendMetric === m.key }" @click="trendMetric = m.key">{{ m.label }}</button></div>
        </div>
        <div ref="trendRef" class="chart-box chart-tall"></div>
      </section>

      <section class="dashboard-grid dimension-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>研发阶段排行</h2><p>按 AI 代码量，点击进入阶段详情</p></div></div><div ref="stageBarRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="s in dashboard.stageRanking.slice(0, 5)" :key="s.key" @click="goStage(s.key)"><span>{{ stageLabel(s.key) }}</span><em>{{ formatNumber(s.linesAdded) }} 行 · {{ formatTokens(s.totalTokens) }}</em></li></ul>
        </article>
        <article class="usage-card"><div class="card-heading"><div><h2>团队排行</h2><p>按 AI 代码量，点击进入团队详情</p></div></div><div ref="teamBarRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="t in dashboard.teamRanking.slice(0, 5)" :key="t.key" @click="goTeam(Number(t.key))"><span>{{ t.name }}</span><em>{{ formatNumber(t.linesAdded) }} 行 · {{ t.users }} 人</em></li></ul>
        </article>
        <article class="usage-card"><div class="card-heading"><div><h2>项目排行</h2><p>按 AI 代码量，点击进入项目详情</p></div></div><div ref="projectBarRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="p in dashboard.projectRanking.slice(0, 5)" :key="p.key" @click="goProject(p.key)"><span>{{ p.name }}</span><em>{{ formatNumber(p.linesAdded) }} 行 · {{ p.generations }} 轮</em></li></ul>
        </article>
        <article class="usage-card"><div class="card-heading"><div><h2>Skill 洞察</h2><p>按 Generation 影响数，点击进入 Skill 详情</p></div></div><div ref="skillBarRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="s in dashboard.skillRanking.slice(0, 5)" :key="s.skillKey" @click="goSkill(s.skillKey)"><span>{{ s.displayName || s.skillKey }}</span><em>{{ s.generations }} 轮 · {{ s.invocations }} 次</em></li></ul>
        </article>
      </section>

      <section class="dashboard-grid dimension-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>文件类型</h2><p>AI 代码产出的文件类型结构</p></div></div><div ref="fileTypeRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>Token 结构</h2><p>缓存命中 / 思考 / 回答占比</p></div></div><div ref="tokenPieRef" class="chart-box"></div>
          <div class="token-breakdown">
            <div><span>输入</span><strong>{{ formatTokens(dashboard.tokenBreakdown.inputTokens) }}</strong></div>
            <div><span>输出</span><strong>{{ formatTokens(dashboard.tokenBreakdown.outputTokens) }}</strong></div>
            <div><span>缓存命中</span><strong>{{ formatTokens(dashboard.tokenBreakdown.cacheReadTokens) }}</strong></div>
            <div><span>思考</span><strong>{{ formatTokens(dashboard.tokenBreakdown.thinkingTokens) }}</strong></div>
          </div>
        </article>
      </section>
    </template>

    <section class="usage-card events-card">
      <div class="card-heading"><div><h2>Generation 明细</h2></div><span v-if="generations">共 {{ generations.totalElements }} 条</span></div>
      <t-table row-key="id" :data="generations?.items ?? []" :loading="loading" :columns="[
        { colKey: 'startedAt', title: '时间', width: 150 }, { colKey: 'member', title: '成员', width: 120 },
        { colKey: 'project', title: '项目', width: 130 }, { colKey: 'stage', title: '研发阶段', width: 100 },
        { colKey: 'skill', title: 'Skill', width: 160 }, { colKey: 'lines', title: '代码增量', width: 100 },
        { colKey: 'tokens', title: 'Token', width: 100 }, { colKey: 'efficiency', title: 'Token效率', width: 90 },
        { colKey: 'duration', title: '耗时', width: 90 }, { colKey: 'calls', title: 'Calls', width: 90 },
        { colKey: 'status', title: '状态', width: 90 },
      ]" bordered stripe>
        <template #startedAt="{ row }">{{ formatTime(row.startedAt) }}</template>
        <template #member="{ row }"><strong>{{ row.displayName }}</strong><small class="cell-subtitle">{{ row.teamNames || '未归属团队' }}</small></template>
        <template #project="{ row }"><a class="cell-link" @click="goProject(row.projectKey)">{{ row.projectName || '-' }}</a></template>
        <template #stage="{ row }"><t-tag variant="outline" @click="row.primaryStage && goStage(row.primaryStage)">{{ stageLabel(row.primaryStage) }}</t-tag></template>
        <template #skill="{ row }"><span v-if="row.skillKeys">{{ row.skillKeys }}</span><span v-else class="cell-subtitle">-</span></template>
        <template #lines="{ row }"><span class="lines-added">+{{ row.linesAdded }}</span> <span class="lines-deleted">-{{ row.linesDeleted }}</span></template>
        <template #tokens="{ row }">{{ formatTokens(row.totalTokens) }}<small class="cell-subtitle"><t-tag :theme="qualityTheme(row.tokenQuality)" size="small">{{ row.tokenQuality || 'N/A' }}</t-tag></small></template>
        <template #efficiency="{ row }">{{ row.totalTokens ? round2(row.locPer1kTokens) : '-' }}</template>
        <template #duration="{ row }">{{ formatDuration(row.durationMs) }}</template>
        <template #calls="{ row }"><small class="cell-subtitle">模型 {{ row.modelCallCount ?? '-' }} / 工具 {{ row.toolCallCount }}</small></template>
        <template #status="{ row }"><t-tag :theme="statusTheme(row.status)">{{ statusLabel(row.status) }}</t-tag></template>
      </t-table>
      <t-pagination v-if="generations && generations.totalElements" :current="page" :total="generations.totalElements" :page-size="20" :total-content="false" show-jumper @change="changePage" />
    </section>
  </main>
</template>

<style scoped>
.usage-page{width:min(100%,1360px);margin:0 auto;color:var(--text-1)}

/* ---------- 头部卡片：标题 + 筛选（右上） ---------- */
.usage-heading{display:block;margin-bottom:14px}
.usage-heading__top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--border-1)}
.usage-heading .eyebrow{display:flex;align-items:center;gap:7px;margin:0;font-size:12px;font-weight:600;letter-spacing:.1em;color:var(--accent-400)}
.usage-heading .eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent-500)}
.usage-heading__main{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;flex-wrap:wrap}
.usage-heading__title h1{margin:0 0 6px;font-size:27px;font-weight:700;color:var(--text-1);letter-spacing:-0.02em}
.usage-heading__title p{margin:0;color:var(--text-2);font-size:13px;max-width:520px;line-height:1.6}
.scope-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border-accent);border-radius:999px;color:var(--accent-300);background:var(--accent-soft);font-size:12px;white-space:nowrap}

.usage-alert{margin:0 0 14px;padding:12px 14px;border:1px solid rgb(251 191 36 / 30%);border-radius:9px;color:var(--warning);background:var(--warning-soft)}

/* ---------- 筛选组（头部右侧） ---------- */
.usage-filters{display:flex;flex-direction:column;gap:10px;min-width:300px}
.filter-row{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.preset-group{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--border-1);border-radius:999px;background:var(--surface-2)}
.preset-group button{height:28px;padding:0 13px;border:0;border-radius:999px;color:var(--text-2);background:transparent;font:inherit;font-size:12px;cursor:pointer;transition:all .15s ease;white-space:nowrap}
.preset-group button:hover{color:var(--text-1)}
.preset-group button.active{color:var(--accent-300);background:var(--surface-1);box-shadow:0 1px 4px rgb(0 0 0 / 8%),inset 0 0 0 1px var(--border-accent);font-weight:600}
.date-range{display:inline-flex;align-items:center;gap:5px;padding:0 10px;height:34px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-2)}
.date-range input{height:100%;padding:0;border:0;color:var(--text-1);background:transparent;font:inherit;font-size:12px;outline:none;width:118px}
.date-sep{color:var(--text-3);font-size:12px}
.usage-filters .t-select{width:172px}

/* ---------- 指标卡：突出大数字 ---------- */
.summary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:14px}
.metric-card{position:relative;display:grid;align-content:start;gap:7px;min-height:112px;padding:16px 18px 14px;border:1px solid var(--border-1);border-radius:12px;background:var(--surface-1);box-shadow:var(--inner-highlight);backdrop-filter:blur(12px);overflow:hidden;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;cursor:help}
.metric-card::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:99px;background:var(--metric,var(--accent-500));opacity:.85}
.metric-card:hover{border-color:var(--border-3);box-shadow:var(--shadow-md);transform:translateY(-2px)}
.metric-card header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.metric-card header span{color:var(--text-2);font-size:12px}
.metric-card strong{color:var(--text-1);font-size:31px;font-weight:750;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums}
.metric-card small{color:var(--text-3);font-size:11px}
.metric-dot{width:8px;height:8px;border-radius:50%;background:var(--metric,var(--accent-500))}
.metric-chip{padding:2px 8px;border-radius:999px;color:var(--metric,var(--accent-400));background:color-mix(in srgb,var(--metric,var(--accent-500)) 14%,transparent);font-size:10px;font-style:normal;font-weight:600;letter-spacing:.02em}
.metric-card--primary{--metric:var(--accent-500)}
.metric-card--info{--metric:#60a5fa}
.metric-card--success{--metric:var(--success)}
.metric-card--purple{--metric:var(--purple)}
.metric-card--warning{--metric:var(--badge-accent)}

.usage-card{min-width:0;padding:16px 18px;border:1px solid var(--border-1);border-radius:12px;background:var(--surface-1);box-shadow:var(--inner-highlight);backdrop-filter:blur(12px);margin-bottom:14px}
.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.card-heading h2{font-size:15px;margin:0;color:var(--text-1)}
.card-heading p{margin:4px 0 0;color:var(--text-3);font-size:11px}
.card-heading span{color:var(--text-3);font-size:11px}

/* 趋势指标分段控件 */
.metric-switch{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border:1px solid var(--border-1);border-radius:999px;background:var(--surface-2)}
.metric-switch button{height:26px;padding:0 12px;border:0;border-radius:999px;color:var(--text-2);background:transparent;font-size:11.5px;cursor:pointer;transition:all .15s ease;white-space:nowrap}
.metric-switch button:hover{color:var(--text-1)}
.metric-switch button.active{color:var(--accent-300);background:var(--surface-1);box-shadow:0 1px 4px rgb(0 0 0 / 8%),inset 0 0 0 1px var(--border-accent);font-weight:600}

.dashboard-grid{display:grid;gap:14px;margin-bottom:0}
.dimension-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.chart-box{width:100%;height:200px}
.chart-tall{height:300px}
.rank-list{list-style:none;margin:8px 0 0;padding:8px 0 0;border-top:1px solid var(--border-1);display:grid;gap:2px}
.rank-list li{display:flex;justify-content:space-between;gap:8px;padding:5px 6px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--text-2)}
.rank-list li:hover{background:var(--surface-2);color:var(--text-1)}
.rank-list em{font-style:normal;color:var(--text-3);font-size:11px}
.token-breakdown{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-1)}
.token-breakdown div{display:grid;gap:2px}
.token-breakdown span{color:var(--text-3);font-size:11px}
.token-breakdown strong{color:var(--text-1);font-size:15px}
.events-card{margin-top:0}
.cell-subtitle{display:block;color:var(--text-3);font-size:11px}
.cell-link{color:var(--accent-300);cursor:pointer}
.lines-added{color:var(--success);font-weight:600}
.lines-deleted{color:var(--error);font-weight:600}
@media(max-width:1100px){.summary-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.dimension-grid{grid-template-columns:1fr}.usage-heading__main{flex-direction:column}.usage-filters{min-width:0;width:100%}.filter-row{justify-content:flex-start}}
@media(max-width:760px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.usage-heading__title h1{font-size:23px}}
</style>
