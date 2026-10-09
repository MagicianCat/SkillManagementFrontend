import { http } from './http'
import type {
  CodeGraphContextResult,
  CodeGraphOverview,
  CodeGraphSearchResult,
  CodeGraphStatus,
  CodeGraphSubgraph,
  CodeGraphNode,
  PrepareWorkflowRunResponse,
} from '../types/code-graph'

const unwrap = <T extends object>(data: T | { data: T }): T => ('data' in data && data.data ? data.data : data) as T
const graphPath = (runId: string | number) => `/workflow-runs/${encodeURIComponent(String(runId))}/code-graph`
const resultData = <T extends object>(data: T | { data: T }): T => unwrap(data)
const selector = (nodeId: string) => ({ uid: nodeId })
function normalizeNode(raw: any): CodeGraphNode {
  const node = raw?.target ?? raw?.symbol ?? raw
  const id = String(node?.uid ?? node?.id ?? node?.name ?? '')
  return { id, uid: node?.uid ?? node?.id ?? null, label: node?.name ?? id, kind: node?.kind ?? 'UNKNOWN', repository: node?.repository ?? null, qualifiedName: node?.qualifiedName ?? null, filePath: node?.filePath ?? null, position: node?.filePath ? { path: node.filePath, line: node.startLine ?? null, column: null } : null, metadata: node?.metadata }
}
function normalizeSubgraph(raw: any): CodeGraphSubgraph {
  if (Array.isArray(raw?.routes)) {
    const nodes: CodeGraphNode[] = []
    const relations: CodeGraphSubgraph['relations'] = []
    raw.routes.forEach((route: any, index: number) => {
      const consumer = route.consumer
      const provider = route.provider
      if (consumer?.symbolUid) nodes.push(normalizeNode({ uid: consumer.symbolUid, name: consumer.symbolRef?.name ?? consumer.symbolUid, kind: 'ROUTE_CONSUMER', repository: consumer.repository, filePath: consumer.symbolRef?.filePath, startLine: consumer.symbolRef?.startLine }))
      if (provider?.symbolUid) nodes.push(normalizeNode({ uid: provider.symbolUid, name: provider.symbolRef?.name ?? provider.symbolUid, kind: 'ROUTE_PROVIDER', repository: provider.repository, filePath: provider.symbolRef?.filePath, startLine: provider.symbolRef?.startLine }))
      if (consumer?.symbolUid && provider?.symbolUid) relations.push({ id: `route-${index}`, source: consumer.symbolUid, target: provider.symbolUid, kind: 'HTTP_ROUTE', label: route.normalizedContractId ?? route.originalContractId ?? 'HTTP_ROUTE' })
    })
    return { nodes: nodes.filter((node, index, all) => all.findIndex((item) => item.id === node.id) === index), relations, truncated: raw.truncated }
  }
  const nodes = (raw?.symbols ?? raw?.nodes ?? []).map(normalizeNode)
  const relations = (raw?.relations ?? raw?.edges ?? []).map((edge: any, index: number) => ({ id: edge.id ?? String(index), source: String(edge.fromUid ?? edge.source ?? edge.from ?? ''), target: String(edge.toUid ?? edge.target ?? edge.to ?? ''), kind: edge.type ?? edge.kind ?? 'RELATED', label: edge.type ?? edge.kind ?? null }))
  if (raw?.target) nodes.unshift(normalizeNode(raw))
  return { nodes: nodes.filter((node: CodeGraphNode, index: number, all: CodeGraphNode[]) => all.findIndex((item) => item.id === node.id) === index), relations, truncated: raw?.truncated }
}

/**
 * M3 两阶段启动契约：prepare 只创建冻结的 Run 和图谱任务，不创建 Agent Session。
 * 后端允许返回 envelope 或直接 status，前端统一抽取，兼容灰度版本。
 */
export async function prepareWorkflowRun(projectKey: string, input: { initialRequest: string }): Promise<PrepareWorkflowRunResponse> {
  const { data } = await http.post<PrepareWorkflowRunResponse | { data: PrepareWorkflowRunResponse }>(
    `/projects/${encodeURIComponent(projectKey)}/workflow-runs:prepare`,
    input,
    // Freezing and packaging several Git repositories is intentionally synchronous before the worker job is accepted.
    { timeout: 120_000 },
  )
  const value = ('data' in data && data.data ? data.data : data) as PrepareWorkflowRunResponse
  return { ...value, runId: value.runId ?? value.workflowRunId } as PrepareWorkflowRunResponse
}

export async function getCodeGraphStatus(runId: string | number) {
  const { data } = await http.get<CodeGraphStatus | { data: CodeGraphStatus }>(
    `/workflow-runs/${encodeURIComponent(String(runId))}/code-graph`,
  )
  return unwrap(data)
}

export async function retryCodeGraphPreparation(runId: string | number) {
  const { data } = await http.post<CodeGraphStatus | { data: CodeGraphStatus }>(
    `/workflow-runs/${encodeURIComponent(String(runId))}/code-graph:retry`,
  )
  return unwrap(data)
}

/**
 * M7: retry a FAILED REPO_APPEND update request. Only the failed target version is
 * rebuilt; the current ACTIVE binding keeps serving traffic throughout.
 */
export async function retryCodeGraphUpdate(runId: string | number, updateRequestId: string | number) {
  const { data } = await http.post<{ updateRequestId: string | number; workflowRunId: string | number }>(
    `/workflow-runs/${encodeURIComponent(String(runId))}/code-graph/updates/${encodeURIComponent(String(updateRequestId))}:retry`,
  )
  return data
}

/** M5 只读查询：所有资源由 workflow run 绑定解析，前端不接触 artifact URI/SHA。 */
export async function getCodeGraphOverview(runId: string | number) {
  const { data } = await http.get<any>(`${graphPath(runId)}/overview`)
  const raw = unwrap(data) as any
  const engineRepositories = raw.graph?.repositories ?? []
  const repositories = (raw.repositories ?? []).map((repo: any) => ({
    name: repo.name ?? repo.logicalName ?? repo.alias ?? repo.repository_alias ?? repo.logicalRepositoryKey,
    displayName: repo.displayName ?? repo.logicalRepositoryKey ?? repo.alias,
    fileCount: repo.fileCount ?? engineRepositories.find((item: any) => item.logicalName === (repo.alias ?? repo.logicalRepositoryKey))?.fileCount ?? null,
    symbolCount: repo.symbolCount ?? engineRepositories.find((item: any) => item.logicalName === (repo.alias ?? repo.logicalRepositoryKey))?.nodeCount ?? null,
    edgeCount: repo.edgeCount ?? engineRepositories.find((item: any) => item.logicalName === (repo.alias ?? repo.logicalRepositoryKey))?.edgeCount ?? null,
  }))
  const symbols = engineRepositories.reduce((sum: number, repo: any) => sum + (repo.nodeCount ?? 0), 0)
  const rawCounts = raw.counts ?? {}
  return { ...raw, repositories, counts: {
    repositories: rawCounts.repositories ?? repositories.length,
    files: rawCounts.files ?? repositories.reduce((sum: number, repo: any) => sum + (repo.fileCount ?? 0), 0),
    symbols: rawCounts.symbols ?? symbols,
    relations: rawCounts.relations ?? repositories.reduce((sum: number, repo: any) => sum + (repo.edgeCount ?? 0), 0),
  } } as CodeGraphOverview
}

export async function searchCodeGraph(runId: string | number, params: { query: string; kind?: string; repository?: string; limit?: number }) {
  const { data } = await http.post<{ workflowRunId: number; operation: string; data: CodeGraphSearchResult | { symbols?: unknown[] } }>(`${graphPath(runId)}/search`, { query: params.query, repository: params.repository, limit: params.limit })
  const raw = resultData(data)
  const symbols = ((raw as any).symbols ?? []).map(normalizeNode)
  const filtered = params.kind
    ? symbols.filter((item: CodeGraphNode) => params.kind === 'SYMBOL'
      ? !['REPOSITORY', 'MODULE', 'FILE'].includes(item.kind)
      : item.kind === params.kind)
    : symbols
  return { items: filtered, total: filtered.length, truncated: (raw as any).truncated } satisfies CodeGraphSearchResult
}

export async function getCodeGraphNode(runId: string | number, nodeId: string) {
  const { data } = await http.post<{ data: unknown }>(`${graphPath(runId)}/node`, { target: selector(nodeId) })
  return normalizeNode(resultData(data))
}

export async function getCodeGraphContext(runId: string | number, nodeId?: string, limit = 15) {
  const { data } = await http.post<{ data: any }>(`${graphPath(runId)}/context`, { target: selector(nodeId ?? ''), limit })
  const raw = resultData(data)
  const relationByNode = new Map<string, string>()
  for (const relation of raw?.relations ?? []) {
    const targetId = String(relation.toUid ?? relation.target ?? '')
    const sourceId = String(relation.fromUid ?? relation.source ?? '')
    const relatedId = targetId === String(raw?.target?.uid ?? raw?.target?.id ?? '') ? sourceId : targetId
    if (relatedId) relationByNode.set(relatedId, String(relation.type ?? relation.kind ?? 'RELATED'))
  }
  const facts = (raw?.symbols ?? []).map((item: any) => {
    const id = String(item.uid ?? item.id ?? '')
    const relation = relationByNode.get(id) ?? 'RELATED'
    return { title: `${relation} · ${item.name ?? id ?? '关联符号'}`, detail: `${item.kind ?? 'UNKNOWN'}${item.filePath ? ` · ${item.filePath}` : ''}`, nodeId: id || null, source: item.filePath ? { path: item.filePath, line: item.startLine ?? null } : null }
  })
  return { facts, graph: normalizeSubgraph(raw), truncated: raw?.truncated } satisfies CodeGraphContextResult
}

export async function getCodeGraphImpact(runId: string | number, nodeId: string, depth = 2, direction: 'UPSTREAM' | 'DOWNSTREAM' = 'DOWNSTREAM') {
  const { data } = await http.post<{ data: any }>(`${graphPath(runId)}/impact`, { target: selector(nodeId), direction, depth, limit: 100 })
  return normalizeSubgraph(resultData(data))
}

export async function getCodeGraphTrace(runId: string | number, fromNodeId: string, toNodeId: string) {
  const { data } = await http.post<{ data: any }>(`${graphPath(runId)}/trace`, { from: selector(fromNodeId), to: selector(toNodeId), maxDepth: 10 })
  return normalizeSubgraph(resultData(data))
}

export async function getCodeGraphRouteMap(runId: string | number) {
  const { data } = await http.post<{ data: any }>(`${graphPath(runId)}/route-map`, { limit: 100 })
  return normalizeSubgraph(resultData(data))
}
