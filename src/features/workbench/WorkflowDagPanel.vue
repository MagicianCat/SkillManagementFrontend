<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow, Position, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { WorkflowStage } from '../../types/workflow'
import type { StatusTone } from '../../types/workbench'
import { layoutGraph } from './dagLayout'
import { pipelineStageNodes, pipelineStageEdges, pipelineNodeIdForStageKey } from './pipeline-flow'

const props = defineProps<{ stages: WorkflowStage[]; selectedId?: string | null; currentId?: string | null }>()
const emit = defineEmits<{ select: [stageId: string] }>()

const TONE: Record<string, StatusTone> = {
  COMPLETED: 'success',
  RUNNING: 'warning', PROVISIONING: 'warning', READY: 'info', PENDING: 'info',
  FAILED: 'error', CANCELLED: 'error', STALE: 'error',
  HUMAN_REQUIRED: 'purple', PAUSED: 'purple',
}
const toneOf = (status: string) => TONE[status] ?? 'neutral'

// 节点/边用最小本地类型，避免 vue-flow Node 泛型的递归类型实例化（TS2589）。
interface FlowNode { id: string; position: { x: number; y: number }; data: Record<string, unknown>; class?: string }
interface FlowEdge { id: string; source: string; target: string; type?: string; animated?: boolean; label?: string; class?: string; sourceHandle?: string; targetHandle?: string }
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])

/** 真实 stage 按后端 stage_key 归到流程节点 id。 */
function stageForNode(nodeId: string): WorkflowStage | undefined {
  return props.stages.find((stage) => pipelineNodeIdForStageKey(String(stage.key || '')) === nodeId)
}

interface DisplayNode { id: string; key: string; label: string; sub: string; status: string; stage: WorkflowStage | null; loop: { current: number; max: number } | null }

/** 展示节点 = 全链路流程骨架（与最佳实践页同源），真实 stage 接管其状态/名称/loop。 */
function buildDisplayNodes(): DisplayNode[] {
  return pipelineStageNodes.map((pn) => {
    const stage = stageForNode(pn.id) ?? null
    const loop = stage ? { current: (stage.loopCount ?? 0) + 1, max: stage.maxLoopCount ?? 0 } : null
    return {
      id: stage ? String(stage.id) : `pipe-${pn.id}`,
      key: pn.id,
      label: stage?.displayName || stage?.name || pn.name,
      sub: pn.sub ?? '',
      status: stage ? String(stage.status) : 'PENDING',
      stage,
      loop,
    }
  })
}
const displayNodes = computed<DisplayNode[]>(buildDisplayNodes)

/** 展示边：流程骨架边按节点 id 重新映射（真实 stage 用运行 id，未实例化用 pipe-id）。 */
const displayEdges = computed(() => {
  const idByKey = new Map(displayNodes.value.map((node) => [node.key, node.id]))
  return pipelineStageEdges.map((edge) => ({ from: idByKey.get(edge.from) ?? edge.from, to: idByKey.get(edge.to) ?? edge.to }))
})

async function render() {
  const list = displayNodes.value
  if (!list.length) { nodes.value = []; edges.value = []; return }
  const layoutNodes = list.map((node) => ({ id: node.id, width: 156, height: 62 }))
  const layoutEdges = displayEdges.value.map((pair, i) => ({ id: `e${i}`, source: pair.from, target: pair.to }))
  const positions = await layoutGraph(layoutNodes, layoutEdges, { layerGap: 56, nodeGap: 26, padding: 18 })
  nodes.value = list.map((node): FlowNode => {
    const tone = toneOf(node.status)
    const current = node.stage ? String(node.stage.id) === String(props.currentId ?? '') : false
    const selected = node.stage ? String(node.stage.id) === String(props.selectedId ?? '') : false
    return {
      id: node.id,
      position: positions[node.id] ?? { x: 0, y: 0 },
      data: { label: node.label, sub: node.sub, status: node.status, tone, current, selected, loop: node.loop, attention: node.stage?.attention || node.status === 'HUMAN_REQUIRED', virtual: !node.stage },
      class: ['dag-node', `tone-${tone}`, current ? 'is-current' : '', selected ? 'is-selected' : '', !node.stage ? 'is-virtual' : ''].filter(Boolean).join(' '),
    }
  })
  edges.value = displayEdges.value.map((pair, i) => {
    const source = list.find((node) => node.id === pair.from)
    const active = source ? ['COMPLETED', 'RUNNING', 'PROVISIONING'].includes(source.status) : false
    return { id: `e${i}`, source: pair.from, target: pair.to, type: 'default', sourceHandle: 'out', targetHandle: 'in', animated: false, class: ['dag-edge', active ? 'is-active' : ''].join(' ') }
  })
}
watch(() => [props.stages, props.selectedId, props.currentId], () => void render(), { deep: true, immediate: true })

function onNodeClick(event: { node: { id: string } }) {
  // 仅真实阶段（已实例化、有数值 id）可选中联动；未实例化的流程骨架节点不可点。
  if (!String(event.node.id).startsWith('pipe-')) emit('select', event.node.id)
}
</script>

<template>
  <section class="dag-panel panel">
    <header class="panel-head">
      <div>
        <h3>研发流程</h3>
        <p class="panel-sub">从需求到部署，Agent 协同完成研发全链路的全部工作</p>
      </div>
      <ul class="legend">
        <li><i class="dot tone-success" />已完成</li>
        <li><i class="dot tone-warning" />进行中</li>
        <li><i class="dot tone-info" />待执行</li>
        <li><i class="dot tone-purple" />人工介入</li>
      </ul>
    </header>
    <div class="dag-canvas">
      <VueFlow :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false" :zoom-on-scroll="false" :pan-on-drag="false" :prevent-scrolling="true" fit-view-on-init @node-click="onNodeClick">
        <Background :gap="20" pattern-color="rgba(148,180,255,0.05)" />
        <template #node-default="{ data }">
          <div class="stage-node" :class="[`tone-${data.tone}`, { current: data.current, selected: data.selected, attention: data.attention, virtual: data.virtual }]">
            <!-- 连线锚点：右出左进，贝塞尔边严格从右缘中点到左缘中点 -->
            <Handle id="in" type="target" :position="Position.Left" class="h-dag" />
            <Handle id="out" type="source" :position="Position.Right" class="h-dag" />
            <span v-if="data.loop" class="loop-badge mono">Loop {{ data.loop.current }}/{{ data.loop.max }}</span>
            <span class="node-head">
              <span class="status-dot" />
              <span class="node-name">{{ data.label }}</span>
            </span>
            <span v-if="data.sub" class="node-sub">{{ data.sub }}</span>
          </div>
        </template>
      </VueFlow>
      <p v-if="!nodes.length" class="empty">等待阶段数据…</p>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 14px 18px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.panel-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; gap: 12px; }
.panel-head h3 { font-size: 14px; letter-spacing: 0.04em; color: var(--text-1); font-weight: 600; margin: 0; }
.panel-sub { margin: 3px 0 0; font-size: 11px; color: var(--text-3); }
.legend { display: flex; gap: 14px; list-style: none; margin: 0; padding: 0; flex: none; }
.legend li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-3); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.tone-success { background: var(--success); }
.dot.tone-warning { background: var(--warning); }
.dot.tone-info { background: var(--info); }
.dot.tone-purple { background: var(--purple); }
.dag-canvas { position: relative; height: 240px; border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.dag-canvas :deep(.vue-flow) { background: transparent; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 12px; }
:deep(.dag-node) { border: none; background: transparent; box-shadow: none; padding: 0; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.stage-node { position: relative; display: grid; gap: 3px; align-content: center; width: 156px; height: 62px; padding: 8px 12px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-solid-1); cursor: pointer; transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
.stage-node.virtual { cursor: default; opacity: 0.85; border-style: dashed; }
.node-head { display: flex; align-items: center; gap: 7px; min-width: 0; }
.stage-node .status-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--text-4); }
.stage-node.tone-success .status-dot { background: var(--success); }
.stage-node.tone-warning .status-dot { background: var(--warning); animation: pulse 1.6s ease-in-out infinite; }
.stage-node.tone-info .status-dot { background: var(--info); }
.stage-node.tone-error .status-dot { background: var(--error); }
.stage-node.tone-purple .status-dot { background: var(--purple); }
.stage-node .node-name { font-size: 13px; color: var(--text-1); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Loop 徽标浮动在节点右上角，不挤压阶段名。 */
.loop-badge { position: absolute; top: -9px; right: 8px; padding: 1px 7px; border-radius: var(--radius-full); font-size: 9px; color: var(--warning); background: var(--surface-solid-1); border: 1px solid rgb(251 191 36 / 50%); box-shadow: var(--shadow-sm); }
.stage-node .node-sub { font-size: 9px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 15px; }
.stage-node.tone-success { border-color: rgb(52 211 153 / 40%); }
.stage-node.tone-warning { border-color: rgb(251 191 36 / 45%); }
.stage-node.tone-error { border-color: rgb(248 113 113 / 45%); }
.stage-node.tone-purple { border-color: rgb(167 139 250 / 50%); }
/* 连线锚点隐藏但保留锚定（右出左进）。 */
.stage-node .h-dag { opacity: 0; width: 6px; height: 6px; border: none; background: transparent; pointer-events: none; }
.stage-node.current { border-color: var(--accent-500); box-shadow: 0 0 0 1px var(--border-accent), 0 0 18px var(--accent-glow); animation: breathe 2.4s ease-in-out infinite; }
.stage-node.selected { border-color: var(--accent-500); }
.stage-node.attention { border-style: dashed; }
@keyframes pulse { 50% { opacity: 0.45; } }
@keyframes breathe { 50% { box-shadow: 0 0 0 1px var(--border-accent), 0 0 30px var(--accent-glow); } }
/* 平滑曲线连接：贝塞尔路径用柔和描边，已完成/进行中的源阶段边高亮。 */
:deep(.dag-edge .vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 1.6; fill: none; }
:deep(.dag-edge.is-active .vue-flow__edge-path) { stroke: var(--accent-400); stroke-width: 1.8; }
:deep(.vue-flow__edge.animated .vue-flow__edge-path) { stroke-dasharray: 6 4; }
</style>
