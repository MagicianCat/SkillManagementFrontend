export type AgentRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export interface AgentProfile {
  profileKey: string
  name: string
  description: string
  capabilities: string[]
}

export interface AgentSessionSummary {
  sessionKey: string
  title: string | null
  status: string
  profileKey: string
  platform: string | null
  osType: string | null
  lastMessageAt: string | null
}

export interface AgentMessage {
  sequence: number
  role: 'USER' | 'ASSISTANT'
  content: string
  status: string
  runKey?: string | null
  recommendation?: AgentRecommendation | null
}

export interface BatchDownloadResult {
  id: number
  status: string
  platform: string
  osType: string
  fileName: string | null
  items: Array<{ skillKey: string; version: string; artifactOsType: string }>
  failures: Array<{ skillKey: string; displayName?: string; errorCode: string; message: string }>
  resultStatus: 'COMPLETE' | 'PARTIAL' | 'FAILED'
}

export interface RecommendationItem {
  skillKey: string
  displayName?: string
  description?: string
  version?: string
  developmentStage?: string | null
  priority: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL'
  reason: string
  platform?: string | null
  osType?: string | null
  detailPath?: string | null
}

export interface AgentRecommendation {
  summary: string
  status: 'VALID' | 'PARTIALLY_VALID' | 'EMPTY'
  items: RecommendationItem[]
}

export interface AgentRun {
  runKey: string
  status: AgentRunStatus
  runNo: number
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  recommendation: AgentRecommendation | null
}

export interface AgentSessionDetail {
  session: AgentSessionSummary
  messages: AgentMessage[]
  latestRun: AgentRun | null
  latestRecommendation: AgentRecommendation | null
}

export interface AgentStreamEvent {
  sequence: number
  type: string
  data: Record<string, unknown>
}

export type AgentPhase = 'CONTEXT' | 'SEARCHING_DOCUMENTS' | 'READING_DOCUMENTS' | 'COMPOSING'
