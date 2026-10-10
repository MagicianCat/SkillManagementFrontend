import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('M5 code graph API is run-scoped and exposes structured read-only queries', async () => {
  const api = await read('src/api/code-graph.api.ts')
  for (const marker of ['getCodeGraphOverview', 'searchCodeGraph', 'getCodeGraphNode', 'getCodeGraphContext', 'getCodeGraphImpact', 'getCodeGraphTrace', 'getCodeGraphRouteMap']) {
    assert.match(api, new RegExp(marker))
  }
  assert.match(api, /workflow-runs\/\$\{encodeURIComponent\(String\(runId\)\)\}\/code-graph/)
  assert.doesNotMatch(api, /cypher/i)
})

test('M5 browser supports navigation, graph and read-only analysis without artifact internals', async () => {
  const browser = [
    await read('src/features/code-graph/CodeGraphBrowser.vue'),
    await read('src/features/code-graph/GraphWorkbench.vue'),
    await read('src/features/code-graph/RepositoryNavigator.vue'),
  ].join('\n')
  for (const marker of ['代码仓库', '搜索', 'symbol', '影响分析', '调用链', '路由图', '@vue-flow/core']) {
    assert.match(browser, new RegExp(marker, 'i'))
  }
  assert.doesNotMatch(browser, /artifactUri|artifactSha|bundleKey|cypher/i)
})

test('M5 graph page keeps browser available for ready, active and completed runs', async () => {
  const view = await read('src/views/CodeGraphView.vue')
  assert.match(view, /CodeGraphBrowser/)
  assert.match(view, /READY_TO_START|RUNNING|COMPLETED/)
  assert.match(view, /readonly/)
})

test('file exploration renders exact context relations while impact remains upstream-only', async () => {
  const api = await read('src/api/code-graph.api.ts')
  const browser = await read('src/features/code-graph/CodeGraphBrowser.vue')
  const workbench = await read('src/features/code-graph/GraphWorkbench.vue')
  assert.match(api, /graph:\s*normalizeSubgraph\(raw\)/)
  assert.match(browser, /contextValue\.graph/)
  assert.match(browser, /getCodeGraphImpact\([^)]*'UPSTREAM'/s)
  assert.match(browser, /HAS_METHOD\/HAS_PROPERTY/)
  assert.match(browser, /selectSearchResult[\s\S]*selectSymbol\(node, 'files'\)/)
  assert.match(workbench, /未解析到上游影响路径/)
})

test('repository topology includes persisted Maven workspace dependencies', async () => {
  const viewModel = await read('src/features/code-graph/codeGraphViewModel.ts')
  const types = await read('src/types/code-graph.ts')
  assert.match(viewModel, /repositoryDependencies/)
  assert.match(viewModel, /DEPENDS_ON/)
  assert.match(viewModel, /GITNEXUS_WORKSPACE/)
  assert.match(types, /repositoryDependencyCount/)
})

test('debug code graph rebuild is gated to development UI', async () => {
  const api = await read('src/api/code-graph.api.ts')
  const view = await read('src/views/CodeGraphView.vue')
  assert.match(api, /code-graph:debug-rebuild/)
  assert.match(view, /VITE_CODE_GRAPH_DEBUG_REBUILD/)
  assert.match(view, /重新构建代码图谱（调试）/)
})
