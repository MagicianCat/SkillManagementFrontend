export type WorkflowRunStatus = 'CREATED' | 'RUNNING' | 'WAITING_DESIGN_ACCEPTANCE' | 'WAITING_FINAL_ACCEPTANCE' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string
export type StageStatus = 'PENDING' | 'READY' | 'PROVISIONING' | 'RUNNING' | 'PAUSED' | 'HUMAN_REQUIRED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'STALE' | string
export type InterventionType = 'ASK' | 'CORRECT' | 'PROVIDE_INFO' | 'PAUSE' | 'RESUME' | 'CANCEL' | 'RETRY'
export interface InterventionTarget { stageRunId?: string; agentSessionId?: string; agentRunId?: string }
export interface WorkflowNode { id: string; key: string; name: string; status: StageStatus; currentAgent?: string | null; loopCount?: number; maxLoopCount?: number; startedAt?: string | null; finishedAt?: string | null; attention?: boolean }
export interface WorkflowEdge { id?: string; from: string; to: string | null; edgeType?: string; dependencyType?: string; incrementsLoop?: boolean; conditionValue?: string | null; condition?: Record<string, unknown> }
export interface WorkflowStage extends WorkflowNode { agents?: WorkflowAgentNode[]; edges?: WorkflowEdge[]; artifacts?: WorkflowArtifact[] }
export interface WorkflowAgentNode { id: string; key: string; name: string; status: string; nodeType?: string; profileCode?: string; agentRunId?: string | number | null; executionNo?: number | null }
export interface WorkflowArtifact { id: string; name: string; revision?: number; revisionId?: string | number; status?: string; reviewIssues?: string[] }
export interface WorkflowRun { id: string | number; projectId: string | number; status: WorkflowRunStatus; startedAt?: string | null; completedAt?: string | null; workflowVersionId?: string | number; stages?: WorkflowStage[] }
export interface WorkflowEvent { id?: string; sequence?: number; type: string; data: Record<string, unknown>; createdAt?: string }
