<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import type { WorkflowStage } from '../../types/workflow'
import type { StatusTone } from '../../types/workbench'
import { layoutGraph } from './dagLayout'

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
interface FlowEdge { id: string; source: string; target: string; animated?: boolean; label?: string; class?: string }
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])

/** 蓝图节点（含未实例化的后续阶段），key 与后端 stage_key 对应，便于真实数据接管。 */
interface BlueprintNode { key: string; label: string; sub?: string }
/** 研发工作流蓝图：需求分析 → PRD → [架构设计 ∥ UI设计] → 设计完成 → 人工验收。 */
const BLUEPRINT_NODES: BlueprintNode[] = [
  { key: 'REQUIREMENT', label: '需求分析', sub: '需求理解与分析' },
  { key: 'PRD', label: 'PRD', sub: '产品需求文档' },
  { key: 'ARCHITECTURE', label: '架构设计', sub: '技术架构设计' },
  { key: 'UI_DESIGN', label: 'UI设计', sub: '界面与交互设计' },
  { key: 'DESIGN_DONE', label: '设计完成', sub: '设计产物整合' },
  { key: 'ACCEPTANCE', label: '人工验收', sub: '人工审核与确认' },
]
const BLUEPRINT_EDGES: Array<{ from: string; to: string }> = [
  { from: 'REQUIREMENT', to: 'PRD' },
  { from: 'PRD', to: 'ARCHITECTURE' },
  { from: 'PRD', to: 'UI_DESIGN' },
  { from: 'ARCHITECTURE', to: 'DESIGN_DONE' },
  { from: 'UI_DESIGN', to: 'DESIGN_DONE' },
  { from: 'DESIGN_DONE', to: 'ACCEPTANCE' },
]

/** 真实阶段按 key 归一化索引（key 大小写/命名可能不同，做宽松匹配）。 */
function matchStage(key: string): WorkflowStage | undefined {
  const norm = key.toLowerCase().replace(/[^a-z]/g, '')
  return props.stages.find((stage) => {
    const k = String(stage.key || '').toLowerCase().replace(/[^a-z]/g, '')
    if (!k || !norm) return false
    return k === norm || k.includes(norm) || norm.includes(k)
  })
}

interface DisplayNode { id: string; key: string; label: string; sub: string; status: string; stage: WorkflowStage | null }

/** 展示节点 = 蓝图全量，能用真实 stage 则接管其状态。 */
function buildDisplayNodes(): DisplayNode[] {
  return BLUEPRINT_NODES.map((bp) => {
    const stage = matchStage(bp.key) ?? null
    return {
      id: stage ? String(stage.id) : `bp-${bp.key}`,
      key: bp.key,
      label: stage?.name || bp.label,
      sub: bp.sub ?? '',
      status: stage ? String(stage.status) : 'PENDING',
      stage,
    }
  })
}
const displayNodes = computed<DisplayNode[]>(buildDisplayNodes)

/** 展示边：用节点 id 重新映射蓝图边。 */
const displayEdges = computed(() => {
  const idByKey = new Map(displayNodes.value.map((node) => [node.key, node.id]))
  return BLUEPRINT_EDGES.map((edge) => ({ from: idByKey.get(edge.from) ?? edge.from, to: idByKey.get(edge.to) ?? edge.to }))
})

async function render() {
  const list = displayNodes.value
  if (!list.length) { nodes.value = []; edges.value = []; return }
  const layoutNodes = list.map((node) => ({ id: node.id, width: 150, height: 60 }))
  const layoutEdges = displayEdges.value.map((pair, i) => ({ id: `e${i}`, source: pair.from, target: pair.to }))
  const positions = await layoutGraph(layoutNodes, layoutEdges)
  nodes.value = list.map((node): FlowNode => {
    const tone = toneOf(node.status)
    const current = node.stage ? String(node.stage.id) === String(props.currentId ?? '') : false
    const selected = node.stage ? String(node.stage.id) === String(props.selectedId ?? '') : false
    return {
      id: node.id,
      position: positions[node.id] ?? { x: 0, y: 0 },
      data: { label: node.label, sub: node.sub, status: node.status, tone, current, selected, attention: node.stage?.attention || node.status === 'HUMAN_REQUIRED', virtual: !node.stage },
      class: ['dag-node', `tone-${tone}`, current ? 'is-current' : '', selected ? 'is-selected' : '', !node.stage ? 'is-virtual' : ''].filter(Boolean).join(' '),
    }
  })
  edges.value = displayEdges.value.map((pair, i) => {
    const target = list.find((node) => node.id === pair.to)
    const active = target ? ['RUNNING', 'PROVISIONING'].includes(target.status) : false
    return { id: `e${i}`, source: pair.from, target: pair.to, animated: active, class: 'dag-edge' }
  })
}
watch(() => [props.stages, props.selectedId, props.currentId], () => void render(), { deep: true, immediate: true })

function onNodeClick(event: { node: { id: string } }) {
  // 仅真实阶段（已实例化、有数值 id）可选中联动。
  if (!String(event.node.id).startsWith('bp-')) emit('select', event.node.id)
}
</script>

<template>
  <section class="dag-panel panel">
    <header class="panel-head">
      <div>
        <h3>研发流程</h3>
        <p class="panel-sub">从需求到验收，Agent 协同完成研发阶段的全部工作</p>
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
        <Background :gap="20" pattern-color="rgba(148,180,255,0.06)" />
        <template #node-default="{ data }">
          <div class="stage-node" :class="[`tone-${data.tone}`, { current: data.current, selected: data.selected, attention: data.attention, virtual: data.virtual }]">
            <span class="status-dot" />
            <span class="node-text">
              <span class="node-name">{{ data.label }}</span>
              <span v-if="data.sub" class="node-sub">{{ data.sub }}</span>
            </span>
          </div>
        </template>
      </VueFlow>
      <p v-if="!nodes.length" class="empty">等待阶段数据…</p>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.panel-head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; gap: 12px; }
.panel-head h3 { font-size: 13px; letter-spacing: 0.06em; color: var(--text-2); font-weight: 600; margin: 0; }
.panel-sub { margin: 3px 0 0; font-size: 11px; color: var(--text-3); }
.legend { display: flex; gap: 14px; list-style: none; margin: 0; padding: 0; flex: none; }
.legend li { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-3); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.tone-success { background: var(--success); box-shadow: 0 0 6px var(--success); }
.dot.tone-warning { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
.dot.tone-info { background: var(--info); }
.dot.tone-purple { background: var(--purple); box-shadow: 0 0 6px var(--purple); }
.dag-canvas { position: relative; height: 200px; border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.dag-canvas :deep(.vue-flow) { background: transparent; }
.empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 12px; }
:deep(.dag-node) { border: none; background: transparent; box-shadow: none; padding: 0; }
.stage-node { display: flex; align-items: center; gap: 9px; width: 150px; height: 60px; padding: 0 12px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-solid-1); cursor: pointer; transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
.stage-node.virtual { cursor: default; opacity: 0.75; }
.stage-node .status-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--text-4); }
.stage-node.tone-success .status-dot { background: var(--success); box-shadow: 0 0 8px var(--success); }
.stage-node.tone-warning .status-dot { background: var(--warning); box-shadow: 0 0 8px var(--warning); animation: pulse 1.6s ease-in-out infinite; }
.stage-node.tone-info .status-dot { background: var(--info); }
.stage-node.tone-error .status-dot { background: var(--error); box-shadow: 0 0 8px var(--error); }
.stage-node.tone-purple .status-dot { background: var(--purple); box-shadow: 0 0 8px var(--purple); }
.node-text { display: grid; gap: 1px; min-width: 0; }
.stage-node .node-name { font-size: 12px; color: var(--text-1); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-node .node-sub { font-size: 9px; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage-node.tone-success { border-color: rgb(52 211 153 / 40%); }
.stage-node.tone-warning { border-color: rgb(251 191 36 / 45%); }
.stage-node.tone-error { border-color: rgb(248 113 113 / 45%); }
.stage-node.tone-purple { border-color: rgb(167 139 250 / 50%); }
.stage-node.current { box-shadow: 0 0 0 1px var(--border-accent), 0 0 18px var(--accent-glow); animation: breathe 2.4s ease-in-out infinite; }
.stage-node.selected { border-color: var(--accent-500); }
.stage-node.attention { border-style: dashed; }
@keyframes pulse { 50% { opacity: 0.45; } }
@keyframes breathe { 50% { box-shadow: 0 0 0 1px var(--border-accent), 0 0 30px var(--accent-glow); } }
:deep(.dag-edge .vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 1.4; }
:deep(.dag-edge.animated .vue-flow__edge-path) { stroke: var(--accent-500); stroke-dasharray: 6 4; }
</style>
