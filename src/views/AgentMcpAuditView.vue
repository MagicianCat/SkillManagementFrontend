<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MessagePlugin, type TableProps } from 'tdesign-vue-next'
import { listAgentMcpAudits, type AgentMcpAuditView as AuditView } from '../api/agent-audit.api'

const rows = ref<AuditView[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const toolName = ref('')
const status = ref('')

const columns: TableProps['columns'] = [
  { colKey: 'startedAt', title: '调用时间', width: 180 },
  { colKey: 'toolName', title: 'MCP 工具', width: 220 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'durationMs', title: '耗时', width: 100 },
  { colKey: 'sourceChannel', title: '渠道', width: 120 },
  { colKey: 'knowledgeScope', title: '知识范围', width: 160 },
  { colKey: 'runKey', title: 'Agent Run', ellipsis: true },
]

function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
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
</script>

<template>
  <main class="market-page agent-audit-page">
    <div class="page-heading"><div><p class="eyebrow">AGENT AUDIT</p><h1>Agent MCP 调用审计</h1><p class="page-subtitle">追踪 DSH 实际调用的 Skill、Wiki 与飞书云文档工具。</p></div></div>
    <section class="market-toolbar" aria-label="MCP 审计筛选">
      <t-input v-model="toolName" clearable placeholder="工具名称，如 search_feishu_documents" @enter="search" />
      <t-select v-model="status" clearable placeholder="执行状态" :options="[{ label: '执行中', value: 'STARTED' }, { label: '成功', value: 'SUCCEEDED' }, { label: '失败', value: 'FAILED' }]" />
      <t-button theme="primary" @click="search">查询</t-button>
    </section>
    <t-alert v-if="!loading && rows.some(row => row.toolName === 'search_feishu_documents' || row.toolName === 'get_feishu_document')" theme="success" message="当前结果包含飞书云文档 MCP 调用" />
    <t-table row-key="id" :columns="columns" :data="rows" :loading="loading" bordered stripe>
      <template #startedAt="{ row }">{{ formatTime(row.startedAt) }}</template>
      <template #toolName="{ row }"><t-tag :theme="row.toolName.includes('feishu') ? 'warning' : 'default'">{{ row.toolName }}</t-tag></template>
      <template #status="{ row }"><t-tag :theme="row.status === 'SUCCEEDED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'">{{ row.status }}</t-tag></template>
      <template #durationMs="{ row }">{{ row.durationMs == null ? '-' : `${row.durationMs} ms` }}</template>
      <template #runKey="{ row }"><span :title="row.runKey">{{ row.runKey }}</span></template>
    </t-table>
    <t-pagination v-model="page" v-model:page-size="pageSize" :total="total" :page-size-options="[20, 50, 100]" show-page-size @change="load" @page-size-change="onPageSizeChange" />
  </main>
</template>

<style scoped>
.agent-audit-page { display: grid; gap: 18px; }
.agent-audit-page :deep(.t-table) { background: var(--surface-1); }
.agent-audit-page :deep(.t-pagination) { justify-self: end; }
</style>
