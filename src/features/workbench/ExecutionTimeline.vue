<script setup lang="ts">
import { computed } from 'vue'
import type { WorkflowEvent } from '../../types/workflow'
import type { StatusTone, TimelineItem } from '../../types/workbench'

const props = defineProps<{ events: WorkflowEvent[] }>()

const MAP: Record<string, { label: string; tone: StatusTone }> = {
  'workflow.snapshot': { label: '同步工作流快照', tone: 'info' },
  'workflow.status.changed': { label: '工作流状态变更', tone: 'info' },
  'stage.status.changed': { label: '阶段状态变更', tone: 'info' },
  'agent.status.changed': { label: 'Agent 状态变更', tone: 'info' },
  'agent.protocol.retry.requested': { label: '输出协议自动纠正', tone: 'warning' },
  'agent.message.delta': { label: 'Agent 输出', tone: 'neutral' },
  'agent.paused': { label: 'Agent 已暂停', tone: 'purple' },
  'agent.resumed': { label: 'Agent 已继续', tone: 'purple' },
  'artifact.revision.created': { label: '生成文档 Revision', tone: 'success' },
  'tool.started': { label: '调用工具', tone: 'warning' },
  'tool.completed': { label: '工具完成', tone: 'success' },
  'tool.failed': { label: '工具失败', tone: 'error' },
  'human.intervention.created': { label: '人员介入', tone: 'purple' },
  'workflow.completed': { label: '工作流完成', tone: 'success' },
  'workflow.failed': { label: '工作流失败', tone: 'error' },
}

const items = computed<TimelineItem[]>(() =>
  [...props.events].slice(-60).reverse().map((event, index) => {
    const meta = MAP[event.type] ?? { label: event.type, tone: 'neutral' as StatusTone }
    const data = event.data
    const detail = event.type === 'agent.protocol.retry.requested'
      ? `第 ${String(data.attempt ?? '?')} / ${String(data.maxAttempts ?? 3)} 次自动纠正`
      : String(data.message ?? data.stageName ?? data.agentName ?? data.summary ?? data.revision ?? '')
    return { key: event.id || `${event.type}-${index}`, type: event.type, label: meta.label, detail, time: event.createdAt || '', tone: meta.tone }
  }),
)

/** 折叠条头部摘要：记录条数。 */
const summary = computed(() => `${items.value.length} 条记录`)
const live = computed(() => items.value.length > 0)
defineExpose({ summary, live, count: computed(() => items.value.length) })
</script>

<template>
  <section class="timeline-inner" data-testid="timeline">
    <ol v-if="items.length" class="track">
      <li v-for="item in items" :key="item.key" class="entry">
        <span class="dot" :class="`tone-${item.tone}`" />
        <div class="body">
          <div class="row"><strong>{{ item.label }}</strong><time class="mono">{{ item.time }}</time></div>
          <p v-if="item.detail" class="detail">{{ item.detail }}</p>
        </div>
      </li>
    </ol>
    <p v-else class="empty">等待运行事件…</p>
  </section>
</template>

<style scoped>
.timeline-inner { display: flex; flex-direction: column; min-height: 0; }
.track { list-style: none; margin: 0; padding: 0 0 0 6px; overflow-y: auto; max-height: 360px; }
.entry { position: relative; display: flex; gap: 12px; padding: 0 0 14px 16px; }
.entry::before { content: ''; position: absolute; left: 3px; top: 12px; bottom: -2px; width: 1px; background: var(--border-1); }
.entry:last-child::before { display: none; }
.dot { position: absolute; left: 0; top: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--text-4); }
.dot.tone-success { background: var(--success); box-shadow: 0 0 6px var(--success); }
.dot.tone-warning { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
.dot.tone-info { background: var(--info); }
.dot.tone-error { background: var(--error); box-shadow: 0 0 6px var(--error); }
.dot.tone-purple { background: var(--purple); box-shadow: 0 0 6px var(--purple); }
.body { flex: 1; min-width: 0; }
.row { display: flex; justify-content: space-between; gap: 8px; }
.row strong { font-size: 12px; color: var(--text-1); font-weight: 550; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
time { font-size: 10px; color: var(--text-4); flex: none; }
.detail { margin: 2px 0 0; font-size: 11px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.empty { color: var(--text-3); font-size: 12px; }
</style>
