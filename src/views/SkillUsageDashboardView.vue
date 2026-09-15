<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
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
const topSkillCalls = computed(() => Math.max(...(overview.value?.skills.map((item) => item.calls) ?? [1]), 1))
const trendMax = computed(() => Math.max(...(overview.value?.trend.map((item) => item.calls) ?? [1]), 1))
const trendPoints = computed(() => {
  const rows = overview.value?.trend ?? []
  if (!rows.length) return ''
  const width = 720
  const height = 170
  return rows.map((item, index) => {
    const x = rows.length === 1 ? width / 2 : (index / (rows.length - 1)) * width
    const y = height - (item.calls / trendMax.value) * (height - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

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
function formatRate(value: number) { return `${(value * 100).toFixed(1)}%` }
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
  try {
    scope.value = await getSkillUsageAccessScope()
    teams.value = scope.value.teams
    if (!scope.value.global && scope.value.teams.length) selectedTeamId.value = scope.value.teams[0].id
    await loadMembers()
    await loadDashboard()
  } catch (error) { errorMessage.value = errorText(error, '看板权限范围加载失败') }
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
        <article><span>对话采集成功率</span><strong>{{ formatRate(overview.summary.conversationSuccessRate) }}</strong><small>{{ overview.summary.mergedConversations }} 条已合并</small></article>
      </section>

      <section class="dashboard-grid">
        <article class="usage-card trend-card"><div class="card-heading"><div><h2>调用趋势</h2><p>按时间观察 Skill 使用量变化</p></div><span>{{ overview.trend.length }} 个时间点</span></div><div v-if="overview.trend.length" class="trend-chart"><svg viewBox="0 0 720 190" preserveAspectRatio="none" role="img" aria-label="Skill 调用趋势折线图"><line x1="0" y1="170" x2="720" y2="170" /><polyline :points="trendPoints" /><circle v-for="(item, index) in overview.trend" :key="item.bucket" :cx="overview.trend.length === 1 ? 360 : (index / (overview.trend.length - 1)) * 720" :cy="170 - (item.calls / trendMax) * 158" r="3" /></svg><div class="trend-labels"><span>{{ overview.trend[0]?.bucket }}</span><span>{{ overview.trend.at(-1)?.bucket }}</span></div></div><div v-else class="empty-state">当前范围暂无调用数据</div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>对话采集状态</h2><p>统计采样链路是否正常</p></div></div><div class="status-list"><div v-for="item in overview.conversationStatuses" :key="item.status"><span><i :class="`status-dot status-${item.status.toLowerCase()}`"></i>{{ statusLabel(item.status) }}</span><strong>{{ item.count }}</strong></div><p v-if="!overview.conversationStatuses.length" class="empty-state">暂无状态数据</p></div></article>
      </section>

      <section class="dashboard-grid ranking-grid"><article class="usage-card"><div class="card-heading"><div><h2>Skill 使用排行</h2><p>按调用次数排序</p></div></div><div v-if="overview.skills.length" class="ranking-list"><div v-for="item in overview.skills.slice(0, 10)" :key="item.skillKey" class="ranking-row"><div class="ranking-label"><strong>{{ item.displayName || item.skillKey }}</strong><small>{{ item.skillKey }} · {{ item.users }} 人使用</small></div><b>{{ item.calls }}</b><div class="ranking-track"><i :style="{ width: `${(item.calls / topSkillCalls) * 100}%` }"></i></div></div></div><p v-else class="empty-state">暂无 Skill 数据</p></article><article class="usage-card"><div class="card-heading"><div><h2>成员使用排行</h2><p>按调用次数排序</p></div></div><div v-if="overview.members.length" class="member-ranking"><div v-for="item in overview.members.slice(0, 10)" :key="item.userId"><span class="member-avatar">{{ item.displayName.slice(0, 1) }}</span><div><strong>{{ item.displayName }}</strong><small>{{ item.username }} · {{ item.skills }} 个 Skill</small></div><b>{{ item.calls }}</b></div></div><p v-else class="empty-state">暂无成员数据</p></article></section>
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
.usage-page{width:min(100%,1220px);margin:0 auto;color:#172033}.usage-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.usage-heading h1{margin:5px 0 8px;font-size:28px}.usage-heading p:not(.eyebrow){margin:0;color:#64748b;font-size:13px}.scope-badge{padding:8px 12px;border:1px solid #ffd9a3;border-radius:999px;color:#b34a00;background:#fff6ec;font-size:12px;white-space:nowrap}.usage-alert{margin:12px 0;padding:12px 14px;border-radius:9px;color:#9a3412;background:#fff1e0}.usage-filters{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:18px;padding:13px;border:1px solid #eadfce;border-radius:13px;background:#fff}.usage-filters label{display:grid;gap:4px;color:#64748b;font-size:11px}.usage-filters input{height:32px;padding:0 8px;border:1px solid #d8cbbb;border-radius:6px;color:#334155;background:#fff;font:inherit;font-size:12px}.usage-filters .t-select{width:160px}.usage-filters .t-input{width:160px}.preset-group{display:flex;gap:4px}.preset-group button{height:32px;padding:0 10px;border:1px solid #eadfce;border-radius:6px;color:#64748b;background:#fff;font:inherit;font-size:12px;cursor:pointer}.preset-group button.active{border-color:#e86600;color:#b34a00;background:#fff1e0}.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}.summary-grid article{display:grid;gap:8px;padding:18px;border:1px solid #eadfce;border-radius:14px;background:#fff}.summary-grid span,.summary-grid small{color:#64748b;font-size:12px}.summary-grid strong{color:#172033;font-size:28px;letter-spacing:-.04em}.summary-grid small{font-size:11px}.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:16px;margin-bottom:16px}.ranking-grid{grid-template-columns:1.3fr 1fr}.usage-card{min-width:0;padding:20px;border:1px solid #eadfce;border-radius:14px;background:#fff}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.card-heading h2{margin:0 0 4px;color:#172033;font-size:16px}.card-heading p,.card-heading>span{margin:0;color:#94a3b8;font-size:11px}.trend-chart svg{display:block;width:100%;height:190px;overflow:visible}.trend-chart line{stroke:#eadfce;stroke-width:1}.trend-chart polyline{fill:none;stroke:#e86600;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.trend-chart circle{fill:#fff;stroke:#e86600;stroke-width:2}.trend-labels{display:flex;justify-content:space-between;margin-top:4px;color:#94a3b8;font-size:10px}.status-list{display:grid;gap:11px}.status-list>div{display:flex;align-items:center;justify-content:space-between;color:#475569;font-size:13px}.status-list strong{color:#172033}.status-dot{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#94a3b8}.status-merged{background:#16a36a}.status-failed{background:#dc2626}.status-staged{background:#eab308}.ranking-list{display:grid;gap:13px}.ranking-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:8px}.ranking-label{display:grid;gap:3px;min-width:0}.ranking-label strong,.member-ranking strong{overflow:hidden;color:#334155;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.ranking-label small,.member-ranking small,.cell-subtitle{overflow:hidden;color:#94a3b8;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ranking-row>b{color:#b34a00;text-align:right}.ranking-track{grid-column:1/-1;height:5px;overflow:hidden;border-radius:99px;background:#f4e8dc}.ranking-track i{display:block;height:100%;border-radius:99px;background:#e86600}.member-ranking{display:grid;gap:12px}.member-ranking>div{display:flex;align-items:center;gap:9px}.member-ranking>div>div{display:grid;min-width:0;flex:1;gap:3px}.member-ranking>b{color:#b34a00}.member-avatar{display:grid;width:28px;height:28px;flex:0 0 28px;place-items:center;border-radius:50%;color:#b34a00;background:#fff1e0;font-size:12px;font-weight:700}.events-card{margin-top:4px}.events-card :deep(.t-table){font-size:12px}.events-card :deep(.t-pagination){justify-content:flex-end;margin-top:16px}.events-card :deep(.t-button){padding:0}.events-card strong{display:block;color:#334155;font-size:12px}.cell-subtitle{display:block;margin-top:3px}.empty-state{padding:28px 0;color:#94a3b8;font-size:12px;text-align:center}.conversation-mask{position:fixed;z-index:30;inset:0;background:rgb(15 23 42 / 28%)}.conversation-drawer{position:absolute;top:0;right:0;display:flex;width:min(620px,100%);height:100%;padding:28px 24px;overflow:hidden;flex-direction:column;background:#fff;box-shadow:-12px 0 40px rgb(15 23 42 / 16%)}.drawer-close{position:absolute;top:16px;right:18px;border:0;color:#94a3b8;background:transparent;font-size:26px;cursor:pointer}.conversation-drawer h2{margin:5px 32px 4px 0;color:#172033;font-size:20px}.drawer-meta{margin:0 0 18px;color:#94a3b8;font-size:12px}.drawer-state{display:grid;place-items:center;min-height:180px;color:#64748b;font-size:13px}.drawer-state.error{color:#c0392b}.retry-button{margin-top:10px;padding:7px 12px;border:1px solid #e86600;border-radius:7px;color:#b34a00;background:#fff;font:inherit;cursor:pointer}.messages{display:grid;gap:12px;overflow:auto;padding-right:4px}.message{padding:12px 14px;border-radius:10px}.message-user{background:#fff6ec}.message-assistant{background:#f6f8fa}.message>span{display:block;margin-bottom:7px;color:#b34a00;font-size:11px;font-weight:700}.message pre{margin:0;overflow:auto;color:#334155;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.message small{display:block;margin-top:7px;color:#94a3b8;font-size:10px}@media(max-width:1000px){.summary-grid{grid-template-columns:repeat(2,1fr)}.dashboard-grid,.ranking-grid{grid-template-columns:1fr}}@media(max-width:720px){.usage-page{padding:4px}.usage-heading{display:block}.scope-badge{display:inline-block;margin-top:12px}.usage-filters{align-items:stretch}.usage-filters label,.usage-filters .t-select,.usage-filters .t-input{width:100%}.preset-group{width:100%}.preset-group button{flex:1}.summary-grid{grid-template-columns:1fr 1fr}.usage-card{padding:15px}.conversation-drawer{padding:22px 16px}} 
</style>
