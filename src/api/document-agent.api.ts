import { http } from './http'

export type DocumentAgentSession = {
  sessionKey: string
  projectKey: string
  profileKey: string
  documentId?: number | null
  targetTitle?: string | null
  status: string
  lastActivityAt: string
  stageId?: number | null
}
export type TurnMode = 'DISCUSS'|'CREATE_ARTIFACT'|'UPDATE_ARTIFACT'
export type DocumentAgentJob = { jobKey: string; sessionKey: string; sequenceNo: number; status: string; runtimeJobId?: string | null; errorCode?: string | null; errorMessage?: string | null; retryable?: boolean; artifactId?: number | null; revisionId?: number | null; documentUrl?: string | null; startedAt?: string | null; finishedAt?: string | null; turnMode: TurnMode; targetDocumentId?: number|null; targetTitle?: string|null }
export type DocumentAgentMessage = { jobKey:string; sequenceNo:number; turnMode:TurnMode; instruction:string; requestedBy:number; requestedByName:string; assistantContent:string; status:string; errorCode?:string|null; errorMessage?:string|null; artifactId?:number|null; revisionId?:number|null; createdAt:string; finishedAt?:string|null }
export type FeishuDocument = { docId: string; docType: string; title?: string; readable?: boolean; open_url?: string }
export type WikiContext = { documentId:number; title:string; documentType:string; latestRevisionNo:number }
export type WikiContextList = { items:WikiContext[]; limit:number }

function key() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }
export async function listDocumentAgentSessions(projectKey?: string) { return (await http.get<DocumentAgentSession[]>('/document-agent/sessions', { params: projectKey ? { projectKey } : undefined })).data }
export async function createDocumentAgentSession(payload: { projectKey: string; profileKey?: string; stageKey?: string; mode: string; documentId?: number; title?: string }) { return (await http.post<DocumentAgentSession>('/document-agent/sessions', payload, { headers: { 'Idempotency-Key': key() } })).data }
export async function sendDocumentAgentTurn(sessionKey: string, instruction: string, context: { sourceArtifactIds?: number[]; feishuDocuments?: { docId: string; docType: string; title?: string }[]; turnMode?:TurnMode; targetDocumentId?:number; targetTitle?:string } = {}, idempotencyKey = key()) { return (await http.post<DocumentAgentJob>(`/document-agent/sessions/${sessionKey}/turns`, { instruction, ...context }, { headers: { 'Idempotency-Key': idempotencyKey } })).data }
export async function getDocumentAgentMessages(sessionKey:string){return (await http.get<DocumentAgentMessage[]>(`/document-agent/sessions/${sessionKey}/messages`)).data}
export async function getDocumentAgentJob(jobKey: string) { return (await http.get<DocumentAgentJob>(`/document-agent/jobs/${jobKey}`)).data }
export async function getDocumentAgentEvents(jobKey: string, after = 0) {
  return (await http.get<string>(`/document-agent/jobs/${jobKey}/events`, {
    params: { after },
    responseType: 'text',
    headers: { Accept: 'text/event-stream' },
  })).data
}
export async function cancelDocumentAgentJob(jobKey: string) { return (await http.post<void>(`/document-agent/jobs/${jobKey}:cancel`)).data }
export async function retryDocumentAgentJob(jobKey: string) { return (await http.post<DocumentAgentJob>(`/document-agent/jobs/${jobKey}:retry`)).data }
export async function resolveDocumentAgentFeishu(docId: string, docType: string) { return (await http.post<FeishuDocument>('/document-agent/feishu-documents:resolve', { docId, docType })).data }
export async function searchDocumentAgentFeishu(query: string) { return (await http.get<{ items?: FeishuDocument[]; files?: FeishuDocument[]; docs?: FeishuDocument[]; result?: { items?: FeishuDocument[]; files?: FeishuDocument[]; docs?: FeishuDocument[] } | FeishuDocument[] }>('/document-agent/feishu-documents:search', { params: { query, limit: 10 } })).data }
export async function getDocumentAgentWikiContexts(sessionKey:string){return (await http.get<WikiContextList>(`/document-agent/sessions/${sessionKey}/wiki-contexts`)).data}
export async function replaceDocumentAgentWikiContexts(sessionKey:string,documentIds:number[]){return (await http.put<WikiContextList>(`/document-agent/sessions/${sessionKey}/wiki-contexts`,{documentIds})).data}
