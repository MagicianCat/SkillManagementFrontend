<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow, Position, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { CheckCircleFilledIcon, PlayCircleFilledIcon, TimeFilledIcon, UserCircleIcon, ErrorCircleFilledIcon } from 'tdesign-icons-vue-next'
import type { WorkflowAgentNode, WorkflowEdge, WorkflowStage } from '../../types/workflow'
import type { StatusTone } from '../../types/workbench'
import { layoutGraph } from './dagLayout'

const props = defineProps<{ stage: WorkflowStage | null; reviewCycle?: { current: number; max: number } | null; latestRevision?: number | null }>()

const TONE: Record<string, StatusTone> = {
  COMPLETED: 'success', SUCCEEDED: 'success', SUCCESS: 'success',
  RUNNING: 'warning', STARTING: 'warning', QUEUED: 'warning',
  PENDING: 'info', READY: 'info',
  FAILED: 'error', CANCELLED: 'error',
  WAITING_HUMAN: 'purple', WAITING_ACCEPTANCE: 'purple', WAITING_DESIGN_ACCEPTANCE: 'purple', PAUSED: 'purple', HUMAN_REQUIRED: 'purple',
}
const toneOf = (status: string) => TONE[status] ?? 'neutral'

/** 节点状态图标：完成✓ / 运行中▶(旋转脉冲) / 等待人工◐ / 排队🕐 / 失败✕。 */
const STATE_ICON: Record<string, unknown> = {
  success: CheckCircleFilledIcon,
  warning: PlayCircleFilledIcon,
  purple: UserCircleIcon,
  info: TimeFilledIcon,
  error: ErrorCircleFilledIcon,
  neutral: TimeFilledIcon,
}
/** 状态副文案：比状态词更具体，区分"等人工"与"排队"。 */
function agentSubtext(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: '已完成', SUCCEEDED: '已完成', SUCCESS: '已完成',
    RUNNING: '正在执行…', STARTING: '正在启动…', QUEUED: '排队等待中',
    WAITING_HUMAN: '等待人工处理…', WAITING_ACCEPTANCE: '等待验收…', HUMAN_REQUIRED: '等待人工处理…',
    PAUSED: '已暂停', PENDING: '等待前序', READY: '就绪待执行',
    FAILED: '执行失败', CANCELLED: '已取消',
  }
  return map[status] ?? status
}

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
  // 卡片加宽到 168px：状态图标 + 名称 + 副文案一行排开。
  const layoutNodes = agents.map((agent) => ({ id: agent.key, width: 168, height: 64 }))
  const layoutEdges = flowEdges.value.map((edge, i) => ({ id: `f${i}`, source: edge.from, target: edge.to as string }))
  const positions = await layoutGraph(layoutNodes, layoutEdges, { layerGap: 64, nodeGap: 44, padding: 18 })
  nodes.value = agents.map((agent) => {
    const currentAgent = String(props.stage?.currentAgent ?? '')
    const current = [agent.key, agent.name, agent.displayName].filter(Boolean).some((value) => String(value) === currentAgent)
    return {
      id: agent.key,
      position: positions[agent.key] ?? { x: 0, y: 0 },
      data: { label: agent.displayName || agent.name || agent.key, status: agent.status, tone: toneOf(agent.status), current, subtext: agentSubtext(agent.status), icon: STATE_ICON[toneOf(agent.status)] ?? STATE_ICON.neutral },
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
    label: props.reviewCycle ? `↺ 驳回返工导轨 (Review Cycle ${props.reviewCycle.current}/${props.reviewCycle.max})` : '↺ 驳回返工导轨',
    class: 'agent-edge is-loop',
  }))
  edges.value = [...seq, ...loops]
}
watch(() => [props.stage, props.reviewCycle], () => void render(), { deep: true, immediate: true })

const metrics = computed(() => ({
  agent: props.stage?.agents?.find((item) => [item.key, item.name, item.displayName].includes(props.stage?.currentAgent ?? ''))?.displayName || props.stage?.currentAgent || '—',
  loop: props.reviewCycle ? `${props.reviewCycle.current}/${props.reviewCycle.max}` : '—',
  revision: props.latestRevision != null ? `#${props.latestRevision}` : '—',
  token: '—',
  elapsed: '—',
}))
const statusText: Record<string, string> = { COMPLETED: '已完成', SUCCEEDED: '已完成', RUNNING: '运行中', STARTING: '启动中', QUEUED: '排队中', PENDING: '待执行', WAITING_HUMAN: '等待人工', WAITING_ACCEPTANCE: '待人员验收', WAITING_DESIGN_ACCEPTANCE: '待人员验收', PAUSED: '已暂停', FAILED: '失败', CANCELLED: '已取消' }
</script>

<template>
  <section class="stage-panel panel" data-testid="agent-team">
    <header class="panel-head">
      <div class="head-lead">
        <h3>{{ stage?.displayName || stage?.name || '当前阶段' }}</h3>
        <span v-if="reviewCycle" class="cycle mono">Review Cycle {{ reviewCycle.current }}/{{ reviewCycle.max }}</span>
      </div>
      <span class="status-pill" :class="`tone-${toneOf(stage?.status || 'PENDING')}`"><i class="dot" />{{ statusText[stage?.status || ''] || stage?.status || '待执行' }}</span>
    </header>
    <div class="flow-head">
      <span class="flow-title"><i class="flow-bar" />{{ stage?.key || '' }} · 环路协作流程</span>
      <span v-if="reviewCycle" class="iteration-chip">第 {{ reviewCycle.current }} 轮迭代中</span>
    </div>
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
            <component :is="data.icon" class="agent-icon" />
            <div class="agent-text">
              <span class="agent-name">{{ data.label }}</span>
              <span class="agent-status">{{ data.subtext }}</span>
            </div>
            <i v-if="data.current" class="live-dot" :class="`dot-${data.tone}`" aria-label="正在执行" />
          </div>
        </template>
      </VueFlow>
      <p v-else class="empty">等待 Agent 编排数据…</p>
    </div>
    <ul class="metrics">
      <li><span>当前 Agent</span><b class="m-accent">{{ metrics.agent }}</b></li>
      <li><span>Loop</span><b class="mono m-warning">{{ metrics.loop }}</b></li>
      <li><span>最新 Revision</span><b class="mono m-info">{{ metrics.revision }}</b></li>
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
.status-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); border: 1px solid var(--border-2); color: var(--text-3); }
.status-pill .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-pill.tone-success { color: var(--success); border-color: rgb(52 211 153 / 40%); background: var(--success-soft); }
.status-pill.tone-warning { color: var(--warning); border-color: rgb(251 191 36 / 40%); background: var(--warning-soft); }
.status-pill.tone-warning .dot { animation: pulse 1.6s ease-in-out infinite; }
.status-pill.tone-info { color: var(--info); border-color: rgb(96 165 250 / 40%); background: var(--info-soft); }
.status-pill.tone-error { color: var(--error); border-color: rgb(248 113 113 / 40%); background: var(--error-soft); }
.status-pill.tone-purple { color: var(--purple); border-color: rgb(167 139 250 / 45%); background: var(--purple-soft); }
/* 流程标题条：竖线标识 + 迭代中角标 */
.flow-head { display: flex; align-items: center; justify-content: space-between; margin: 10px 0 8px; }
.flow-title { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--text-2); }
.flow-bar { width: 3px; height: 12px; border-radius: 2px; background: var(--accent-500); }
.iteration-chip { padding: 3px 10px; border: 1px solid rgb(251 191 36 / 45%); border-radius: var(--radius-full); color: var(--warning); background: var(--warning-soft); font-size: 11px; font-weight: 600; }
.agent-canvas { position: relative; flex: 1; min-height: 190px; border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 12px; }
:deep(.agent-node) { border: none; background: transparent; box-shadow: none; padding: 0; }
/* Agent 卡片：图标左置 + 名称/副文案双行，状态驱动描边与图标色 */
.agent-box { position: relative; display: flex; align-items: center; gap: 10px; width: 168px; height: 64px; padding: 0 14px; border: 1px solid var(--border-2); border-radius: var(--radius-md); background: var(--surface-solid-1); text-align: left; transition: border-color var(--duration-fast), box-shadow var(--duration-fast), opacity var(--duration-fast); }
.agent-icon { flex: none; font-size: 22px; }
.agent-text { display: grid; gap: 3px; min-width: 0; }
.agent-name { font-size: 13px; color: var(--text-1); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.agent-status { font-size: 11px; color: var(--text-3); }
/* 完成态：绿描边 + 绿图标，轻微降饱和表示"已过" */
.agent-box.tone-success { border-color: rgb(52 211 153 / 45%); background: rgb(52 211 153 / 6%); }
.agent-box.tone-success .agent-icon { color: var(--success); }
.agent-box.tone-success .agent-status { color: var(--success); }
/* 运行态：琥珀描边 + 呼吸辉光，图标脉冲 */
.agent-box.tone-warning { border-color: rgb(251 191 36 / 55%); background: rgb(251 191 36 / 8%); box-shadow: 0 0 0 1px rgb(251 191 36 / 25%), 0 0 18px rgb(251 191 36 / 18%); }
.agent-box.tone-warning .agent-icon { color: var(--warning); animation: pulse 1.6s ease-in-out infinite; }
.agent-box.tone-warning .agent-status { color: var(--warning); }
/* 等待人工：紫描边 + 紫图标 */
.agent-box.tone-purple { border-color: rgb(167 139 250 / 55%); background: rgb(167 139 250 / 8%); }
.agent-box.tone-purple .agent-icon { color: var(--purple); }
.agent-box.tone-purple .agent-status { color: var(--purple); }
/* 排队/待执行：灰蓝描边，整体降透明 */
.agent-box.tone-info { border-color: var(--border-2); background: var(--surface-1); opacity: 0.72; }
.agent-box.tone-info .agent-icon { color: var(--text-3); }
/* 失败态：红描边 */
.agent-box.tone-error { border-color: rgb(248 113 113 / 55%); background: rgb(248 113 113 / 8%); }
.agent-box.tone-error .agent-icon { color: var(--error); }
.agent-box.tone-error .agent-status { color: var(--error); }
/* 当前执行节点：呼吸灯随节点状态着色（执行中黄 / 等人工紫 / 失败红 / 其余沿用 accent） */
.agent-box.current { border-color: var(--accent-500); box-shadow: 0 0 0 1px var(--border-accent), 0 0 16px var(--accent-glow); }
.agent-box .live-dot { position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-400); box-shadow: 0 0 8px var(--accent-glow); animation: pulse 1.6s ease-in-out infinite; }
.agent-box .live-dot.dot-warning { background: var(--warning); box-shadow: 0 0 8px rgb(251 191 36 / 60%); }
.agent-box .live-dot.dot-purple { background: var(--purple); box-shadow: 0 0 8px rgb(167 139 250 / 60%); }
.agent-box .live-dot.dot-error { background: var(--error); box-shadow: 0 0 8px rgb(248 113 113 / 60%); }
.agent-box .live-dot.dot-success { background: var(--success); box-shadow: 0 0 8px rgb(52 211 153 / 60%); }
/* 连接点隐藏但保留连线锚定。 */
.agent-box .h-seq, .agent-box .h-loop { opacity: 0; width: 6px; height: 6px; border: none; background: transparent; pointer-events: none; }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes breathe { 50% { box-shadow: 0 0 0 1px var(--border-accent), 0 0 26px var(--accent-glow); } }
/* 顺序协作边：平滑贝塞尔实线。 */
:deep(.agent-edge.is-seq .vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 1.6; fill: none; }
/* 回环返工边：警示色虚线 + 导轨式底条观感。 */
:deep(.agent-edge.is-loop .vue-flow__edge-path) { stroke: var(--warning); stroke-width: 1.5; stroke-dasharray: 6 4; fill: none; }
:deep(.agent-edge.is-loop .vue-flow__edge-text) { fill: var(--warning); font-size: 10px; font-weight: 600; }
:deep(.agent-edge.is-loop .vue-flow__edge-textbg) { fill: var(--surface-solid-1); rx: 8px; }
/* 指标行：与原型一致的语义着色 */
.metrics { display: grid; grid-template-columns: repeat(5, auto); justify-content: space-between; gap: 12px; list-style: none; margin: 10px 0 0; padding: 10px 0 0; border-top: 1px solid var(--border-1); }
.metrics li { display: grid; gap: 3px; }
.metrics span { font-size: 10px; color: var(--text-3); white-space: nowrap; }
.metrics b { font-size: 13px; color: var(--text-1); font-weight: 600; white-space: nowrap; }
.metrics .m-accent { color: var(--warning); }
.metrics .m-warning { color: var(--warning); }
.metrics .m-info { color: var(--info); }
@media (max-width: 720px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
</style>
