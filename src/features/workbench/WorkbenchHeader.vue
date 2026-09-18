<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowRunStatus } from '../../types/workflow'

const props = defineProps<{ runId: string; status: WorkflowRunStatus | ''; connected: boolean; reconnecting: boolean; running: boolean; waitingAcceptance: boolean; readonly?: boolean }>()
const emit = defineEmits<{ pause: []; resume: []; accept: [] }>()

const statusText: Record<string, string> = { CREATED: '已创建', RUNNING: '运行中', WAITING_DESIGN_ACCEPTANCE: '待设计验收', WAITING_FINAL_ACCEPTANCE: '待最终验收', COMPLETED: '已完成', FAILED: '失败', CANCELLED: '已取消' }
const pill = computed(() => statusText[props.status] || props.status || '加载中')
const pillTone = computed(() => {
  if (['COMPLETED'].includes(props.status)) return 'success'
  if (['RUNNING'].includes(props.status)) return 'warning'
  if (['WAITING_DESIGN_ACCEPTANCE', 'WAITING_FINAL_ACCEPTANCE'].includes(props.status)) return 'purple'
  if (['FAILED', 'CANCELLED'].includes(props.status)) return 'error'
  return 'info'
})
const liveText = computed(() => (props.connected ? '实时连接中' : props.reconnecting ? '正在重连…' : '未连接'))
</script>

<template>
  <header class="workbench-header">
    <div class="title-block">
      <p class="crumb">虚拟研发项目组 / 研发工作流</p>
      <h1>研发工作流</h1>
      <div class="meta">
        <span class="mono run-id">Run ID {{ runId || '—' }}</span>
        <span class="pill" :class="`tone-${pillTone}`">{{ pill }}</span>
      </div>
    </div>
    <div class="actions">
      <span class="live mono" :class="{ online: connected }">{{ liveText }}</span>
      <button v-if="running" type="button" class="btn" :disabled="readonly" @click="emit('pause')">暂停</button>
      <button v-else type="button" class="btn" :disabled="readonly" @click="emit('resume')">继续</button>
      <button type="button" class="btn primary" :disabled="!waitingAcceptance || readonly" @click="emit('accept')">设计验收</button>
      <span class="avatar" title="admin">A</span>
    </div>
  </header>
</template>

<style scoped>
.workbench-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 18px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.crumb { margin: 0; font-size: 11px; letter-spacing: 0.08em; color: var(--text-3); }
h1 { margin: 2px 0 6px; font-size: 19px; color: var(--text-1); font-weight: 650; }
.meta { display: flex; align-items: center; gap: 10px; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.run-id { font-size: 12px; color: var(--text-2); }
.pill { padding: 2px 10px; border-radius: var(--radius-full); font-size: 11px; border: 1px solid var(--border-2); color: var(--text-2); }
.pill.tone-success { color: var(--success); border-color: rgb(52 211 153 / 40%); background: var(--success-soft); }
.pill.tone-warning { color: var(--warning); border-color: rgb(251 191 36 / 40%); background: var(--warning-soft); }
.pill.tone-info { color: var(--info); border-color: rgb(96 165 250 / 40%); background: var(--info-soft); }
.pill.tone-error { color: var(--error); border-color: rgb(248 113 113 / 40%); background: var(--error-soft); }
.pill.tone-purple { color: var(--purple); border-color: rgb(167 139 250 / 45%); background: var(--purple-soft); }
.actions { display: flex; align-items: center; gap: 10px; }
.live { font-size: 11px; color: var(--text-3); padding: 5px 10px; border-radius: var(--radius-full); background: var(--surface-2); }
.live.online { color: var(--success); }
.btn { padding: 8px 14px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-1); font-size: 13px; cursor: pointer; transition: border-color var(--duration-fast), background var(--duration-fast); }
.btn:hover:not(:disabled) { border-color: var(--border-3); background: var(--surface-3); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary { background: var(--accent-600); border-color: var(--accent-600); color: #fff; }
.btn.primary:hover:not(:disabled) { background: var(--accent-500); border-color: var(--accent-500); box-shadow: var(--shadow-accent); }
.avatar { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--accent-softer); border: 1px solid var(--border-accent); color: var(--accent-300); font-size: 13px; font-weight: 600; }
@media (max-width: 720px) { .workbench-header { flex-direction: column; align-items: stretch; } .actions { flex-wrap: wrap; } }
</style>
