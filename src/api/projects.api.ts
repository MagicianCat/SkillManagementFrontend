import { http } from './http'

export type Project = { projectKey: string; name: string; description?: string | null; status: string; role?: string | null; versionNo: number }
export type Revision = { id: number; revisionNo: number; markdownContent: string; sourceType: string; profileKey?: string | null; createdByName: string; createdAt: string }
export type ProjectDocument = { id: number; projectKey: string; documentType: string; title: string; status: string; draft?: Revision | null; published?: Revision | null; everPublished: boolean; versionNo: number }
export type ProjectMember = { userId: number; displayName: string; role: string; status: string }
export type StageReview = { reviewerId: number; reviewerName: string; decision?: string | null; comment?: string | null }
export type StageSubmission = { id: number; cycleNo: number; documentId: number; revisionId: number; submittedBy: number; status: string; reviews: StageReview[] }
export type StageArtifact = { documentId:number; title:string; documentType:string; revisionId?:number|null; revisionNo?:number|null; createdAt:string }
export type ProjectStage = { id: number; stageKey: string; order: number; availability: 'AVAILABLE'|'FUTURE'; enabled: boolean; status: string; cycleNo: number; progress: number; executorRole?: string; reviewerRole?: string; dependencies: string[]; skills: { skillKey: string; displayName: string; lockedVersion?: string|null }[]; submissions: StageSubmission[]; artifacts:StageArtifact[] }
export type ProjectWorkflow = { projectKey: string; progress: number; stages: ProjectStage[]; memberRoles: { userId: number; displayName: string; roleKey: string }[] }
export type ProjectUser = { userId: number; username: string; displayName: string; teamName?: string|null }

export async function listProjects() { return (await http.get<{ items: Project[] }>('/projects', { params: { page: 0, size: 50 } })).data.items }
export async function createProject(name: string, description: string, enabledStages?: string[]) { return (await http.post<Project>('/projects', { name, description, enabledStages })).data }
export async function getProject(projectKey: string) { return (await http.get<Project>(`/projects/${projectKey}`)).data }
export async function listProjectMembers(projectKey: string) { return (await http.get<ProjectMember[]>(`/projects/${projectKey}/members`)).data }
export async function putProjectMember(projectKey: string, userId: number, role = 'MEMBER') { return (await http.put<ProjectMember>(`/projects/${projectKey}/members/${userId}`, { role })).data }
export async function searchProjectUsers(q: string) { return (await http.get<ProjectUser[]>('/projects/users:search', { params: { q } })).data }
export async function getProjectWorkflow(projectKey: string) { return (await http.get<ProjectWorkflow>(`/projects/${projectKey}/workflow`)).data }
export async function setProjectFunctionalRoles(projectKey: string, userId: number, roles: string[]) { return (await http.put(`/projects/${projectKey}/members/${userId}/functional-roles`, { roles })).data }
export async function setProjectStageSkills(projectKey: string, stageKey: string, skillKeys: string[]) { return (await http.put<ProjectStage>(`/projects/${projectKey}/stages/${stageKey}/skills`, { skillKeys })).data }
export async function startProjectStage(projectKey: string, stageKey: string) { return (await http.post<ProjectStage>(`/projects/${projectKey}/stages/${stageKey}:start`)).data }
export async function submitProjectStage(projectKey: string, stageKey: string, documentId: number, revisionId: number) { return (await http.post<StageSubmission>(`/projects/${projectKey}/stages/${stageKey}/submissions`, { documentId, revisionId })).data }
export async function reviewProjectStage(projectKey: string, stageKey: string, submissionId: number, decision: 'APPROVED'|'REJECTED', comment?: string) { return (await http.post<StageSubmission>(`/projects/${projectKey}/stages/${stageKey}/submissions/${submissionId}:review`, { decision, comment })).data }
export async function listProjectDocuments(projectKey: string) { return (await http.get<{ items: ProjectDocument[] }>(`/projects/${projectKey}/documents`, { params: { page: 0, size: 50 } })).data.items }
export async function getProjectDocument(projectKey: string, documentId: number) { return (await http.get<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}`)).data }
export async function createProjectDocument(projectKey: string, payload: { documentType: string; title: string; markdownContent: string }) { return (await http.post<ProjectDocument>(`/projects/${projectKey}/documents`, payload)).data }
export async function saveProjectDraft(projectKey: string, documentId: number, payload: { title: string; markdownContent: string; versionNo: number }) { return (await http.put<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/draft`, payload)).data }
export async function publishProjectDocument(projectKey: string, documentId: number, revisionId: number, versionNo: number) { return (await http.post<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}:publish`, { revisionId, versionNo })).data }
export async function createDocumentAgentSession(projectKey: string, documentId: number, profileKey: string) { return (await http.post<Record<string, unknown>>(`/projects/${projectKey}/document-agent/sessions`, { documentId, profileKey })).data }
export async function sendDocumentAgentTurn(projectKey: string, sessionId: string, content: string) { return (await http.post<Record<string, unknown>>(`/projects/${projectKey}/document-agent/sessions/${sessionId}/turns`, { content })).data }
export async function readDocumentAgentEvents(projectKey: string, jobId: string) { return (await http.get<string>(`/projects/${projectKey}/document-agent/jobs/${jobId}/events`, { params: { after: 0 }, responseType: 'text' })).data }
