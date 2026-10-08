<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { VueFlow, type Edge, type Node, Position } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  getCodeGraphContext,
  getCodeGraphImpact,
  getCodeGraphNode,
  getCodeGraphOverview,
  getCodeGraphRouteMap,
  getCodeGraphTrace,
  searchCodeGraph,
} from '../../api/code-graph.api'
import type { CodeGraphNode, CodeGraphOverview, CodeGraphSearchResult, CodeGraphSubgraph } from '../../types/code-graph'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const props = defineProps<{ runId: string; readonly?: boolean }>()
const overview = ref<CodeGraphOverview | null>(null)
const results = ref<CodeGraphSearchResult | null>(null)
const selected = ref<CodeGraphNode | null>(null)
const facts = ref<Array<{ title: string; detail: string; nodeId?: string | null }>>([])
const graph = ref<CodeGraphSubgraph>({ nodes: [], relations: [] })
const query = ref('')
const kind = ref('')
const selectedRepository = ref('')
const mode = ref<'IMPACT' | 'TRACE' | 'ROUTE'>('IMPACT')
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const routeFrom = ref('')
const routeTo = ref('')

const counts = computed(() => overview.value?.counts ?? {})
const discoveredFiles = computed(() => Array.from(new Set((results.value?.items ?? []).map((item) => item.position?.path).filter((value): value is string => Boolean(value)))))
const discoveredModules = computed(() => Array.from(new Set(discoveredFiles.value.map((file) => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '').filter(Boolean))))
const repoName = (repo: CodeGraphOverview['repositories'][number]) => repo.displayName || repo.name || repo.logicalName || repo.logicalRepositoryKey || repo.alias || '未命名仓库'
const flowNodes = computed<Node[]>(() => graph.value.nodes.map((node, index) => ({
  id: node.id,
  type: 'default',
  position: { x: (index % 3) * 230, y: Math.floor(index / 3) * 100 },
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: { label: `${node.label} · ${node.kind}` },
})))
const flowEdges = computed<Edge[]>(() => graph.value.relations.map((relation, index) => ({
  id: relation.id ?? `${relation.source}-${relation.target}-${index}`,
  source: relation.source,
  target: relation.target,
  label: relation.label ?? relation.kind,
  animated: false,
})))

async function loadOverview() {
  loading.value = true
  try { overview.value = await getCodeGraphOverview(props.runId); error.value = '' }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '图谱概览加载失败' }
  finally { loading.value = false }
}

async function search() {
  if (!query.value.trim()) { results.value = null; return }
  busy.value = true
  try { results.value = await searchCodeGraph(props.runId, { query: query.value.trim(), kind: kind.value || undefined, repository: selectedRepository.value || undefined, limit: 30 }) }
  catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '图谱搜索失败') }
  finally { busy.value = false }
}

async function selectNode(node: CodeGraphNode) {
  selected.value = node
  routeFrom.value ||= node.id
  try {
    const [detail, context] = await Promise.all([getCodeGraphNode(props.runId, node.id), getCodeGraphContext(props.runId, node.id)])
    selected.value = detail
    facts.value = context.facts
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '节点详情加载失败') }
}
function selectFlowNode(event: { node?: { id?: string } }) {
  const id = event.node?.id
  const node = id ? graph.value.nodes.find((item) => item.id === id) : undefined
  if (node) void selectNode(node)
}

async function runAnalysis() {
  const nodeId = selected.value?.id
  if (!nodeId && mode.value !== 'ROUTE' && mode.value !== 'TRACE') { MessagePlugin.warning('请先选择一个节点'); return }
  if (mode.value === 'TRACE' && (!routeFrom.value || !routeTo.value)) { MessagePlugin.warning('请选择起点和终点'); return }
  busy.value = true
  try {
    graph.value = mode.value === 'IMPACT'
      ? await getCodeGraphImpact(props.runId, nodeId as string)
      : mode.value === 'TRACE'
        ? await getCodeGraphTrace(props.runId, routeFrom.value, routeTo.value)
        : await getCodeGraphRouteMap(props.runId)
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '图谱分析失败') }
  finally { busy.value = false }
}

function chooseRepository(name: string) { selectedRepository.value = name; kind.value = ''; query.value = ''; results.value = null }
function chooseModule(name: string) { kind.value = ''; query.value = name.split('/').at(-1) ?? name; void search() }
function chooseFile(path: string) { kind.value = 'FILE'; query.value = path.split('/').at(-1) ?? path; void search() }

onMounted(loadOverview)
</script>

<template>
  <section class="browser" data-testid="code-graph-browser" :aria-readonly="readonly !== false">
    <div class="browser-head">
      <div><p class="eyebrow">READ-ONLY EXPLORER</p><h2>代码图谱浏览</h2><p class="muted">基于当前 Workflow Run 的冻结代码图谱，只读查看。</p></div>
      <div class="counts" v-if="overview"><span>{{ counts.repositories ?? overview.repositories.length }} 仓库</span><span>{{ counts.modules ?? overview.modules?.length ?? 0 }} 模块</span><span>{{ counts.symbols ?? 0 }} 符号</span></div>
    </div>
    <div v-if="loading" class="empty">正在加载图谱概览…</div>
    <div v-else-if="error" class="error-block">{{ error }} <button type="button" @click="loadOverview">重新加载</button></div>
    <template v-else>
      <div class="browser-grid">
        <aside class="navigator" aria-label="代码仓库导航">
          <h3>代码仓库</h3>
          <button v-for="repo in overview?.repositories ?? []" :key="repoName(repo)" type="button" class="nav-item" @click="chooseRepository(repo.logicalName || repo.alias || repo.name || '')">{{ repoName(repo) }}<small>{{ selectedRepository === (repo.logicalName || repo.alias || repo.name) ? '已限定此仓库' : `${repo.fileCount ?? repo.nodeCount ?? '—'} 节点` }}</small></button>
          <h3>模块</h3>
          <button v-for="module in discoveredModules" :key="module" type="button" class="nav-item" @click="chooseModule(module)">{{ module }}</button>
          <h3>文件</h3>
          <button v-for="file in discoveredFiles" :key="file" type="button" class="nav-item" @click="chooseFile(file)">{{ file.split('/').at(-1) }}<small>{{ file }}</small></button>
        </aside>
        <div class="explorer">
          <form class="search" @submit.prevent="search"><input v-model="query" aria-label="搜索代码图谱" placeholder="搜索仓库、模块、文件或符号…" /><select v-model="kind" aria-label="节点类型"><option value="">全部类型</option><option value="REPOSITORY">仓库</option><option value="MODULE">模块</option><option value="FILE">文件</option><option value="SYMBOL">符号</option></select><button class="primary" type="submit" :disabled="busy">{{ busy ? '查询中…' : '搜索' }}</button></form>
          <div v-if="results" class="results" aria-label="代码图谱搜索结果"><button v-for="node in results.items" :key="node.id" type="button" class="result" @click="selectNode(node)"><span>{{ node.label }}</span><small>{{ node.kind }} · {{ node.repository || '未标注仓库' }}</small></button><p v-if="!results.items.length" class="muted">没有找到匹配节点。</p></div>
          <div class="analysis-head"><h3>局部图谱</h3><div class="tabs"><button v-for="item in [['IMPACT','影响分析'],['TRACE','调用链'],['ROUTE','路由图']]" :key="item[0]" type="button" :class="{ active: mode === item[0] }" @click="mode = item[0] as typeof mode">{{ item[1] }}</button><button type="button" class="secondary" @click="runAnalysis">查询</button></div></div>
          <div v-if="mode === 'TRACE'" class="route-inputs"><input v-model="routeFrom" placeholder="起点节点 ID" aria-label="调用链起点" /><input v-model="routeTo" placeholder="终点节点 ID" aria-label="调用链终点" /></div>
          <div class="flow-wrap"><VueFlow v-if="flowNodes.length" :nodes="flowNodes" :edges="flowEdges" :nodes-draggable="false" :nodes-connectable="false" fit-view-on-init @node-click="selectFlowNode"><Background /></VueFlow><div v-else class="empty">选择节点后查看局部关系</div></div>
        </div>
      </div>
      <div v-if="selected" class="detail" aria-label="符号详情"><div><p class="eyebrow">SYMBOL DETAIL</p><h3>{{ selected.label }}</h3><p class="muted">{{ selected.kind }} · {{ selected.qualifiedName || selected.position?.path || '暂无源码位置' }}</p><p v-if="selected.position?.line" class="location">{{ selected.position.path }}:{{ selected.position.line }}{{ selected.position.column ? `:${selected.position.column}` : '' }}</p></div><div class="facts"><h4>上下文</h4><p v-for="fact in facts" :key="fact.title + fact.detail"><strong>{{ fact.title }}</strong> {{ fact.detail }}</p><p v-if="!facts.length" class="muted">暂无上下文事实。</p></div></div>
    </template>
  </section>
</template>

<style scoped>
.browser{margin-top:22px;padding:25px;background:var(--surface-1);border:1px solid var(--line-1);border-radius:14px;box-shadow:0 8px 30px rgba(22,45,80,.05)}.browser-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.eyebrow{margin:0 0 7px;font:600 11px var(--font-mono);letter-spacing:.14em;color:var(--text-3)}h2{margin:0 0 7px;font-size:22px}.muted{color:var(--text-3);line-height:1.55}.counts{display:flex;gap:8px;flex-wrap:wrap}.counts span{padding:6px 9px;border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:12px}.browser-grid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px;margin-top:22px}.navigator{border-right:1px solid var(--line-1);padding-right:14px;max-height:520px;overflow:auto}.navigator h3,.analysis-head h3{font-size:14px;margin:10px 0}.nav-item,.result{display:flex;width:100%;border:0;background:transparent;text-align:left;padding:8px;border-radius:7px;color:var(--text-1);cursor:pointer;flex-direction:column;gap:3px}.nav-item:hover,.result:hover{background:var(--surface-2)}small{color:var(--text-3);font-size:11px}.search{display:flex;gap:8px}.search input,.search select,.route-inputs input{min-width:0;border:1px solid var(--line-2);background:var(--surface-2);border-radius:7px;padding:9px;color:var(--text-1)}.search input{flex:1}.primary,.secondary,.error-block button{border:1px solid var(--line-2);border-radius:7px;padding:9px 13px;background:var(--surface-2);color:var(--text-1);cursor:pointer}.primary{background:#315edb;border-color:#315edb;color:#fff}.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:5px;margin:12px 0}.analysis-head{display:flex;justify-content:space-between;align-items:center;margin-top:18px}.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button{border:1px solid var(--line-2);background:var(--surface-2);border-radius:7px;padding:7px 9px;color:var(--text-2);cursor:pointer}.tabs button.active{background:var(--accent-100);color:var(--accent-700);border-color:var(--accent-400)}.route-inputs{display:flex;gap:8px;margin-bottom:8px}.route-inputs input{flex:1}.flow-wrap{height:310px;border:1px solid var(--line-1);border-radius:9px;overflow:hidden;background:var(--surface-2)}.flow-wrap :deep(.vue-flow){background:transparent}.empty{height:100%;display:grid;place-items:center;color:var(--text-3);padding:30px;text-align:center}.detail{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;padding:17px;border-top:1px solid var(--line-1)}.detail h3{margin:0 0 5px}.location{font:12px var(--font-mono);color:var(--text-2)}.facts{border-left:1px solid var(--line-1);padding-left:18px}.facts h4{margin:0 0 8px}.facts p{font-size:13px;line-height:1.5;margin:6px 0}.error-block{padding:15px;border-radius:8px;background:rgba(227,77,89,.08);color:#b73845}.error-block button{margin-left:8px}@media(max-width:760px){.browser-head,.browser-grid,.detail{display:block}.navigator{border-right:0;border-bottom:1px solid var(--line-1);padding:0 0 12px;max-height:220px}.explorer{margin-top:14px}.facts{border-left:0;padding:15px 0 0;border-top:1px solid var(--line-1);margin-top:15px}.search{flex-wrap:wrap}.search input{flex-basis:100%}}
</style>
