<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts/core'
import { BarChart, FunnelChart, LineChart, PieChart } from 'echarts/charts'
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
  getSkillUsageAccessScope,
  getSkillUsageConversation,
  getSkillUsageOverview,
  listSkillUsageEvents,
  type SkillUsageAccessScope,
  type SkillUsageConversation,
  type SkillUsageEvent,
  type SkillUsageFilters,
  type SkillUsageOverview,
} from '../api/skill-usage.api'

echarts.use([LineChart, BarChart, PieChart, FunnelChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

const scope = ref<SkillUsageAccessScope | null>(null)
const overview = ref<SkillUsageOverview | null>(null)
const events = ref<{ items: SkillUsageEvent[]; page: number; size: number; totalElements: number; totalPages: number } | null>(null)
const members = ref<Array<{ userId: number; displayName: string; username: string }>>([])
const teams = ref<SkillUsageAccessScope['teams']>([])
const selectedTeamId = ref<number | undefined>()
const selectedUserId = ref<number | undefined>()
const skillKey = ref('')
const preset = ref('30d')
const fromDate = ref('')
const toDate = ref('')
const page = ref(1)
const loading = ref(false)
const teamSearchLoading = ref(false)
const memberLoading = ref(false)
const errorMessage = ref('')
const selectedEvent = ref<SkillUsageEvent | null>(null)
const conversation = ref<SkillUsageConversation | null>(null)
const conversationLoading = ref(false)
const conversationError = ref('')
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined
let teamSearchRequestId = 0

const teamOptions = computed(() => teams.value)
const memberOptions = computed(() => members.value.map((member) => ({
  label: `${member.displayName}（${member.username}）`,
  value: member.userId,
})))

// ---- 图表数据派生（泰康橙企业级配色） ----
const PALETTE = ['#e86600', '#ff7a00', '#ff9a3d', '#c25400', '#ffc28a', '#b34a00', '#11875d', '#94a3b8']
const axisLabel = { color: '#7a6a58', fontSize: 11 }
const splitLine = { lineStyle: { color: '#f1e8dc' } }

const activeSkills = computed(() => [...(overview.value?.skills ?? [])].sort((a, b) => b.calls - a.calls).slice(0, 8))
const lowUseSkills = computed(() => [...(overview.value?.skills ?? [])].sort((a, b) => a.calls - b.calls).slice(0, 4))

// ---- ECharts 实例管理 ----
const trendRef = ref<HTMLElement | null>(null)
const timeBandRef = ref<HTMLElement | null>(null)
const skillBarRef = ref<HTMLElement | null>(null)
const categoryPieRef = ref<HTMLElement | null>(null)
const funnelRef = ref<HTMLElement | null>(null)
const teamBarRef = ref<HTMLElement | null>(null)
const projectBarRef = ref<HTMLElement | null>(null)
const memberBarRef = ref<HTMLElement | null>(null)
const clientPieRef = ref<HTMLElement | null>(null)
const chartInstances = new Set<echarts.ECharts>()

function mountChart(el: HTMLElement | null, option: echarts.EChartsCoreOption) {
  if (!el) return
  const existing = echarts.getInstanceByDom(el)
  const chart = existing ?? echarts.init(el)
  chartInstances.add(chart)
  chart.setOption(option, { notMerge: true })
}

function horizontalBar(labels: string[], values: number[], extra?: Record<string, string[]>) {
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
    series: [{
      type: 'bar' as const,
      data: values,
      barMaxWidth: 14,
      itemStyle: { color: '#e86600', borderRadius: [0, 6, 6, 0] },
      ...(extra ?? {}),
    }],
  }
}

function renderCharts() {
  const o = overview.value
  if (!o) return

  // 1. 总体使用趋势（双序列折线）
  mountChart(trendRef.value, {
    tooltip: { trigger: 'axis' },
    legend: { right: 0, top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#7a6a58', fontSize: 11 } },
    grid: { left: 6, right: 6, top: 34, bottom: 4, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: o.trend.map((i) => i.bucket), axisLine: { lineStyle: { color: '#dfcfb8' } }, axisLabel },
    yAxis: [
      { type: 'value', splitLine, axisLabel, name: '调用', nameTextStyle: { color: '#b5a48e', fontSize: 10 } },
      { type: 'value', splitLine: { show: false }, axisLabel: { show: false } },
    ],
    series: [
      { name: '调用次数', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, data: o.trend.map((i) => i.calls), itemStyle: { color: '#e86600' }, lineStyle: { color: '#e86600', width: 2.5 }, areaStyle: { color: 'rgba(255,122,0,.10)' } },
      { name: '活跃成员', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'none', data: o.trend.map((i) => i.activeUsers), itemStyle: { color: '#94a3b8' }, lineStyle: { color: '#b5a48e', width: 1.6, type: 'dashed' } },
    ],
  })

  // 2. 调用时段分布（纵向柱状）
  mountChart(timeBandRef.value, {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 6, right: 6, top: 18, bottom: 2, containLabel: true },
    xAxis: { type: 'category', data: o.timeBands.map((i) => i.band), axisLine: { lineStyle: { color: '#dfcfb8' } }, axisLabel: { ...axisLabel, interval: 0, rotate: o.timeBands.length > 6 ? 24 : 0 } },
    yAxis: { type: 'value', splitLine, axisLabel },
    series: [{ type: 'bar', data: o.timeBands.map((i) => i.calls), barMaxWidth: 22, itemStyle: { borderRadius: [6, 6, 0, 0], color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ff9a3d' }, { offset: 1, color: '#e86600' }] } } }],
  })

  // 3. 热门 Skill（横向条形）
  mountChart(skillBarRef.value, horizontalBar(activeSkills.value.map((i) => i.displayName || i.skillKey).reverse(), activeSkills.value.map((i) => i.calls).reverse()))

  // 4. Skill 类别结构（环形）
  const cats = o.categories
  mountChart(categoryPieRef.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#7a6a58', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['52%', '72%'], center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: cats.slice(0, 6).map((i, idx) => ({ name: i.name, value: i.calls, itemStyle: { color: PALETTE[idx % PALETTE.length] } })),
    }],
    graphic: [{ type: 'text', left: 'center', top: '38%', style: { text: String(cats.reduce((s, i) => s + i.calls, 0)), fill: '#2a2118', fontSize: 20, fontWeight: 700, textAlign: 'center', textVerticalAlign: 'middle' } }],
  })

  // 5. 使用覆盖漏斗
  const summary = o.summary
  mountChart(funnelRef.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [{
      type: 'funnel', left: '6%', width: '88%', top: 8, bottom: 8, gap: 4,
      label: { show: true, position: 'inside', color: '#fff', formatter: '{b}  {c}', fontSize: 11 },
      itemStyle: { borderRadius: 4 },
      data: [
        { name: 'Skill 调用', value: summary.calls, itemStyle: { color: '#e86600' } },
        { name: '活跃成员', value: summary.activeUsers, itemStyle: { color: '#ff9a3d' } },
        { name: '使用 Skill', value: summary.skills, itemStyle: { color: '#ffc28a' } },
      ],
    }],
  })

  // 6. 部门 / 项目 / 成员（横向条形）
  mountChart(teamBarRef.value, horizontalBar(o.teams.slice(0, 6).map((i) => i.name).reverse(), o.teams.slice(0, 6).map((i) => i.calls).reverse()))
  mountChart(projectBarRef.value, horizontalBar(o.projects.slice(0, 6).map((i) => shortPathLabel(i.name)).reverse(), o.projects.slice(0, 6).map((i) => i.calls).reverse()))
  mountChart(memberBarRef.value, horizontalBar(o.members.slice(0, 6).map((i) => i.displayName).reverse(), o.members.slice(0, 6).map((i) => i.calls).reverse()))

  // 7. 客户端分布（环形）
  const clients = o.clients
  mountChart(clientPieRef.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#7a6a58', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['52%', '72%'], center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: clients.slice(0, 5).map((i, idx) => ({ name: i.name, value: i.calls, itemStyle: { color: PALETTE[idx % PALETTE.length] } })),
    }],
  })
}

function shortPathLabel(value: string) {
  const parts = value.split('/').filter(Boolean)
  return parts.at(-1) || value || 'UNKNOWN'
}

function onResize() {
  chartInstances.forEach((chart) => chart.resize())
}

watch(overview, async () => { await nextTick(); renderCharts() })

// ---- 业务逻辑（保持不变） ----
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

function filterValues(): SkillUsageFilters {
  const from = fromDate.value ? new Date(`${fromDate.value}T00:00:00`).toISOString() : undefined
  const to = toDate.value ? new Date(`${toDate.value}T23:59:59.999`).toISOString() : undefined
  return { from, to, teamId: selectedTeamId.value, userId: selectedUserId.value, skillKey: skillKey.value.trim() || undefined }
}

function errorText(error: unknown, fallback: string) {
  return axios.isAxiosError(error) ? String(error.response?.data?.message ?? fallback) : fallback
}

async function loadTeams(keyword = '') {
  const requestId = ++teamSearchRequestId
  teamSearchLoading.value = true
  try {
    const page = await searchWikiTeams(keyword.trim(), 0, 50)
    if (requestId !== teamSearchRequestId) return
    const accessibleIds = new Set(scope.value?.teams.map((team) => team.id) ?? [])
    const currentIds = new Set([selectedTeamId.value].filter((id): id is number => typeof id === 'number'))
    const nextTeams = page.items
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
    const [nextOverview, nextEvents] = await Promise.all([
      getSkillUsageOverview(filters),
      listSkillUsageEvents(filters, page.value - 1, 20),
    ])
    overview.value = nextOverview
    events.value = nextEvents
  } catch (error) {
    errorMessage.value = errorText(error, 'Skill 使用数据加载失败，请检查管理员权限或稍后重试')
  } finally { loading.value = false }
}

function search() { page.value = 1; void loadDashboard() }
function changePage(next: number) { page.value = next; void loadDashboard() }
function formatTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-' }
function shortPath(value: string) { const parts = value.split('/').filter(Boolean); return parts.at(-1) || value || 'UNKNOWN' }
function statusLabel(status: string) { return ({ MERGED: '已合并', STAGED: '处理中', FAILED: '采集失败', NOT_PROVIDED: '未提供', NOT_AVAILABLE: '不可用' } as Record<string, string>)[status] ?? status }
function statusTheme(status: string) { return status === 'MERGED' ? 'success' : status === 'FAILED' ? 'danger' : status === 'STAGED' ? 'warning' : 'default' }

async function openConversation(event: SkillUsageEvent) {
  selectedEvent.value = event
  conversation.value = null
  conversationError.value = ''
  conversationLoading.value = true
  try {
    conversation.value = await getSkillUsageConversation(event.eventId)
  } catch (error) {
    conversationError.value = errorText(error, '对话加载失败，请稍后重试')
  } finally { conversationLoading.value = false }
}

function closeConversation() { selectedEvent.value = null; conversation.value = null }

async function retryConversation() {
  if (selectedEvent.value) await openConversation(selectedEvent.value)
}

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
    <header class="usage-heading">
      <div><p class="eyebrow">SKILL TELEMETRY</p><h1>Skill 使用看板</h1><p>查看授权范围内的 Skill 使用趋势、成员活跃度和采集状态。</p></div>
      <span v-if="scope?.global" class="scope-badge">超级管理员 · 全平台</span>
      <span v-else class="scope-badge">团队管理员 · {{ scope?.teams.length ?? 0 }} 个团队</span>
    </header>

    <p v-if="errorMessage" class="usage-alert" role="alert">{{ errorMessage }}</p>
    <section class="usage-filters" aria-label="Skill 使用筛选">
      <div class="preset-group"><button v-for="item in [{ key: 'today', label: '今天' }, { key: '7d', label: '近 7 天' }, { key: '30d', label: '近 30 天' }, { key: '90d', label: '近 90 天' }]" :key="item.key" :class="{ active: preset === item.key }" @click="applyPreset(item.key)">{{ item.label }}</button></div>
      <label>开始日期<input v-model="fromDate" type="date" @change="preset = 'custom'" /></label>
      <label>结束日期<input v-model="toDate" type="date" @change="preset = 'custom'" /></label>
      <t-select v-model="selectedTeamId" clearable filterable :loading="!scope || teamSearchLoading" placeholder="全部可见团队" :options="teamOptions.map((team) => ({ label: team.name, value: team.id }))" @search="searchTeams" />
      <t-select v-model="selectedUserId" clearable filterable :loading="memberLoading" placeholder="全部成员" :options="memberOptions" />
      <t-input v-model="skillKey" clearable placeholder="Skill 名称" @enter="search" />
      <t-button theme="primary" :loading="loading" @click="search">查询</t-button>
    </section>

    <template v-if="overview">
      <section class="summary-grid">
        <article><span>调用次数</span><strong>{{ overview.summary.calls }}</strong><small>当前筛选范围</small></article>
        <article><span>活跃成员</span><strong>{{ overview.summary.activeUsers }}</strong><small>产生过调用的成员</small></article>
        <article><span>使用 Skill</span><strong>{{ overview.summary.skills }}</strong><small>产生过调用的 Skill</small></article>
        <article><span>人均调用</span><strong>{{ overview.summary.activeUsers ? (overview.summary.calls / overview.summary.activeUsers).toFixed(1) : '0.0' }}</strong><small>每位活跃成员平均调用次数</small></article>
      </section>

      <section class="dashboard-grid trend-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>Skill 调用趋势</h2><p>按时间观察平台 Skill 使用量变化</p></div></div><div ref="trendRef" class="chart-box chart-tall"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>调用时段分布</h2><p>北京时间，识别研发使用高峰</p></div></div><div ref="timeBandRef" class="chart-box chart-tall"></div></article>
      </section>

      <section class="dashboard-grid insight-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>热门 Skill Top 8</h2><p>按调用次数排序，定位高频能力</p></div></div><div ref="skillBarRef" class="chart-box"></div><p v-if="lowUseSkills.length" class="low-use-note">低使用 / 沉睡 Skill：<span v-for="s in lowUseSkills" :key="s.skillKey">{{ s.displayName || s.skillKey }}</span></p><p v-else class="empty-state">暂无 Skill 数据</p></article>
        <article class="usage-card"><div class="card-heading"><div><h2>Skill 类别结构</h2><p>分析研发能力领域的使用占比</p></div></div><div ref="categoryPieRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>使用覆盖漏斗</h2><p>调用量 → 成员覆盖 → Skill 覆盖</p></div></div><div ref="funnelRef" class="chart-box"></div></article>
      </section>

      <section class="dashboard-grid dimension-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>团队活跃度 Top 6</h2><p>比较团队调用量</p></div></div><div ref="teamBarRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>项目使用 Top 6</h2><p>按工作目录识别 Skill 落地项目</p></div></div><div ref="projectBarRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>成员活跃度 Top 6</h2><p>调用量与个人 Skill 广度</p></div></div><div ref="memberBarRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>客户端分布</h2><p>不同 Coding Agent 的调用占比</p></div></div><div ref="clientPieRef" class="chart-box"></div></article>
      </section>
    </template>

    <section class="usage-card events-card"><div class="card-heading"><div><h2>调用明细</h2></div><span v-if="events">共 {{ events.totalElements }} 条</span></div><t-table row-key="eventId" :data="events?.items ?? []" :loading="loading" :columns="[{ colKey: 'invokedAt', title: '调用时间', width: 170 }, { colKey: 'member', title: '成员', width: 140 }, { colKey: 'skill', title: 'Skill', width: 180 }, { colKey: 'project', title: '项目目录', width: 160 }, { colKey: 'client', title: '客户端', width: 130 }, { colKey: 'conversation', title: '对话状态', width: 120 }, { colKey: 'action', title: '操作', width: 120 }]" bordered stripe>
      <template #invokedAt="{ row }">{{ formatTime(row.invokedAt) }}</template>
      <template #member="{ row }"><strong>{{ row.displayName }}</strong><small class="cell-subtitle">{{ row.username }}</small></template>
      <template #skill="{ row }"><strong>{{ row.skillDisplayName || row.skillKey }}</strong><small class="cell-subtitle">{{ row.skillKey }}{{ row.version ? ` · v${row.version}` : '' }}</small></template>
      <template #project="{ row }"><span :title="row.localDirectory">{{ shortPath(row.localDirectory) }}</span><small class="cell-subtitle">{{ row.teamNames || '未归属团队' }}</small></template>
      <template #client="{ row }">{{ row.client }}<small class="cell-subtitle">{{ row.model || row.agentType || '-' }}</small></template>
      <template #conversation="{ row }"><t-tag :theme="statusTheme(row.conversationStatus)">{{ statusLabel(row.conversationStatus) }}</t-tag><small class="cell-subtitle">{{ row.messageCount }} 条消息</small></template>
      <template #action="{ row }"><t-button variant="text" :disabled="!row.conversationAvailable" @click="openConversation(row)">{{ row.conversationAvailable ? '查看对话' : '暂无对话' }}</t-button></template>
    </t-table><t-pagination v-if="events && events.totalElements" :current="page" :total="events.totalElements" :page-size="20" :total-content="false" show-jumper @change="changePage" />
    </section>

    <div v-if="selectedEvent" class="conversation-mask" @click.self="closeConversation"><aside class="conversation-drawer" role="dialog" aria-modal="true" aria-labelledby="conversation-title"><button class="drawer-close" aria-label="关闭" @click="closeConversation">×</button><p class="eyebrow">SESSION CONVERSATION</p><h2 id="conversation-title">{{ selectedEvent.displayName }} · {{ selectedEvent.skillKey }}</h2><p class="drawer-meta">{{ formatTime(selectedEvent.invokedAt) }} · 当前 Session 最新合并对话</p><div v-if="conversationLoading" class="drawer-state">对话加载中…</div><div v-else-if="conversationError" class="drawer-state error">{{ conversationError }}<button class="retry-button" @click="retryConversation">重试</button></div><div v-else-if="conversation?.status !== 'AVAILABLE'" class="drawer-state">该 Session 暂无可用对话文件</div><div v-else class="messages"><div v-for="(message, index) in conversation.messages" :key="message.id || index" class="message" :class="message.role === 'user' ? 'message-user' : 'message-assistant'"><span>{{ message.role === 'user' ? '用户' : 'CodeBuddy' }}</span><pre>{{ message.content || '' }}</pre><small v-if="message.createdAt">{{ formatTime(message.createdAt) }}</small></div></div></aside></div>
  </main>
</template>

<style scoped>
.usage-page{width:min(100%,1360px);margin:0 auto;color:#172033}
.usage-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:14px}
.usage-heading h1{margin:5px 0 8px;font-size:28px}
.usage-heading p:not(.eyebrow){margin:0;color:#64748b;font-size:13px}
.scope-badge{padding:8px 12px;border:1px solid #ffd9a3;border-radius:999px;color:#b34a00;background:#fff6ec;font-size:12px;white-space:nowrap}
.usage-alert{margin:12px 0;padding:12px 14px;border-radius:9px;color:#9a3412;background:#fff1e0}
.usage-filters{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:13px;border:1px solid #eadfce;border-radius:13px;background:#fff}
.usage-filters label{display:grid;gap:4px;color:#64748b;font-size:11px}
.usage-filters input{height:32px;padding:0 8px;border:1px solid #d8cbbb;border-radius:6px;color:#334155;background:#fff;font:inherit;font-size:12px}
.usage-filters .t-select{width:170px}
.usage-filters .t-input{width:170px}
.preset-group{display:flex;gap:4px}
.preset-group button{height:32px;padding:0 10px;border:1px solid #eadfce;border-radius:6px;color:#64748b;background:#fff;font:inherit;font-size:12px;cursor:pointer}
.preset-group button.active{border-color:#e86600;color:#b34a00;background:#fff1e0}
.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.summary-grid article{display:grid;min-height:92px;gap:8px;padding:14px 16px;border:1px solid #eadfce;border-radius:10px;background:#fff;box-shadow:0 4px 14px rgb(216 90 0 / 4%)}
.summary-grid span,.summary-grid small{color:#64748b;font-size:12px}
.summary-grid strong{color:#172033;font-size:26px;letter-spacing:-.04em}
.summary-grid small{font-size:11px}
.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:12px;margin-bottom:12px}
.usage-card{min-width:0;padding:16px;border:1px solid #eadfce;border-radius:10px;background:#fff;box-shadow:0 4px 18px rgb(216 90 0 / 4%)}
.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.card-heading h2{font-size:15px;margin:0}
.card-heading p{margin:4px 0 0;color:#94a3b8;font-size:11px}
.card-heading span{color:#94a3b8;font-size:11px}
.events-card{margin-top:12px}
.cell-subtitle{display:block;color:#94a3b8;font-size:11px}
.empty-state{padding:40px 0;color:#94a3b8;font-size:12px;text-align:center}
.chart-box{width:100%;height:232px}
.chart-tall{height:264px}
.insight-grid{grid-template-columns:minmax(0,1.25fr) minmax(280px,.9fr) minmax(250px,.8fr)}
.dimension-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.dimension-grid .usage-card{min-height:260px}
.low-use-note{margin:10px 0 0;padding-top:10px;border-top:1px solid #f6efe5;color:#94a3b8;font-size:11px}
.low-use-note span{display:inline-block;margin:2px 6px 0 0;padding:2px 8px;border-radius:5px;color:#7a6a58;background:#f6efe5}
.conversation-mask{position:fixed;inset:0;z-index:20;display:flex;justify-content:flex-end;background:rgb(15 23 42 / 40%)}
.conversation-drawer{width:min(560px,100%);height:100%;overflow:auto;padding:22px;background:#fff;box-shadow:-12px 0 40px rgb(15 23 42 / 18%)}
.drawer-close{float:right;border:0;background:transparent;font-size:26px;color:#64748b;cursor:pointer}
.conversation-drawer h2{margin:6px 0}
.conversation-drawer .eyebrow{margin-top:8px}
.drawer-meta{margin:2px 0 14px;color:#94a3b8;font-size:12px}
.drawer-state{padding:40px 0;color:#94a3b8;text-align:center}
.drawer-state.error{color:#b91c1c}
.retry-button{margin-left:8px;padding:4px 10px;border:0;border-radius:5px;color:#fff;background:#e86600;cursor:pointer}
.messages{display:grid;gap:12px}
.message{max-width:88%;padding:10px 12px;border-radius:10px;background:#f6efe5;color:#334155}
.message-user{margin-left:auto;background:#fff1e0}
.message span{display:block;font-size:11px;color:#94a3b8}
.message pre{margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}
.message small{color:#94a3b8}
@media(max-width:1100px){.insight-grid{grid-template-columns:1.2fr 1fr}.dimension-grid{grid-template-columns:1fr}}
@media(max-width:760px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.trend-grid,.insight-grid,.dimension-grid{grid-template-columns:1fr}}
</style>