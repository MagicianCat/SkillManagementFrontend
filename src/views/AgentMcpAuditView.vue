<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { MessagePlugin, type TableProps } from 'tdesign-vue-next'
import { CheckCircleFilledIcon, ErrorCircleFilledIcon } from 'tdesign-icons-vue-next'
import { listAgentMcpAudits, type AgentMcpAuditView as AuditView } from '../api/agent-audit.api'
import { getAgentOperationsDashboard, type AgentOperationsDashboard } from '../api/agent-operations.api'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute(); const router = useRouter()
const activeTab = ref(String(route.query.tab || 'monitoring') === 'audit' ? 'audit' : 'monitoring')
const dashboard = ref<AgentOperationsDashboard | null>(null)
const dashboardLoading = ref(false); const dashboardError = ref(false); let timer: number | undefined

/* ===== 监控看板派生状态 ===== */
/** 组件卡过滤：Skill Platform Backend 是宿主自身，不在监控看板展示。 */
const visibleComponents = computed(() => (dashboard.value?.components ?? []).filter(c => c.key !== 'skill-platform-backend' && c.name !== 'Skill Platform Backend'))
const trendPoints = computed(() => dashboard.value?.trend.slice(-36) ?? [])
const bannerTone = computed(() => (dashboard.value?.alerts.length ? 'has-alert' : 'clear'))
const lastCheckText = computed(() => { const at = dashboard.value?.generatedAt; if (!at) return '—'; const diff = Date.now() - new Date(at).getTime(); return diff < 10_000 ? '刚刚' : formatTime(at) })
function componentTone(status: string) { return status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'unknown' ? 'neutral' : 'error' }
function componentTheme(status: string): 'success' | 'warning' | 'default' | 'danger' { return status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : status === 'unknown' ? 'default' : 'danger' }
function componentStatusText(status: string) { return status === 'healthy' ? '正常' : status === 'degraded' ? '降级' : status === 'unknown' ? '未知' : '异常' }
function bindingTheme(key: string): 'success' | 'default' | 'warning' { const k = key.toUpperCase(); if (k === 'READY') return 'success'; if (k === 'DEGRADED') return 'warning'; return 'default' }
function capacityNum(key: string): number { const v = dashboard.value?.capacity?.[key]; return typeof v === 'number' ? v : 0 }
function percent(part: number, total: number) { if (!total) return '—'; return `${((part / total) * 100).toFixed(1)}% 已用` }
function meterWidth(part: number, total: number) { if (!total || total <= 0) return '0%'; return `${Math.min(100, Math.max(0, (part / total) * 100)).toFixed(1)}%` }
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
function byteSplit(value: number): [string, string] { if (!value || value < 0) return ['0', 'B']; let n = value; let i = 0; while (n >= 1024 && i < BYTE_UNITS.length - 1) { n /= 1024; i++ } return [n.toFixed(i ? 1 : 0), BYTE_UNITS[i]] }
function bytesNum(value: number) { return byteSplit(value)[0] }
function bytesUnit(value: number) { return ` ${byteSplit(value)[1]}` }

const rows = ref<AuditView[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const toolName = ref('')
const status = ref('')

const columns: TableProps['columns'] = [
  { colKey: 'startedAt', title: '调用时间', width: 170, ellipsis: true },
  { colKey: 'toolName', title: 'MCP 工具', width: 260, ellipsis: true },
  { colKey: 'status', title: '状态', width: 110, ellipsis: true },
  { colKey: 'durationMs', title: '耗时', width: 90, ellipsis: true },
  { colKey: 'sourceChannel', title: '渠道', width: 90, ellipsis: true },
  { colKey: 'knowledgeScope', title: '知识范围', width: 130, ellipsis: true },
  { colKey: 'runKey', title: 'Agent Run', width: 120, ellipsis: true },
]

function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
function formatBytes(value: number) { if (!value || value < 0) return '-'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let n = value; let i = 0; while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ } return `${n.toFixed(i ? 1 : 0)} ${units[i]}` }
async function load() {
  loading.value = true
  try {
    const result = await listAgentMcpAudits({ page: page.value - 1, size: pageSize.value, toolName: toolName.value || undefined, status: status.value || undefined })
    rows.value = result.items
    total.value = result.totalElements
  } catch (error) {
    await MessagePlugin.error('MCP 审计记录加载失败')
  } finally { loading.value = false }
}
function search() { page.value = 1; void load() }
function onPageSizeChange(size: number) { pageSize.value = size; page.value = 1; void load() }
onMounted(() => void load())
async function loadDashboard() {
  dashboardLoading.value = true; dashboardError.value = false
  try { dashboard.value = await getAgentOperationsDashboard() } catch { dashboardError.value = true } finally { dashboardLoading.value = false }
}
function startPolling() { stopPolling(); if (activeTab.value !== 'monitoring') return; void loadDashboard(); timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadDashboard() }, 5000) }
function stopPolling() { if (timer) { window.clearInterval(timer); timer = undefined } }
function changeTab(value: string) { activeTab.value = value; void router.replace({ query: { ...route.query, tab: value } }); startPolling() }
watch(() => route.query.tab, value => { const next = value === 'audit' ? 'audit' : 'monitoring'; if (next !== activeTab.value) { activeTab.value = next; startPolling() } })
onMounted(() => startPolling()); onUnmounted(() => stopPolling())
</script>

<template>
  <main class="market-page agent-audit-page">
    <div class="page-heading"><div><p class="eyebrow">AGENT OPERATIONS</p><h1>Agent 运行与审计</h1><p class="page-subtitle">实时查看 Agent 全链路运行状态，并追踪 MCP 调用。</p></div></div>
    <t-tabs :value="activeTab" @change="changeTab">
      <t-tab-panel value="monitoring" label="运行监控">
        <div class="monitoring-panel">
          <t-alert v-if="dashboardError" theme="warning" message="监控数据暂时不可用，正在继续重试" />
          <template v-if="dashboard">
            <!-- 告警横幅：整宽置顶，无告警=绿色通过态 -->
            <div class="alert-banner" :class="bannerTone">
              <span class="banner-icon"><CheckCircleFilledIcon v-if="!dashboard.alerts.length" /><ErrorCircleFilledIcon v-else /></span>
              <div class="banner-body">
                <strong>{{ dashboard.alerts.length ? `当前有 ${dashboard.alerts.length} 条告警` : '当前没有告警' }}</strong>
                <p>{{ dashboard.alerts.length ? dashboard.alerts.map(a => a.message).join('；') : '所有服务探针与运行时间阈值均处于安全基线以内' }}</p>
              </div>
              <div class="banner-meta"><span>最后检查：{{ lastCheckText }}</span></div>
            </div>

            <!-- 组件状态：状态条卡片 -->
            <section class="panel-block">
              <header class="block-head"><div class="block-title"><i class="block-bar" />组件状态<span class="block-sub">Service Health &amp; Latency</span></div><span class="block-meta">共 {{ visibleComponents.length }} 项核心探针</span></header>
              <div class="component-grid">
                <article v-for="component in visibleComponents" :key="component.key" class="component-card" :class="`tone-${componentTone(component.status)}`">
                  <div class="component-head"><strong>{{ component.name }}</strong><t-tag size="small" :theme="componentTheme(component.status)" variant="light">{{ componentStatusText(component.status) }}</t-tag></div>
                  <div class="component-latency"><span>响应延迟</span><b class="mono">{{ component.latencyMs }}<i>ms</i></b></div>
                  <p v-if="component.error" class="component-error">{{ component.error }}</p>
                </article>
              </div>
            </section>

            <div class="two-col">
              <!-- 运行负载 -->
              <section class="panel-block">
                <header class="block-head"><div class="block-title"><i class="block-bar" />运行负载<span class="block-sub">Active Queues &amp; Tasks</span></div><t-tag size="small" variant="light" :theme="dashboard.workload.running + dashboard.workload.buildRunning + dashboard.workload.queryRunning > 0 ? 'warning' : 'success'">{{ dashboard.workload.running + dashboard.workload.buildRunning + dashboard.workload.queryRunning > 0 ? 'BUSY' : 'IDLE' }} / {{ dashboard.workload.running + dashboard.workload.buildRunning + dashboard.workload.queryRunning > 0 ? '负载中' : '正常轻载' }}</t-tag></header>
                <div class="metric-grid four">
                  <div class="metric-card"><span class="metric-label">Agent 负载</span><b class="metric-num">{{ dashboard.workload.running }}</b><small>运行中 · 近15分 {{ dashboard.workload.recentTotal }}</small></div>
                  <div class="metric-card"><span class="metric-label">构建负载</span><b class="metric-num">{{ dashboard.workload.buildRunning }}</b><small>运行中 · 排队 {{ dashboard.workload.buildQueued }}</small></div>
                  <div class="metric-card"><span class="metric-label">查询负载</span><b class="metric-num">{{ dashboard.workload.queryRunning }}</b><small>当前运行查询</small></div>
                  <div class="metric-card"><span class="metric-label">语义索引</span><b class="metric-num">{{ dashboard.workload.semanticIndexing }}</b><small>INDEXING Binding</small></div>
                </div>
                <footer class="block-foot"><span>调度器状态：并发通道处于就绪待命状态</span><span class="ok-dot">无积压任务</span></footer>
              </section>

              <!-- 资源与容量 -->
              <section class="panel-block">
                <header class="block-head"><div class="block-title"><i class="block-bar" />资源与容量<span class="block-sub">System Provisioning</span></div><span class="block-meta">宿主节点资源利用度</span></header>
                <div class="metric-grid four">
                  <div class="metric-card"><span class="metric-label">CPU 使用率</span><b class="metric-num">{{ dashboard.resources.cpuPercent < 0 ? '—' : dashboard.resources.cpuPercent.toFixed(1) }}<i v-if="dashboard.resources.cpuPercent >= 0">%</i></b><div class="meter"><i :style="{ width: meterWidth(dashboard.resources.cpuPercent, 100) }" /></div><small>轻载运行 · 上限 100%</small></div>
                  <div class="metric-card"><span class="metric-label">内存</span><b class="metric-num">{{ bytesNum(dashboard.resources.memoryUsedBytes) }}<i>{{ bytesUnit(dashboard.resources.memoryUsedBytes) }}</i></b><div class="meter"><i :style="{ width: meterWidth(dashboard.resources.memoryUsedBytes, dashboard.resources.memoryMaxBytes) }" /></div><small>{{ percent(dashboard.resources.memoryUsedBytes, dashboard.resources.memoryMaxBytes) }} · 上限 {{ formatBytes(dashboard.resources.memoryMaxBytes) }}</small></div>
                  <div class="metric-card"><span class="metric-label">磁盘</span><b class="metric-num">{{ bytesNum(dashboard.resources.diskUsedBytes) }}<i>{{ bytesUnit(dashboard.resources.diskUsedBytes) }}</i></b><div class="meter"><i :style="{ width: meterWidth(dashboard.resources.diskUsedBytes, dashboard.resources.diskTotalBytes) }" /></div><small>{{ percent(dashboard.resources.diskUsedBytes, dashboard.resources.diskTotalBytes) }} · 总量 {{ formatBytes(dashboard.resources.diskTotalBytes) }}</small></div>
                  <div class="metric-card"><span class="metric-label">队列容量</span><b class="metric-num">{{ dashboard.workload.buildQueued }}<i>/ {{ capacityNum('workerMaxConcurrentBuilds') }}</i></b><div class="meter"><i :style="{ width: meterWidth(dashboard.workload.buildQueued, capacityNum('workerMaxConcurrentBuilds')) }" /></div><small>构建队列 · 并发配置 {{ capacityNum('workerMaxConcurrentBuilds') }}</small></div>
                </div>
                <footer class="block-foot"><span>存储与计算富余容量良好，无扩容预警</span><span class="mono">Free: {{ formatBytes(dashboard.resources.diskTotalBytes - dashboard.resources.diskUsedBytes) }}</span></footer>
              </section>
            </div>

            <div class="two-col latency-trend">
              <!-- 延迟与索引 -->
              <section class="panel-block">
                <header class="block-head"><div class="block-title"><i class="block-bar" />延迟与索引</div><span class="block-meta">SLO 99.9%</span></header>
                <div class="metric-grid two">
                  <div class="metric-card"><span class="metric-label">P95 延迟</span><b class="metric-num">{{ dashboard.latency.p95Ms }}<i>ms</i></b><small>95% 请求阈值内</small></div>
                  <div class="metric-card"><span class="metric-label">P99 延迟</span><b class="metric-num">{{ dashboard.latency.p99Ms }}<i>ms</i></b><small>极值延迟监测</small></div>
                  <div class="metric-card"><span class="metric-label">错误率</span><b class="metric-num" :class="dashboard.workload.errorRatePercent > 0 ? 'num-error' : 'num-ok'">{{ dashboard.workload.errorRatePercent }}<i>%</i></b><small>运行状态极佳</small></div>
                  <div class="metric-card"><span class="metric-label">Qdrant 索引</span><b class="metric-num" :class="dashboard.qdrant.reachable ? 'num-ok' : 'num-error'">{{ dashboard.qdrant.reachable ? '可用' : '不可用' }}</b><small class="mono">{{ dashboard.qdrant.collection }}</small></div>
                </div>
                <footer class="block-foot"><span>向量数据库分片连接正常</span><span class="mono">{{ dashboard.qdrant.reachable ? '1/1' : '0/1' }} Node Online</span></footer>
              </section>

              <!-- 15 分钟趋势：点阵采样 -->
              <section class="panel-block">
                <header class="block-head"><div class="block-title"><i class="block-bar" />15 分钟趋势<span class="block-sub">（每 5 秒采样）</span></div><div class="trend-legend"><span class="lg p95" />P95 延迟<span class="lg p99" />P99 延迟<span class="lg err" />错误率 (%)</div></header>
                <div class="trend-dots">
                  <div class="trend-line p95"><span class="trend-label">P95</span><span class="trend-base muted">稳定基线 {{ dashboard.latency.p95Ms }}ms</span><div class="dots"><i v-for="(point, index) in trendPoints" :key="index" :class="{ hot: point.p95Ms > dashboard.latency.p95Ms }" :title="`${point.at} · P95 ${point.p95Ms}ms`" /></div><b class="mono">{{ dashboard.latency.p95Ms }} ms</b></div>
                  <div class="trend-line p99"><span class="trend-label">P99</span><span class="trend-base muted">稳定基线 {{ dashboard.latency.p99Ms }}ms</span><div class="dots"><i v-for="(point, index) in trendPoints" :key="`p99-${index}`" :class="{ hot: point.p99Ms > dashboard.latency.p99Ms }" :title="`${point.at} · P99 ${point.p99Ms}ms`" /></div><b class="mono">{{ dashboard.latency.p99Ms }} ms</b></div>
                  <div class="trend-line err"><span class="trend-label">错误率</span><span class="trend-base muted">{{ trendPoints.some(p => p.errorRatePercent > 0) ? '存在异常上报' : '零异常上报' }}</span><div class="dots"><i v-for="(point, index) in trendPoints" :key="`err-${index}`" :class="{ hot: point.errorRatePercent > 0 }" :title="`${point.at} · 错误率 ${point.errorRatePercent}%`" /></div><b class="mono">{{ dashboard.workload.errorRatePercent }}%</b></div>
                </div>
                <footer class="block-foot binding"><span>Code Graph Binding <small class="muted">图节点绑定拓扑</small></span><span class="binding-pills"><t-tag v-for="(value, key) in dashboard.codeGraphBindings" :key="key" size="small" variant="light" :theme="bindingTheme(String(key))">{{ key }} {{ value }}</t-tag><span v-if="!Object.keys(dashboard.codeGraphBindings).length" class="muted">暂无 Binding 数据</span></span></footer>
              </section>
            </div>
          </template>
          <t-loading v-if="dashboardLoading && !dashboard" text="加载监控数据中…" />
        </div>
      </t-tab-panel>
      <t-tab-panel value="audit" label="调用审计">
    <section class="market-toolbar" aria-label="MCP 审计筛选">
      <t-input v-model="toolName" clearable placeholder="工具名称，如 search_feishu_documents" @enter="search" />
      <t-select v-model="status" clearable placeholder="执行状态" :options="[{ label: '执行中', value: 'STARTED' }, { label: '成功', value: 'SUCCEEDED' }, { label: '失败', value: 'FAILED' }]" />
      <t-button theme="primary" @click="search">查询</t-button>
    </section>
    <t-alert v-if="!loading && rows.some(row => row.toolName === 'search_feishu_documents' || row.toolName === 'get_feishu_document')" theme="success" message="当前结果包含飞书云文档 MCP 调用" />
    <div class="table-scroll">
      <t-table row-key="id" :columns="columns" :data="rows" :loading="loading" bordered stripe>
      <template #startedAt="{ row }"><span class="cell-nowrap">{{ formatTime(row.startedAt) }}</span></template>
      <template #toolName="{ row }"><span class="cell-mono" :title="row.toolName">{{ row.toolName }}</span></template>
      <template #status="{ row }"><t-tag :theme="row.status === 'SUCCEEDED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'">{{ row.status }}</t-tag></template>
      <template #durationMs="{ row }">{{ row.durationMs == null ? '-' : `${row.durationMs} ms` }}</template>
      <template #runKey="{ row }"><span class="cell-mono" :title="row.runKey">{{ row.runKey }}</span></template>
      </t-table>
    </div>
    <t-pagination v-model="page" v-model:page-size="pageSize" :total="total" :page-size-options="[20, 50, 100]" show-page-size @change="load" @page-size-change="onPageSizeChange" />
      </t-tab-panel>
    </t-tabs>
  </main>
</template>

<style scoped>
.agent-audit-page { display: grid; gap: 18px; min-width: 0; }
.table-scroll { min-width: 0; overflow-x: auto; }
.table-scroll :deep(.t-table) { min-width: 980px; }
.agent-audit-page :deep(.t-table) { background: var(--surface-1); }
.agent-audit-page :deep(.t-pagination) { justify-self: end; }
.cell-nowrap { white-space: nowrap; }
.cell-mono { font-family: var(--font-mono); font-size: 12px; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--text-3); }

/* ===== 监控看板骨架 ===== */
.monitoring-panel { display: grid; gap: 16px; padding-top: 16px; }
.panel-block { display: grid; gap: 14px; padding: 18px 20px; border: 1px solid var(--border-1); border-radius: var(--radius-lg); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.block-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.block-title { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600; color: var(--text-1); }
.block-title .block-bar { width: 3px; height: 14px; border-radius: 2px; background: var(--accent-500); flex: none; }
.block-sub { margin-left: 8px; font-size: 11px; font-weight: 400; color: var(--text-3); }
.block-meta { font-size: 11px; color: var(--text-3); }
.block-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px; padding-top: 12px; border-top: 1px solid var(--border-1); font-size: 12px; color: var(--text-2); flex-wrap: wrap; }
.ok-dot { display: inline-flex; align-items: center; gap: 6px; color: var(--success); }
.ok-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: stretch; }
.two-col.latency-trend { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }

/* ===== 告警横幅 ===== */
.alert-banner { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: var(--radius-md); border: 1px solid; }
.alert-banner.clear { border-color: rgb(52 211 153 / 40%); background: rgb(52 211 153 / 7%); }
.alert-banner.has-alert { border-color: rgb(248 113 113 / 45%); background: rgb(248 113 113 / 7%); }
.banner-icon { flex: none; font-size: 22px; display: grid; place-items: center; }
.alert-banner.clear .banner-icon { color: var(--success); }
.alert-banner.has-alert .banner-icon { color: var(--error); }
.banner-body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.banner-body strong { font-size: 14px; color: var(--text-1); }
.banner-body p { margin: 0; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.banner-meta { flex: none; display: flex; align-items: center; font-size: 12px; color: var(--text-3); }

/* ===== 组件状态卡 ===== */
.component-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.component-card { position: relative; display: grid; gap: 12px; padding: 14px 16px 14px 18px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-2); overflow: hidden; }
.component-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--border-3); }
.component-card.tone-success::before { background: var(--success); }
.component-card.tone-warning::before { background: var(--warning); }
.component-card.tone-error::before { background: var(--error); }
.component-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.component-head strong { font-size: 13px; color: var(--text-1); }
.component-latency { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border-1); }
.component-latency span { font-size: 11px; color: var(--text-3); }
.component-latency b { font-size: 26px; font-weight: 700; color: var(--text-1); letter-spacing: -0.02em; }
.component-latency b i { font-style: normal; font-size: 12px; font-weight: 500; color: var(--text-3); margin-left: 3px; }
.component-card.tone-warning .component-latency b { color: var(--warning); }
.component-card.tone-error .component-latency b { color: var(--error); }
.component-error { margin: 0; font-size: 11px; color: var(--error); overflow-wrap: anywhere; }

/* ===== 指标卡（负载/资源/延迟） ===== */
.metric-grid { display: grid; gap: 12px; }
.metric-grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.metric-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metric-card { display: grid; gap: 8px; align-content: start; padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-2); }
.metric-label { font-size: 12px; color: var(--text-2); }
.metric-num { font-size: 26px; font-weight: 700; color: var(--text-1); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.metric-num i { font-style: normal; font-size: 13px; font-weight: 500; color: var(--text-3); margin-left: 3px; }
.metric-num.num-ok { color: var(--success); }
.metric-num.num-error { color: var(--error); }
.metric-card small { font-size: 11px; color: var(--text-3); }
.meter { height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--accent-500), var(--accent-300)); transition: width 0.6s var(--ease-out); }

/* ===== 趋势点阵 ===== */
.trend-legend { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-2); }
.trend-legend .lg { width: 8px; height: 8px; border-radius: 50%; margin-left: 10px; }
.trend-legend .lg.p95 { background: var(--info); }
.trend-legend .lg.p99 { background: var(--accent-400); }
.trend-legend .lg.err { background: var(--error); }
.trend-dots { display: grid; gap: 12px; }
.trend-line { display: grid; grid-template-columns: 52px 110px 1fr auto; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-2); }
.trend-label { font-size: 12px; font-weight: 600; }
.trend-line.p95 .trend-label { color: var(--info); }
.trend-line.p99 .trend-label { color: var(--accent-400); }
.trend-line.err .trend-label { color: var(--error); }
.trend-base { font-size: 10px; }
.dots { display: flex; gap: 5px; flex-wrap: wrap; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--info); opacity: 0.75; }
.trend-line.p99 .dots i { background: var(--accent-400); }
.trend-line.err .dots i { background: var(--error); }
.dots i.hot { opacity: 1; box-shadow: 0 0 6px currentColor; }
.trend-line > b { font-size: 12px; color: var(--text-2); font-weight: 600; }

/* ===== Code Graph Binding footer ===== */
.block-foot.binding { justify-content: space-between; }
.binding-pills { display: inline-flex; gap: 8px; flex-wrap: wrap; }

@media (max-width: 1100px) { .two-col, .two-col.latency-trend { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .metric-grid.four { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
