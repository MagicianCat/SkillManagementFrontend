import { http } from './http'

export type DocumentAgentSession = {
  sessionKey: string
  projectKey: string
  profileKey: string
  documentId?: number | null
  targetTitle?: string | null
  status: string
  lastActivityAt: string
}
export type DocumentAgentJob = { jobKey: string; sessionKey: string; sequenceNo: number; status: string; runtimeJobId?: string | null; errorCode?: string | null; errorMessage?: string | null; retryable?: boolean; artifactId?: number | null; revisionId?: number | null; documentUrl?: string | null; startedAt?: string | null; finishedAt?: string | null }
export type FeishuDocument = { docId: string; docType: string; title?: string; readable?: boolean; open_url?: string }

function key() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }
export async function listDocumentAgentSessions(projectKey?: string) { return (await http.get<DocumentAgentSession[]>('/document-agent/sessions', { params: projectKey ? { projectKey } : undefined })).data }
export async function createDocumentAgentSession(payload: { projectKey: string; profileKey: string; mode: string; documentId?: number; title?: string }) { return (await http.post<DocumentAgentSession>('/document-agent/sessions', payload, { headers: { 'Idempotency-Key': key() } })).data }
export async function sendDocumentAgentTurn(sessionKey: string, instruction: string, context: { sourceArtifactIds?: number[]; feishuDocuments?: { docId: string; docType: string; title?: string }[] } = {}, idempotencyKey = key()) { return (await http.post<DocumentAgentJob>(`/document-agent/sessions/${sessionKey}/turns`, { instruction, ...context }, { headers: { 'Idempotency-Key': idempotencyKey } })).data }
export async function getDocumentAgentJob(jobKey: string) { return (await http.get<DocumentAgentJob>(`/document-agent/jobs/${jobKey}`)).data }
export async function getDocumentAgentEvents(jobKey: string, after = 0) { return (await http.get<string>(`/document-agent/jobs/${jobKey}/events`, { params: { after }, responseType: 'text' })).data }
export async function cancelDocumentAgentJob(jobKey: string) { return (await http.post<void>(`/document-agent/jobs/${jobKey}:cancel`)).data }
export async function resolveDocumentAgentFeishu(docId: string, docType: string) { return (await http.post<FeishuDocument>('/document-agent/feishu-documents:resolve', { docId, docType })).data }
export async function searchDocumentAgentFeishu(query: string) { return (await http.get<{ items?: FeishuDocument[]; result?: { items?: FeishuDocument[] } | FeishuDocument[] }>('/document-agent/feishu-documents:search', { params: { query, limit: 10 } })).data }
