<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { WorkflowAgentNode, WorkflowEdge, WorkflowStage } from '../../types/workflow'
import type { StatusTone } from '../../types/workbench'
import { layoutGraph } from './dagLayout'

const props = defineProps<{ stage: WorkflowStage | null; reviewCycle?: { current: number; max: number } | null; latestRevision?: number | null }>()

const TONE: Record<string, StatusTone> = {
  COMPLETED: 'success', SUCCESS: 'success',
  RUNNING: 'warning', STARTING: 'warning', QUEUED: 'warning',
  PENDING: 'info', READY: 'info',
  FAILED: 'error', CANCELLED: 'error',
  WAITING_HUMAN: 'purple', PAUSED: 'purple', HUMAN_REQUIRED: 'purple',
}
const toneOf = (status: string) => TONE[status] ?? 'neutral'

// 节点/边用最小本地类型，避免 vue-flow Node 泛型的递归类型实例化（TS2589）。
interface FlowNode { id: string; position: { x: number; y: number }; data: Record<string, unknown>; class?: string }
interface FlowEdge { id: string; source: string; target: string; animated?: boolean; label?: string; class?: string }
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])

const agentEdges = computed<WorkflowEdge[]>(() => props.stage?.edges ?? [])

async function render() {
  const agents: WorkflowAgentNode[] = props.stage?.agents ?? []
  if (!agents.length) { nodes.value = []; edges.value = []; return }
  const layoutNodes = agents.map((agent) => ({ id: agent.key, width: 148, height: 56 }))
  const layoutEdges = agentEdges.value.map((edge, i) => ({ id: `e${i}`, source: edge.from, target: edge.to }))
  const positions = await layoutGraph(layoutNodes, layoutEdges)
  nodes.value = agents.map((agent) => {
    const current = props.stage?.currentAgent === agent.name
    return {
      id: agent.key,
      position: positions[agent.key] ?? { x: 0, y: 0 },
      data: { label: agent.name || agent.key, status: agent.status, tone: toneOf(agent.status), current },
      class: ['agent-node', `tone-${toneOf(agent.status)}`, current ? 'is-current' : ''].filter(Boolean).join(' '),
    }
  })
  edges.value = agentEdges.value.map((edge, i) => {
    const loop = Boolean(edge.condition && (edge.dependencyType === 'LOOP' || 'REVISION_REQUIRED' in edge.condition))
    return { id: `e${i}`, source: edge.from, target: edge.to, animated: loop, label: loop ? '驳回返工' : '', class: ['agent-edge', loop ? 'is-loop' : ''].join(' ') }
  })
}
watch(() => [props.stage], () => void render(), { deep: true, immediate: true })

const metrics = computed(() => ({
  agent: props.stage?.currentAgent ?? '—',
  loop: props.reviewCycle ? `${props.reviewCycle.current}/${props.reviewCycle.max}` : '—',
  revision: props.latestRevision != null ? `#${props.latestRevision}` : '—',
  token: '—',
  elapsed: '—',
}))
const statusText: Record<string, string> = { COMPLETED: '已完成', RUNNING: '运行中', STARTING: '启动中', QUEUED: '排队中', PENDING: '待执行', WAITING_HUMAN: '等待人工', PAUSED: '已暂停', FAILED: '失败' }
</script>

<template>
  <section class="stage-panel panel" data-testid="agent-team">
    <header class="panel-head">
      <div>
        <h3>{{ stage?.name || '当前阶段' }}</h3>
        <p class="stage-desc">{{ stage?.key || '' }} · 状态 {{ stage?.status || 'PENDING' }}</p>
      </div>
      <span v-if="reviewCycle" class="cycle mono">Review Cycle {{ reviewCycle.current }}/{{ reviewCycle.max }}</span>
    </header>
    <div class="agent-canvas">
      <VueFlow v-if="nodes.length" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false" :zoom-on-scroll="false" :pan-on-drag="false" :prevent-scrolling="true" fit-view-on-init>
        <Background :gap="18" pattern-color="rgba(148,180,255,0.05)" />
        <template #node-default="{ data }">
          <div class="agent-box" :class="[`tone-${data.tone}`, { current: data.current }]">
            <span class="agent-name">{{ data.label }}</span>
            <span class="agent-status">{{ statusText[data.status] || data.status }}</span>
          </div>
        </template>
      </VueFlow>
      <p v-else class="empty">等待 Agent 编排数据…</p>
    </div>
    <ul class="metrics">
      <li><span>当前 Agent</span><b>{{ metrics.agent }}</b></li>
      <li><span>Loop</span><b class="mono">{{ metrics.loop }}</b></li>
      <li><span>最新 Revision</span><b class="mono">{{ metrics.revision }}</b></li>
      <li><span>Token</span><b class="mono">{{ metrics.token }}</b></li>
      <li><span>耗时</span><b class="mono">{{ metrics.elapsed }}</b></li>
    </ul>
  </section>
</template>

<style scoped>
.panel { padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.panel-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; }
.panel-head h3 { font-size: 15px; color: var(--text-1); font-weight: 600; }
.stage-desc { margin: 2px 0 0; font-size: 11px; color: var(--text-3); }
.cycle { padding: 3px 10px; border: 1px solid var(--border-accent); border-radius: var(--radius-full); color: var(--accent-300); background: var(--accent-softer); font-size: 11px; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.agent-canvas { position: relative; height: 160px; border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 12px; }
:deep(.agent-node) { border: none; background: transparent; box-shadow: none; padding: 0; }
.agent-box { display: grid; place-content: center; gap: 2px; width: 148px; height: 56px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-solid-1); text-align: center; transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
.agent-name { font-size: 12px; color: var(--text-1); font-weight: 500; }
.agent-status { font-size: 10px; color: var(--text-3); }
.agent-box.tone-success { border-color: rgb(52 211 153 / 40%); }
.agent-box.tone-success .agent-status { color: var(--success); }
.agent-box.tone-warning { border-color: rgb(251 191 36 / 45%); }
.agent-box.tone-warning .agent-status { color: var(--warning); }
.agent-box.tone-error { border-color: rgb(248 113 113 / 45%); }
.agent-box.tone-error .agent-status { color: var(--error); }
.agent-box.tone-purple { border-color: rgb(167 139 250 / 50%); }
.agent-box.tone-purple .agent-status { color: var(--purple); }
.agent-box.current { box-shadow: 0 0 0 1px var(--border-accent), 0 0 16px var(--accent-glow); animation: breathe 2.2s ease-in-out infinite; }
@keyframes breathe { 50% { box-shadow: 0 0 0 1px var(--border-accent), 0 0 26px var(--accent-glow); } }
:deep(.agent-edge .vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 1.3; }
:deep(.agent-edge.is-loop .vue-flow__edge-path) { stroke: var(--warning); stroke-dasharray: 5 4; }
:deep(.agent-edge .vue-flow__edge-text) { fill: var(--warning); font-size: 9px; }
:deep(.agent-edge .vue-flow__edge-textbg) { fill: var(--bg-2); }
.metrics { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between; gap: 12px; list-style: none; margin: 10px 0 0; padding: 10px 0 0; border-top: 1px solid var(--border-1); }
.metrics li { display: grid; gap: 3px; }
.metrics span { font-size: 10px; color: var(--text-3); white-space: nowrap; }
.metrics b { font-size: 13px; color: var(--text-1); font-weight: 600; white-space: nowrap; }
@media (max-width: 720px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
</style>
