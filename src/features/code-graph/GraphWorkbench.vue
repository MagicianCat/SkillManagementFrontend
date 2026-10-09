<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Handle, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import type { CodeGraphSubgraph } from '../../types/code-graph'
import { layoutGraph } from '../workbench/dagLayout'
import type { ExplorerLevel, RepositoryRelationViewModel, RepositoryViewModel } from './codeGraphViewModel'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps<{
  level: ExplorerLevel
  repositories: RepositoryViewModel[]
  repositoryRelations: RepositoryRelationViewModel[]
  symbolGraph: CodeGraphSubgraph
  selectedId: string
  showEvidence: boolean
  busy: boolean
}>()
const emit = defineEmits<{ selectRepository: [id: string]; selectRelation: [id: string]; selectSymbol: [id: string] }>()

interface FlowNode { id: string; type: string; position: { x: number; y: number }; data: RepositoryViewModel | CodeGraphSubgraph['nodes'][number] }
interface FlowEdge { id: string; source: string; target: string; label?: string; type?: string; animated?: boolean; data?: RepositoryRelationViewModel | CodeGraphSubgraph['relations'][number]; class?: string }
const nodes = ref<FlowNode[]>([])
const edges = ref<FlowEdge[]>([])
const flowId = 'code-graph-explorer-flow'
const { fitView, zoomIn, zoomOut } = useVueFlow({ id: flowId })

async function render() {
  const repositoryMode = props.level === 'overview'
  const sourceNodes = repositoryMode
    ? props.repositories.map((repository) => ({ id: repository.queryKey, width: 228, height: 126, type: 'repository', data: repository }))
    : props.symbolGraph.nodes.map((node) => ({ id: node.id, width: 196, height: 78, type: 'symbol', data: node }))
  const sourceEdges = repositoryMode
    ? props.repositoryRelations.map((relation) => ({ id: relation.id, source: relation.source, target: relation.target, label: props.showEvidence ? relation.type : undefined, data: relation }))
    : props.symbolGraph.relations.filter((relation) => relation.source && relation.target).map((relation, index) => ({ id: relation.id || `relation-${index}`, source: relation.source, target: relation.target, label: props.showEvidence ? (relation.label || relation.kind) : undefined, data: relation }))
  const positions = await layoutGraph(sourceNodes.map(({ id, width, height }) => ({ id, width, height })), sourceEdges, { layerGap: 105, nodeGap: 55, padding: 35 })
  nodes.value = sourceNodes.map((node) => ({ id: node.id, type: node.type, position: positions[node.id] ?? { x: 0, y: 0 }, data: node.data }))
  edges.value = sourceEdges.map((edge) => ({ ...edge, type: 'default', animated: false, class: props.selectedId === edge.id ? 'is-selected' : '' }))
  await nextTick()
  if (nodes.value.length) void fitView({ padding: .22, duration: 250 })
}
watch(() => [props.level, props.repositories, props.repositoryRelations, props.symbolGraph, props.selectedId, props.showEvidence], () => void render(), { deep: true, immediate: true })

function selectNode(event: { node: { id: string; type?: string } }) {
  if (event.node.type === 'repository') emit('selectRepository', event.node.id)
  else emit('selectSymbol', event.node.id)
}
function selectEdge(event: { edge: { id: string } }) { emit('selectRelation', event.edge.id) }
</script>

<template>
  <section class="workbench panel">
    <header>
      <div><b>{{ level === 'overview' ? '跨仓依赖拓扑' : level === 'files' ? '文件与符号局部图谱' : '影响传播路径' }}</b><p>{{ level === 'overview' ? '仓库级聚合视图 · 箭头指向被依赖方' : level === 'files' ? '类节点展示成员；方法节点展示真实 CALLS' : '从变更目标向上追踪潜在依赖方' }}</p></div>
      <div class="toolbar"><button type="button" @click="() => zoomOut()">−</button><button type="button" @click="fitView({ padding: .22, duration: 200 })">适应画布</button><button type="button" @click="() => zoomIn()">＋</button></div>
    </header>
    <div class="stage">
      <VueFlow v-if="nodes.length" :id="flowId" :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :min-zoom="0.35" :max-zoom="1.8" fit-view-on-init @node-click="selectNode" @edge-click="selectEdge">
        <Background :gap="22" pattern-color="rgba(112, 142, 190, .13)" />
        <template #node-repository="{ data, id }">
          <article class="repo-node" :class="{ selected: selectedId === id }">
            <Handle type="target" :position="Position.Left" class="anchor" />
            <Handle type="source" :position="Position.Right" class="anchor" />
            <div class="repo-head"><span class="repo-icon">R</span><span><em>{{ data.role }}</em><small>● 已索引</small></span></div>
            <strong>{{ data.name }}</strong>
            <footer><span>{{ data.files ?? '—' }} 文件</span><span>{{ data.symbols ?? '—' }} 符号</span><span>详情 ›</span></footer>
          </article>
        </template>
        <template #node-symbol="{ data, id }">
          <article class="symbol-node" :class="{ selected: selectedId === id }">
            <Handle type="target" :position="Position.Left" class="anchor" />
            <Handle type="source" :position="Position.Right" class="anchor" />
            <span class="symbol-kind">{{ String(data.kind || 'NODE').slice(0, 12) }}</span>
            <strong>{{ data.label }}</strong>
            <small>{{ data.position?.path || data.filePath || data.qualifiedName || '暂无源码位置' }}</small>
          </article>
        </template>
        <template #edge-label="{ label }"><span v-if="showEvidence" class="edge-label">{{ label }}</span></template>
      </VueFlow>
      <div v-else class="empty">
        <span class="empty-icon">◇</span>
        <strong v-if="busy">正在读取图谱关系…</strong>
        <strong v-else-if="level === 'overview'">当前快照未确认跨仓关系</strong>
        <strong v-else>先搜索并选择一个代码节点</strong>
        <p v-if="!busy && level === 'overview'">仓库索引已经完成；没有契约或依赖证据时，不绘制猜测连线。</p>
        <p v-else-if="!busy">左侧搜索文件、类或方法，然后查看一跳关系与影响路径。</p>
      </div>
      <div v-if="level === 'overview' && repositories.length && !repositoryRelations.length" class="notice">已确认 0 条跨仓关系 · 待解析 {{ repositories.length }} 个仓库</div>
      <div v-if="level === 'impact' && nodes.length === 1 && !edges.length && !busy" class="notice">未解析到上游影响路径；该节点仍可能存在所属、访问或成员关系，请查看“文件与符号”。</div>
    </div>
    <footer class="legend"><span><i class="verified" />已确认关系</span><span><i class="inferred" />推断关系</span><span><i class="internal" />仓内引用</span><em>只读 · 绑定当前 Workflow Run 快照</em></footer>
  </section>
</template>

<style scoped>
.panel{min-width:0;border:1px solid var(--border-1);border-radius:11px;background:var(--surface-1);box-shadow:var(--shadow-sm)}.workbench{display:flex;min-height:0;flex-direction:column;overflow:hidden}.workbench>header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px 13px}.workbench header b{font-size:14px}.workbench header p{margin:5px 0 0;color:var(--text-3);font-size:10px}.toolbar{display:flex;gap:5px}.toolbar button{border:1px solid var(--border-1);border-radius:7px;background:var(--surface-1);padding:7px 9px;color:var(--text-2);font-size:11px;cursor:pointer}.toolbar button:hover{border-color:var(--border-accent);background:var(--accent-softer);color:var(--accent-600)}.stage{position:relative;flex:1;min-height:440px;margin:0 12px;border:1px solid var(--border-1);border-radius:10px;background:var(--surface-2);overflow:hidden}.stage :deep(.vue-flow){background:transparent}.repo-node,.symbol-node{position:relative;border:1px solid var(--border-2);background:var(--surface-solid-1);box-shadow:var(--shadow-sm);cursor:pointer;transition:border-color .15s,box-shadow .15s}.repo-node{display:grid;width:228px;height:126px;padding:14px;border-radius:12px}.repo-node:hover,.repo-node.selected,.symbol-node:hover,.symbol-node.selected{border-color:var(--accent-500);box-shadow:0 6px 20px var(--accent-glow)}.repo-head{display:flex;align-items:center;gap:9px}.repo-icon{display:grid;place-items:center;width:31px;height:31px;border-radius:8px;background:var(--info-soft);color:var(--info);font-weight:800}.repo-head>span:last-child{display:grid;gap:2px}.repo-head em{color:var(--text-3);font-size:9px;font-style:normal;font-weight:700}.repo-head small{color:var(--success);font-size:9px}.repo-node>strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}.repo-node footer{display:flex;gap:9px;padding-top:9px;border-top:1px solid var(--border-1);font-size:9px;color:var(--text-3)}.repo-node footer span:last-child{margin-left:auto;color:var(--accent-500)}.symbol-node{display:grid;width:196px;height:78px;padding:11px 13px;border-radius:9px}.symbol-kind{color:var(--accent-500);font:700 9px var(--font-mono)}.symbol-node strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.symbol-node small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-3);font-size:9px}.anchor{opacity:0;pointer-events:none}.empty{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;color:var(--text-3)}.empty-icon{font-size:34px;color:var(--border-3)}.empty strong{margin-top:10px;color:var(--text-2);font-size:13px}.empty p{max-width:390px;margin:7px 20px 0;line-height:1.6;font-size:10px}.notice{position:absolute;top:14px;left:14px;padding:7px 10px;border:1px solid var(--warning);border-radius:7px;background:var(--warning-soft);color:var(--warning);font-size:9px}.legend{display:flex;align-items:center;gap:16px;padding:12px 18px 14px;color:var(--text-3);font-size:9px}.legend i{display:inline-block;width:20px;margin-right:5px;border-top:2px solid var(--accent-400);vertical-align:middle}.legend i.inferred{border-top-style:dashed;border-top-color:var(--warning)}.legend i.internal{border-top-color:var(--border-3)}.legend em{margin-left:auto;font-style:normal}:deep(.vue-flow__edge-path){stroke:var(--accent-400);stroke-width:2}:deep(.vue-flow__edge.is-selected .vue-flow__edge-path){stroke:var(--accent-600);stroke-width:3}:deep(.vue-flow__edge-text){font-size:9px;fill:var(--text-2)}:deep(.vue-flow__edge-textbg){fill:var(--surface-solid-1);stroke:var(--border-1);stroke-width:1}.edge-label{font-size:9px}@media(max-width:900px){.stage{min-height:400px}.legend{flex-wrap:wrap}.legend em{width:100%;margin:0}}
</style>
