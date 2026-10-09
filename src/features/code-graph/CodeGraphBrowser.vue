<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { getCodeGraphContext, getCodeGraphImpact, getCodeGraphNode, getCodeGraphOverview, getCodeGraphRouteMap, searchCodeGraph } from '../../api/code-graph.api'
import type { CodeGraphContextResult, CodeGraphNode, CodeGraphOverview, CodeGraphSubgraph } from '../../types/code-graph'
import GraphInspector from './GraphInspector.vue'
import GraphSummaryBar from './GraphSummaryBar.vue'
import GraphWorkbench from './GraphWorkbench.vue'
import RepositoryNavigator from './RepositoryNavigator.vue'
import { repositoryTopology, type ExplorerLevel, type RepositoryRelationViewModel, type RepositoryViewModel, type RepositoryTopology } from './codeGraphViewModel'

const props = defineProps<{ runId: string; readonly?: boolean }>()
const route = useRoute()
const router = useRouter()
const overview = ref<CodeGraphOverview | null>(null)
const topology = ref<RepositoryTopology>({ repositories: [], relations: [], unresolvedRepositoryCount: 0 })
const level = ref<ExplorerLevel>(['overview', 'files', 'impact'].includes(String(route.query.level)) ? String(route.query.level) as ExplorerLevel : 'overview')
const selectedRepository = ref(String(route.query.repoKey ?? ''))
const selectedId = ref(String(route.query.selectedId ?? ''))
const selectedRelation = ref<RepositoryRelationViewModel | null>(null)
const selectedSymbol = ref<CodeGraphNode | null>(null)
const context = ref<CodeGraphContextResult | null>(null)
const graph = ref<CodeGraphSubgraph>({ nodes: [], relations: [] })
const searchQuery = ref('')
const searchResults = ref<CodeGraphNode[]>([])
const showEvidence = ref(true)
const loading = ref(true)
const busy = ref(false)
const error = ref('')

const currentRepository = computed(() => topology.value.repositories.find((repository) => repository.queryKey === selectedRepository.value) ?? null)
const tabs: Array<{ value: ExplorerLevel; label: string; description: string }> = [
  { value: 'overview', label: '仓库依赖总览', description: '先看系统与跨仓依赖' },
  { value: 'files', label: '文件与符号', description: '查看成员、引用与方法调用' },
  { value: 'impact', label: '影响分析', description: '逆向追踪潜在上游影响' },
]

async function load() {
  loading.value = true
  try {
    const [overviewValue, routeMap] = await Promise.all([getCodeGraphOverview(props.runId), getCodeGraphRouteMap(props.runId)])
    overview.value = overviewValue
    topology.value = repositoryTopology(overviewValue, routeMap)
    if (!selectedRepository.value || !topology.value.repositories.some((repository) => repository.queryKey === selectedRepository.value)) selectedRepository.value = topology.value.repositories[0]?.queryKey ?? ''
    if (!selectedId.value) selectedId.value = selectedRepository.value
    error.value = ''
    const deepLinkedSymbolId = selectedId.value
    if (level.value !== 'overview' && deepLinkedSymbolId && !topology.value.repositories.some((repository) => repository.queryKey === deepLinkedSymbolId)) {
      await selectSymbol({ id: deepLinkedSymbolId, label: deepLinkedSymbolId, kind: 'UNKNOWN', repository: selectedRepository.value }, level.value)
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '代码图谱加载失败' }
  finally { loading.value = false }
}

async function syncUrl() {
  await router.replace({ query: { ...route.query, runId: props.runId, level: level.value, repoKey: selectedRepository.value || undefined, selectedId: selectedId.value || undefined } })
}
function selectRepository(repository: RepositoryViewModel) {
  selectedRepository.value = repository.queryKey
  selectedId.value = repository.queryKey
  selectedRelation.value = null
  selectedSymbol.value = null
  context.value = null
  if (level.value === 'impact') level.value = 'overview'
  void syncUrl()
}
function selectRepositoryById(id: string) {
  const repository = topology.value.repositories.find((item) => item.queryKey === id)
  if (repository) selectRepository(repository)
}
function selectRelationById(id: string) {
  selectedRelation.value = topology.value.relations.find((relation) => relation.id === id) ?? null
  selectedSymbol.value = null
  selectedId.value = id
  void syncUrl()
}
async function runSearch() {
  if (!searchQuery.value.trim()) { searchResults.value = []; return }
  busy.value = true
  try {
    const result = await searchCodeGraph(props.runId, { query: searchQuery.value.trim(), repository: selectedRepository.value || undefined, limit: 30 })
    searchResults.value = result.items
    if (!result.items.length) MessagePlugin.info('当前仓库未找到匹配节点')
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '代码图谱搜索失败') }
  finally { busy.value = false }
}
async function selectSymbol(node: CodeGraphNode, targetLevel: ExplorerLevel = level.value === 'overview' ? 'files' : level.value) {
  busy.value = true
  level.value = targetLevel
  selectedId.value = node.id
  selectedRelation.value = null
  selectedRepository.value = node.repository || selectedRepository.value
  try {
    const [detail, contextValue] = await Promise.all([
      getCodeGraphNode(props.runId, node.id),
      getCodeGraphContext(props.runId, node.id, 60),
    ])
    // File/symbol exploration must use exact context relations: selecting a
    // class reveals HAS_METHOD/HAS_PROPERTY; selecting a method reveals CALLS.
    // UPSTREAM impact is a separate question and can legitimately contain only
    // the target when no callers are resolved.
    const graphValue = targetLevel === 'impact'
      ? await getCodeGraphImpact(props.runId, node.id, 2, 'UPSTREAM')
      : (contextValue.graph ?? { nodes: [detail], relations: [] })
    selectedSymbol.value = detail
    context.value = contextValue
    graph.value = graphValue
    await syncUrl()
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '节点关系加载失败') }
  finally { busy.value = false }
}
function selectSymbolById(id: string) {
  const node = graph.value.nodes.find((item) => item.id === id) ?? searchResults.value.find((item) => item.id === id)
  if (node) void selectSymbol(node)
}
function selectSearchResult(node: CodeGraphNode) {
  // Search opens the node's concrete neighbourhood. Impact analysis remains
  // an explicit follow-up action because it answers a different question.
  void selectSymbol(node, 'files')
}
function changeLevel(value: ExplorerLevel) {
  level.value = value
  selectedRelation.value = null
  if (value === 'overview') {
    graph.value = { nodes: [], relations: [] }
    selectedSymbol.value = null
    selectedId.value = selectedRepository.value
  } else if (value === 'impact' && selectedSymbol.value) void selectSymbol(selectedSymbol.value, 'impact')
  void syncUrl()
}
function drillRepository() {
  if (selectedSymbol.value) void selectSymbol(selectedSymbol.value, 'files')
  else changeLevel('files')
}
function analyzeImpact() { if (selectedSymbol.value) void selectSymbol(selectedSymbol.value, 'impact') }

watch(() => props.runId, () => void load())
onMounted(load)
</script>

<template>
  <section class="explorer" data-testid="code-graph-browser" :aria-readonly="readonly !== false">
    <div v-if="loading" class="page-state">正在读取当前 Workflow Run 的冻结代码图谱…</div>
    <div v-else-if="error" class="page-state error"><strong>图谱加载失败</strong><p>{{ error }}</p><button type="button" @click="load">重新加载</button></div>
    <template v-else-if="overview">
      <header class="explorer-head">
        <div><p class="eyebrow">CODE INTELLIGENCE / GRAPH EXPLORER</p><h2>代码图谱 · 架构与依赖分析</h2><p>先看代码仓库间的依赖，再逐层定位到文件、符号、调用链与路由图。所有关系均来自当前冻结快照。</p></div>
        <button type="button" class="reset" @click="changeLevel('overview')">重置视图</button>
      </header>
      <GraphSummaryBar :overview="overview" :confirmed-relations="topology.relations.length" />
      <nav class="level-tabs" aria-label="图谱层级">
        <button v-for="tab in tabs" :key="tab.value" type="button" :class="{ active: level === tab.value }" @click="changeLevel(tab.value)"><strong>{{ tab.label }}</strong><small>{{ tab.description }}</small></button>
      </nav>
      <div class="explorer-grid">
        <RepositoryNavigator :repositories="topology.repositories" :selected-repository="selectedRepository" :search-query="searchQuery" :search-results="searchResults" :searching="busy" :show-evidence="showEvidence" @select-repository="selectRepository" @update-search="searchQuery = $event" @search="runSearch" @select-result="selectSearchResult" @update-show-evidence="showEvidence = $event" />
        <GraphWorkbench :level="level" :repositories="topology.repositories" :repository-relations="topology.relations" :symbol-graph="graph" :selected-id="selectedId" :show-evidence="showEvidence" :busy="busy" @select-repository="selectRepositoryById" @select-relation="selectRelationById" @select-symbol="selectSymbolById" />
        <GraphInspector :level="level" :repository="currentRepository" :relation="selectedRelation" :symbol="selectedSymbol" :context="context" :relation-count="graph.relations.length" @drill="drillRepository" @impact="analyzeImpact" @overview="changeLevel('overview')" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.explorer{display:grid;gap:16px;margin-top:20px}.explorer-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{margin:0 0 6px;color:var(--text-3);font:700 9px var(--font-mono);letter-spacing:.16em}.explorer-head h2{margin:0;font-size:22px;letter-spacing:-.02em}.explorer-head p:not(.eyebrow){margin:7px 0 0;color:var(--text-3);font-size:11px}.reset,.page-state button{border:1px solid var(--border-2);border-radius:8px;background:var(--surface-1);padding:9px 13px;color:var(--text-2);cursor:pointer}.level-tabs{display:flex;gap:24px;border-bottom:1px solid var(--border-1)}.level-tabs button{display:grid;gap:2px;padding:10px 3px 11px;border:0;border-bottom:3px solid transparent;background:transparent;text-align:left;color:var(--text-3);cursor:pointer}.level-tabs button.active{border-bottom-color:var(--accent-500);color:var(--accent-500)}.level-tabs strong{font-size:12px}.level-tabs small{font-size:9px}.explorer-grid{display:grid;grid-template-columns:220px minmax(0,1fr) 275px;gap:12px;min-height:620px;height:calc(100vh - 330px);max-height:820px}.page-state{display:grid;min-height:360px;place-content:center;justify-items:center;color:var(--text-3)}.page-state.error{color:var(--error)}.page-state p{max-width:520px}@media(max-width:1180px){.explorer-grid{grid-template-columns:200px minmax(0,1fr);height:auto;max-height:none}.explorer-grid>*:last-child{grid-column:1/-1;min-height:300px}}@media(max-width:760px){.explorer-head{align-items:flex-start;flex-direction:column}.reset{width:100%}.level-tabs{gap:8px;overflow:auto}.level-tabs button{min-width:130px}.explorer-grid{grid-template-columns:1fr}.explorer-grid>*:last-child{grid-column:auto}}
</style>
