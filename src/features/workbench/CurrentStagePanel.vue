<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow, Position, Handle } from '@vue-flow/core'
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
interface FlowNode { id: string; position: { x: number; y: number }; data: Record<string, unknown>; class?: string; sourcePosition?: Position; targetPosition?: Position }
interface FlowEdge { id: string; source: string; target: string; type?: string; animated?: boolean; label?: string; class?: string; sourceHandle?: string; targetHandle?: string }
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])

/** 后端 stage_agent_edge_def 透传的协作边；过滤掉 to=null 的「阶段完成」边（reviewer APPROVED → null 不连线）。 */
const agentEdges = computed<WorkflowEdge[]>(() => (props.stage?.edges ?? []).filter((edge) => edge.to != null && edge.to !== ''))

/** 判定回环边：后端 edgeType 为 LOOP 或 incrementsLoop 为真（reviewer→writer 驳回返工）。 */
function isLoop(edge: WorkflowEdge): boolean {
  return edge.edgeType === 'LOOP' || edge.dependencyType === 'LOOP' || edge.incrementsLoop === true || edge.conditionValue === 'REVISION_REQUIRED'
}

/** 顺序边（主链路）与回环边（返工）分组：顺序边按 from→to 排，回环边单独下沉展示。 */
const flowEdges = computed(() => agentEdges.value.filter((edge) => !isLoop(edge)))
const loopEdges = computed(() => agentEdges.value.filter(isLoop))

async function render() {
  const agents: WorkflowAgentNode[] = props.stage?.agents ?? []
  if (!agents.length) { nodes.value = []; edges.value = []; return }
  // 只让顺序边参与布局，保证主链路是一条清晰水平线；回环边作为额外观感叠加。
  const layoutNodes = agents.map((agent) => ({ id: agent.key, width: 132, height: 54 }))
  const layoutEdges = flowEdges.value.map((edge, i) => ({ id: `f${i}`, source: edge.from, target: edge.to as string }))
  const positions = await layoutGraph(layoutNodes, layoutEdges, { layerGap: 56, nodeGap: 30, padding: 18 })
  nodes.value = agents.map((agent) => {
    const current = props.stage?.currentAgent === agent.name
    return {
      id: agent.key,
      position: positions[agent.key] ?? { x: 0, y: 0 },
      data: { label: agent.name || agent.key, status: agent.status, tone: toneOf(agent.status), current },
      class: ['agent-node', `tone-${toneOf(agent.status)}`, current ? 'is-current' : ''].filter(Boolean).join(' '),
    }
  })
  const seq: FlowEdge[] = flowEdges.value.map((edge, i) => ({
    id: `f${i}`, source: edge.from, target: edge.to as string, type: 'default',
    sourceHandle: 'out', targetHandle: 'in', class: 'agent-edge is-seq',
  }))
  const loops: FlowEdge[] = loopEdges.value.map((edge, i) => ({
    id: `l${i}`,
    source: edge.from,
    target: edge.to as string,
    type: 'smoothstep',
    sourceHandle: 'loop-out',
    targetHandle: 'loop-in',
    animated: true,
    label: props.reviewCycle ? `驳回返工 (Review Cycle ${props.reviewCycle.current}/${props.reviewCycle.max})` : '驳回返工',
    class: 'agent-edge is-loop',
  }))
  edges.value = [...seq, ...loops]
}
watch(() => [props.stage, props.reviewCycle], () => void render(), { deep: true, immediate: true })

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
      <div class="head-lead">
        <h3>{{ stage?.name || '当前阶段' }}</h3>
        <span v-if="reviewCycle" class="cycle mono">Review Cycle {{ reviewCycle.current }}/{{ reviewCycle.max }}</span>
      </div>
      <span class="status-pill" :class="`tone-${toneOf(stage?.status || 'PENDING')}`">{{ statusText[stage?.status || ''] || stage?.status || '待执行' }}</span>
    </header>
    <p class="stage-desc">{{ stage?.key || '' }} · 阶段内 Agent 顺序协作与驳回返工</p>
    <div class="agent-canvas">
      <VueFlow v-if="nodes.length" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false" :zoom-on-scroll="false" :pan-on-drag="false" :prevent-scrolling="true" fit-view-on-init>
        <Background :gap="18" pattern-color="rgba(148,180,255,0.05)" />
        <template #node-default="{ data }">
          <div class="agent-box" :class="[`tone-${data.tone}`, { current: data.current }]">
            <!-- 顺序协作：左进右出 -->
            <Handle id="in" type="target" :position="Position.Left" class="h-seq" />
            <Handle id="out" type="source" :position="Position.Right" class="h-seq" />
            <!-- 回环返工：底部绕行 -->
            <Handle id="loop-in" type="target" :position="Position.Bottom" class="h-loop" />
            <Handle id="loop-out" type="source" :position="Position.Bottom" class="h-loop" />
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
.panel { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); min-height: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; }
.head-lead { display: flex; align-items: center; gap: 10px; }
.panel-head h3 { font-size: 15px; color: var(--text-1); font-weight: 600; margin: 0; }
.cycle { padding: 3px 10px; border: 1px solid var(--border-accent); border-radius: var(--radius-full); color: var(--accent-300); background: var(--accent-softer); font-size: 11px; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.status-pill { font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); border: 1px solid var(--border-2); color: var(--text-3); }
.status-pill.tone-success { color: var(--success); border-color: rgb(52 211 153 / 40%); background: var(--success-soft); }
.status-pill.tone-warning { color: var(--warning); border-color: rgb(251 191 36 / 40%); background: var(--warning-soft); }
.status-pill.tone-info { color: var(--info); border-color: rgb(96 165 250 / 40%); background: var(--info-soft); }
.status-pill.tone-error { color: var(--error); border-color: rgb(248 113 113 / 40%); background: var(--error-soft); }
.status-pill.tone-purple { color: var(--purple); border-color: rgb(167 139 250 / 45%); background: var(--purple-soft); }
.stage-desc { margin: 4px 0 8px; font-size: 11px; color: var(--text-3); }
.agent-canvas { position: relative; flex: 1; min-height: 190px; border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 12px; }
:deep(.agent-node) { border: none; background: transparent; box-shadow: none; padding: 0; }
.agent-box { display: grid; place-content: center; gap: 2px; width: 132px; height: 54px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-solid-1); text-align: center; transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
.agent-name { font-size: 12px; color: var(--text-1); font-weight: 600; }
.agent-status { font-size: 10px; color: var(--text-3); }
.agent-box.tone-success { border-color: rgb(52 211 153 / 40%); }
.agent-box.tone-success .agent-status { color: var(--success); }
.agent-box.tone-warning { border-color: rgb(251 191 36 / 45%); }
.agent-box.tone-warning .agent-status { color: var(--warning); }
.agent-box.tone-error { border-color: rgb(248 113 113 / 45%); }
.agent-box.tone-error .agent-status { color: var(--error); }
.agent-box.tone-purple { border-color: rgb(167 139 250 / 50%); }
.agent-box.tone-purple .agent-status { color: var(--purple); }
.agent-box.current { border-color: var(--accent-500); box-shadow: 0 0 0 1px var(--border-accent), 0 0 16px var(--accent-glow); animation: breathe 2.2s ease-in-out infinite; }
/* 连接点隐藏但保留连线锚定。 */
.agent-box .h-seq, .agent-box .h-loop { opacity: 0; width: 6px; height: 6px; border: none; background: transparent; pointer-events: none; }
@keyframes breathe { 50% { box-shadow: 0 0 0 1px var(--border-accent), 0 0 26px var(--accent-glow); } }
/* 顺序协作边：平滑贝塞尔实线。 */
:deep(.agent-edge.is-seq .vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 1.6; fill: none; }
/* 回环返工边：警示色虚线，平滑下沉。 */
:deep(.agent-edge.is-loop .vue-flow__edge-path) { stroke: var(--warning); stroke-width: 1.5; stroke-dasharray: 6 4; fill: none; }
:deep(.agent-edge.is-loop .vue-flow__edge-text) { fill: var(--warning); font-size: 10px; font-weight: 600; }
:deep(.agent-edge.is-loop .vue-flow__edge-textbg) { fill: var(--surface-solid-1); }
.metrics { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between; gap: 12px; list-style: none; margin: 10px 0 0; padding: 10px 0 0; border-top: 1px solid var(--border-1); }
.metrics li { display: grid; gap: 3px; }
.metrics span { font-size: 10px; color: var(--text-3); white-space: nowrap; }
.metrics b { font-size: 13px; color: var(--text-1); font-weight: 600; white-space: nowrap; }
@media (max-width: 720px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
</style>
