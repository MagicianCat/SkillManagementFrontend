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
}

export interface RepositoryTopology {
  repositories: RepositoryViewModel[]
  relations: RepositoryRelationViewModel[]
  unresolvedRepositoryCount: number
}

export function repositoryDisplayName(value?: string | null) {
  if (!value) return '未命名仓库'
  const cleaned = value.replace(/\.git$/i, '').replace(/\/$/, '')
  return decodeURIComponent(cleaned.split('/').filter(Boolean).at(-1) || cleaned)
}

export function repositoryViewModels(overview: CodeGraphOverview): RepositoryViewModel[] {
  return overview.repositories.map((repository, index) => {
    const queryKey = repository.alias || repository.logicalName || repository.name || ''
    const url = repository.logicalRepositoryKey || repository.logicalName || repository.name || queryKey
    return {
      id: queryKey || `repository-${index}`,
      queryKey: queryKey || `repository-${index}`,
      name: repository.displayName || repositoryDisplayName(url),
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
 * Route-map is the only currently verified cross-repository source. It is
 * deliberately aggregated at repository level; missing contracts stay empty
 * rather than becoming guessed dependency lines.
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
  const relations = [...aggregated.values()]
  const linked = new Set(relations.flatMap((relation) => [relation.source, relation.target]))
  return { repositories, relations, unresolvedRepositoryCount: repositories.filter((repository) => !linked.has(repository.queryKey)).length }
}

export function nodeDisplayName(node: CodeGraphNode) {
  return node.label || node.qualifiedName || node.id
}
