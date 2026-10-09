export type CodeGraphPreparationStatus =
  | 'CREATED'
  | 'PREPARING_CODE_GRAPH'
  | 'CODE_GRAPH_PREPARATION_FAILED'
  | 'READY_TO_START'
  | 'RUNNING'
  | 'COMPLETED'
  | 'CANCELLED'
  | string

export type CodeGraphJobStatus = 'PENDING' | 'BUILDING' | 'READY' | 'FAILED' | 'CANCELLED' | string

export interface CodeGraphJob {
  id: string | number
  status: CodeGraphJobStatus
  progress?: number | null
  retryCount?: number | null
  maxRetries?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  engineJobId?: string | number | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CodeGraphBinding {
  id?: string | number | null
  bindingId?: string | number | null
  version?: number | null
  versionNo?: number | null
  status?: 'PREPARING' | 'ACTIVE' | 'SUPERSEDED' | 'FAILED' | string
  semanticIndexStatus?: 'DISABLED' | 'INDEXING' | 'READY' | 'DEGRADED' | string
  bundleId?: string | number | null
  bundleKey?: string | null
  repositoryCount?: number | null
  preparedAt?: string | null
  activatedAt?: string | null
}

/**
 * M7: a queued "append repositories" update. Lands as PENDING while another
 * REPO_APPEND build is in flight; transitions to BUILDING when the drain pass picks
 * it up; completes as READY or FAILED. Consecutive appends merge into the same
 * PENDING row — the {@link targetRepositoryCount} reflects the merged set size.
 */
export interface CodeGraphPendingUpdate {
  updateRequestId: string | number
  status: 'PENDING' | 'BUILDING' | 'READY' | 'FAILED' | 'CANCELLED' | string
  retryCount?: number | null
  lastErrorCode?: string | null
  lastErrorMessage?: string | null
  targetRepositoryCount?: number | null
  queuedAt?: string | null
}

/**
 * M7: the most recent FAILED update request for a workflow run, if any. The
 * retry endpoint rebuilds only this target version — the ACTIVE binding keeps
 * serving traffic throughout.
 */
export interface CodeGraphUpdateError {
  updateRequestId: string | number
  errorCode?: string | null
  errorMessage?: string | null
}

export interface CodeGraphStatus {
  workflowRunId: string | number
  status: CodeGraphPreparationStatus
  progress?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  retryable?: boolean
  job?: CodeGraphJob | null
  binding?: CodeGraphBinding | null
  repositoryCount?: number | null
  frozenCommitCount?: number | null
  repositories?: Array<{
    name: string
    reuseDecision: 'REUSE_EXACT' | 'INCREMENTAL' | 'FULL_REQUIRED' | string
    status: 'REUSED' | 'BUILDING' | 'READY' | 'FAILED' | string
  }>
  /** M7: currently ACTIVE binding serving live traffic; null before the first activation. */
  activeBinding?: CodeGraphBinding | null
  /** M7: the next binding under construction (REPO_APPEND target version), if any. */
  preparingBinding?: CodeGraphBinding | null
  /** M7: a PENDING update merged behind the in-flight REPO_APPEND build, if any. */
  pendingUpdate?: CodeGraphPendingUpdate | null
  /** M7: the most recent FAILED update request, surfaced so users can retry it. */
  lastUpdateError?: CodeGraphUpdateError | null
}

export interface PrepareWorkflowRunResponse {
  runId: string | number
  workflowRunId?: string | number
  status: CodeGraphPreparationStatus
  jobId?: string | number | null
  codeGraph?: CodeGraphStatus | null
}

export type CodeGraphNodeKind = 'REPOSITORY' | 'MODULE' | 'FILE' | 'SYMBOL' | string

export interface CodeGraphPosition {
  path?: string | null
  line?: number | null
  column?: number | null
}

export interface CodeGraphNode {
  id: string
  label: string
  kind: CodeGraphNodeKind
  repository?: string | null
  module?: string | null
  qualifiedName?: string | null
  position?: CodeGraphPosition | null
  metadata?: Record<string, string | number | boolean | null>
  uid?: string | null
  filePath?: string | null
  startLine?: number | null
  endLine?: number | null
}

export interface CodeGraphRelation {
  id?: string | null
  source: string
  target: string
  kind: string
  label?: string | null
}

export interface CodeGraphOverview {
  workflowRunId: string | number
  repositories: Array<{ name?: string | null; alias?: string | null; logicalName?: string | null; logicalRepositoryKey?: string | null; displayName?: string | null; moduleCount?: number | null; fileCount?: number | null; symbolCount?: number | null; nodeCount?: number | null; edgeCount?: number | null }>
  modules?: Array<{ id: string; name: string; repository?: string | null; fileCount?: number | null }>
  counts?: { repositories?: number; modules?: number; files?: number; symbols?: number; relations?: number }
}

export interface CodeGraphSubgraph {
  nodes: CodeGraphNode[]
  relations: CodeGraphRelation[]
  truncated?: boolean
}

export interface CodeGraphSearchResult { items: CodeGraphNode[]; total?: number; truncated?: boolean }

export interface CodeGraphContextResult {
  facts: Array<{ title: string; detail: string; nodeId?: string | null; source?: CodeGraphPosition | null }>
  /** Exact one-hop relations returned by GitNexus context (HAS_METHOD, CALLS, etc.). */
  graph?: CodeGraphSubgraph
  truncated?: boolean
}
