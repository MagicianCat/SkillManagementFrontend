import type { CodeGraphNode, CodeGraphOverview, CodeGraphSubgraph } from '../../types/code-graph'

export type ExplorerLevel = 'overview' | 'files' | 'impact'
export type RepositoryRole = 'SERVICE' | 'LIBRARY' | 'REPOSITORY'

export interface RepositoryViewModel {
  id: string
  queryKey: string
  name: string
  url: string
  role: RepositoryRole
  files: number | null
  symbols: number | null
  relations: number | null
  indexed: boolean
}

export interface RepositoryRelationViewModel {
  id: string
  source: string
  target: string
  type: 'HTTP_CONTRACT' | 'RPC_CONTRACT' | 'MESSAGE_CONTRACT' | 'DEPENDS_ON'
  label: string
  evidenceStatus: 'VERIFIED' | 'INFERRED' | 'UNRESOLVED'
  evidenceCount: number
  evidenceSources: string[]
  evidence?: Array<{ contractId?: string | null; matchType?: string | null; confidence?: number | null; from?: string | null; to?: string | null }>
}

export interface RepositoryTopology {
  repositories: RepositoryViewModel[]
  relations: RepositoryRelationViewModel[]
  unresolvedRepositoryCount: number
}

export function repositoryDisplayName(value?: string | null) {
  if (!value) return '未命名仓库'
  const cleaned = value.trim().replace(/[?#].*$/, '').replace(/\.git$/i, '').replace(/\/$/, '')
  // GitHub, GitLab (including nested groups), Bitbucket and SSH remotes all
  // reduce to the final repository segment while preserving the real name.
  const withoutScheme = cleaned.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').replace(/^git@/, '').replace(/^[^:]+:/, '')
  const name = withoutScheme.split('/').filter(Boolean).at(-1) || cleaned
  try { return decodeURIComponent(name) } catch { return name }
}

export function repositoryViewModels(overview: CodeGraphOverview): RepositoryViewModel[] {
  return overview.repositories.map((repository, index) => {
    const queryKey = repository.alias || repository.logicalName || repository.name || ''
    const url = repository.logicalRepositoryKey || repository.logicalName || repository.name || queryKey
    return {
      id: queryKey || `repository-${index}`,
      queryKey: queryKey || `repository-${index}`,
      name: repository.displayName && !/^[a-z][a-z\d+.-]*:\/\//i.test(repository.displayName)
        ? repository.displayName
        : repositoryDisplayName(url),
      url: String(url || ''),
      role: 'REPOSITORY',
      files: repository.fileCount ?? null,
      symbols: repository.symbolCount ?? repository.nodeCount ?? null,
      relations: repository.edgeCount ?? null,
      indexed: true,
    }
  })
}

/**
 * Combine explicit route-map links and persisted GitNexus Workspace links.
 * Both are evidence-backed; missing contracts stay empty rather than becoming
 * guessed dependency lines.
 */
export function repositoryTopology(overview: CodeGraphOverview, routeMap: CodeGraphSubgraph): RepositoryTopology {
  const repositories = repositoryViewModels(overview)
  const nodeById = new Map(routeMap.nodes.map((node) => [node.id, node]))
  const aggregated = new Map<string, RepositoryRelationViewModel>()
  for (const relation of routeMap.relations) {
    const sourceNode = nodeById.get(relation.source)
    const targetNode = nodeById.get(relation.target)
    const sourceRepo = sourceNode?.repository
    const targetRepo = targetNode?.repository
    if (!sourceRepo || !targetRepo || sourceRepo === targetRepo) continue
    const key = `${sourceRepo}->${targetRepo}:HTTP_CONTRACT`
    const current = aggregated.get(key)
    if (current) { current.evidenceCount += 1; continue }
    aggregated.set(key, {
      id: key,
      source: sourceRepo,
      target: targetRepo,
      type: 'HTTP_CONTRACT',
      label: relation.label || 'HTTP 契约',
      evidenceStatus: 'VERIFIED',
      evidenceCount: 1,
      evidenceSources: ['GITNEXUS_GROUP_CONTRACT'],
    })
  }
  for (const dependency of overview.group?.repositoryDependencies ?? []) {
    const source = dependency.from ?? ''
    const target = dependency.to ?? ''
    if (!source || !target || source === target) continue
    const key = `${source}->${target}:DEPENDS_ON`
    const current = aggregated.get(key)
    if (current) {
      current.evidenceCount += dependency.evidenceCount ?? 0
      current.evidence = [...(current.evidence ?? []), ...(dependency.evidence ?? []).map((item) => ({
        contractId: item.contractId, matchType: item.matchType, confidence: item.confidence,
        from: item.from?.symbolRef?.name ?? item.from?.symbolUid, to: item.to?.symbolRef?.name ?? item.to?.symbolUid,
      }))]
      continue
    }
    aggregated.set(key, {
      id: key,
      source,
      target,
      type: 'DEPENDS_ON',
      label: 'Maven / Workspace 依赖',
      evidenceStatus: 'VERIFIED',
      evidenceCount: dependency.evidenceCount ?? 0,
      evidenceSources: [dependency.source ?? 'GITNEXUS_WORKSPACE'],
      evidence: (dependency.evidence ?? []).map((item) => ({
        contractId: item.contractId, matchType: item.matchType, confidence: item.confidence,
        from: item.from?.symbolRef?.name ?? item.from?.symbolUid, to: item.to?.symbolRef?.name ?? item.to?.symbolUid,
      })),
    })
  }
  const relations = [...aggregated.values()]
  const linked = new Set(relations.flatMap((relation) => [relation.source, relation.target]))
  return { repositories, relations, unresolvedRepositoryCount: repositories.filter((repository) => !linked.has(repository.queryKey)).length }
}

export function nodeDisplayName(node: CodeGraphNode) {
  return node.label || node.qualifiedName || node.id
}
