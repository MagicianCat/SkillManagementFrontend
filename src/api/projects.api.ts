import { http } from './http'

export type Project = { projectKey: string; name: string; description?: string | null; status: string; role?: string | null; versionNo: number }
export type Revision = { id: number; revisionNo: number; markdownContent: string; sourceType: string; profileKey?: string | null; createdByName: string; createdAt: string }
export type ProjectDocument = { id: number; projectKey: string; documentType: string; title: string; status: string; draft?: Revision | null; published?: Revision | null; everPublished: boolean; versionNo: number }

export async function listProjects() { return (await http.get<{ items: Project[] }>('/projects', { params: { page: 0, size: 50 } })).data.items }
export async function createProject(name: string, description: string) { return (await http.post<Project>('/projects', { name, description })).data }
export async function listProjectDocuments(projectKey: string) { return (await http.get<{ items: ProjectDocument[] }>(`/projects/${projectKey}/documents`, { params: { page: 0, size: 50 } })).data.items }
export async function getProjectDocument(projectKey: string, documentId: number) { return (await http.get<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}`)).data }
export async function createProjectDocument(projectKey: string, payload: { documentType: string; title: string; markdownContent: string }) { return (await http.post<ProjectDocument>(`/projects/${projectKey}/documents`, payload)).data }
export async function saveProjectDraft(projectKey: string, documentId: number, payload: { title: string; markdownContent: string; versionNo: number }) { return (await http.put<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/draft`, payload)).data }
export async function publishProjectDocument(projectKey: string, documentId: number, revisionId: number, versionNo: number) { return (await http.post<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}:publish`, { revisionId, versionNo })).data }
export async function createDocumentAgentSession(projectKey: string, documentId: number, profileKey: string) { return (await http.post<Record<string, unknown>>(`/projects/${projectKey}/document-agent/sessions`, { documentId, profileKey })).data }
export async function sendDocumentAgentTurn(projectKey: string, sessionId: string, content: string) { return (await http.post<Record<string, unknown>>(`/projects/${projectKey}/document-agent/sessions/${sessionId}/turns`, { content })).data }
export async function readDocumentAgentEvents(projectKey: string, jobId: string) { return (await http.get<string>(`/projects/${projectKey}/document-agent/jobs/${jobId}/events`, { params: { after: 0 }, responseType: 'text' })).data }
