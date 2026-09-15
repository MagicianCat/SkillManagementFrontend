import { http } from './http'
import type { PageResponse } from '../types/skill'

export interface AgentMcpAuditView {
  id: number
  runKey: string
  sessionKey: string
  actorUserId: number | null
  toolName: string
  callId: string
  sourceChannel: string
  knowledgeScope: string
  status: 'STARTED' | 'SUCCEEDED' | 'FAILED'
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  errorCode: string | null
  argumentsSummary: string | null
}

export interface AgentMcpAuditQuery {
  page?: number
  size?: number
  runKey?: string
  sessionKey?: string
  toolName?: string
  status?: string
  sourceChannel?: string
  from?: string
  to?: string
}

export async function listAgentMcpAudits(params: AgentMcpAuditQuery = {}) {
  const { data } = await http.get<PageResponse<AgentMcpAuditView>>('/admin/agent/mcp-audits', { params })
  return data
}
