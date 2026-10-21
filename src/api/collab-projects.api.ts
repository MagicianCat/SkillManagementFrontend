import { http } from './http'

export const COLLAB_STAGES = [
  { key: 'REQUIREMENT', title: '需求', kind: 'REQUIREMENT_DOCUMENT', git: false },
  { key: 'PRODUCT', title: '产品', kind: 'PRODUCT_REQUIREMENTS', git: false },
  { key: 'ARCHITECTURE_DESIGN', title: '架构设计', kind: 'ARCHITECTURE_DOCUMENT', git: false },
  { key: 'UI_DESIGN', title: 'UI 设计', kind: 'UI_DESIGN_DOCUMENT', git: false },
  { key: 'FRONTEND_CODING', title: '前端开发', kind: 'FRONTEND_REPORT', git: true },
  { key: 'BACKEND_CODING', title: '后端开发', kind: 'BACKEND_REPORT', git: true },
  { key: 'TESTING', title: '测试', kind: 'TEST_REPORT', git: false },
  { key: 'ACCEPTANCE', title: '验收', kind: 'ACCEPTANCE_REPORT', git: false },
] as const

export type ApprovalLevel = 'L1' | 'L2' | 'L3'
export interface ReviewerRoleProgress { roleKey: string; roleName: string; approvedCount: number; requiredCount: number; status: 'SATISFIED' | 'PENDING' | string }
export interface CollabTeam { id: number; name: string; permissionSource?: string }
export interface CollabUser { userId: number; id?: number; username: string; displayName: string; teamName?: string | null }
export interface CollabProject {
  projectKey: string; name: string; description?: string | null; status: string; role?: string
  requirementKey?: string; groupKey?: string; groupName?: string; inheritedTemplateVersion?: number; gitlabRootSnapshot?: string | null; asdmBranch?: string; asdmBindingStatus?: string
  approvalLevel: ApprovalLevel; versionNo: number; currentStageOrder?: number; homeTeamId?: number; homeTeamName?: string
  ownerUserId?: number; ownerName?: string; currentStage?: { stageKey: string; title?: string; status?: string } | null
  progress?: number; feishuBindingStatus?: string; createdAt?: string
  members?: CollabMember[]
}
export interface CollabFeishuBinding { status: string; chatId?: string | null; wikiSpaceId?: string | null; wikiParentNodeToken?: string | null; lastError?: string | null; pendingTasks: number }
export interface CollabStage {
  id?: number; stageId: number; stageKey: string; title?: string; stageOrder?: number; order?: number; status: string
  asdmStatus?: string
  ownerUserId: number; ownerName?: string; reviewerUserId?: number | null; reviewerName?: string | null; additionalReviewerUserIds?: number[]
  attemptNo: number; versionNo: number; artifactKind?: string; gitRequired?: boolean
  submissionId?: number | null; submissionStatus?: string | null; artifactVersionId?: number | null
  approvalState?: string | null; frozenReviewerUserId?: number | null
  approvalVersionNo?: number | null
  ownerRoleName?: string | null; reviewerRoleName?: string | null; ownerRoleKey?: string | null; reviewerRoleKey?: string | null
  reviewerRoleKeys?: string[]; reviewerRoleNames?: string[]
  reviewerRoleActors?: { roleKey: string; roleName?: string | null; userIds: number[] }[]
  reviewerRoleProgress?: ReviewerRoleProgress[]
  ownerUserIds?: number[]; reviewerUserIds?: number[]; actorsFrozen?: boolean
  pendingReviewerUserIds?: number[]; approvedReviewerUserIds?: number[]
  submission?: CollabSubmission | null; submissions?: CollabSubmission[]
}
export interface CollabSubmission {
  submissionId?: number; id?: number; state?: string; status?: string; stageStatus?: string; approvalState?: string | null
  approvalMode?: string; artifactVersionId: number; attemptNo?: number; submittedAt?: string
  approvalVersionNo?: number | null
  reviewerUserId?: number | null; reviewerName?: string; decisionComment?: string; decision?: string
  reviewerUserIds?: number[]
  reviewerRoleProgress?: ReviewerRoleProgress[]
  feishuPublicationStatus?: string; markdownContent?: string; title?: string; createdAt?: string
}
export interface CollabMember { userId: number; displayName: string; username?: string; projectRole?: string; role?: string; status?: string }
export interface CollabEvent { id: number; eventType: string; stageKey?: string; actorName?: string; fromStatus?: string; toStatus?: string; createdAt: string; detail?: string }
export interface CollabArtifact { artifactVersionId: number; stageKey: string; title: string; kind: string; status?: string; pendingApproval?: boolean; attemptNo: number; versionNo: number; createdAt?: string; submittedByName?: string; markdownContent?: string; contentUrl?: string; feishuUrl?: string; downloadUrl?: string; repositoryUrl?: string; commitOrPullRequestUrl?: string }
export interface Page<T> { items: T[] }
const root = '/collab-projects'
const requirementRoot = '/collab-requirements'
const key = (projectKey: string) => encodeURIComponent(projectKey)

export async function listCollabProjects() { const data = (await http.get<Page<CollabProject> | CollabProject[]>(root)).data; return Array.isArray(data) ? data : data.items }
export async function getCollabCreationOptions() { return (await http.get<{ teams: CollabTeam[] }>(`${root}/creation-options`)).data }
export async function searchCollabUsers(q: string) { const data = (await http.get<Page<CollabUser> | CollabUser[]>(`${root}/users:search`, { params: { q } })).data; return Array.isArray(data) ? data : data.items }
export async function createCollabProject(payload: {
  homeTeamId: number; name: string; description: string; approvalLevel: ApprovalLevel; wikiRootUrl: string
  stageAssignments: { stageKey: string; ownerUserId: number; reviewerUserId: number | null }[]; memberUserIds: number[]; includedStageKeys: string[]
}) { return (await http.post<CollabProject>(root, payload)).data }
export async function getCollabProject(projectKey: string) { const data=(await http.get<CollabProject & {requirementKey?:string}>(`${requirementRoot}/${key(projectKey)}`)).data; return { ...data, projectKey:data.projectKey||data.requirementKey||projectKey } }
export async function getCollabFeishuBinding(projectKey: string) { return (await http.get<CollabFeishuBinding>(`${requirementRoot}/${key(projectKey)}/feishu`)).data }
export async function configureCollabWikiRoot(projectKey: string, url: string) { return (await http.put<CollabFeishuBinding>(`${requirementRoot}/${key(projectKey)}/feishu/wiki-root`, { url })).data }
export async function retryCollabFeishu(projectKey: string) { return (await http.post<CollabFeishuBinding>(`${requirementRoot}/${key(projectKey)}/feishu:retry`)).data }
export async function getCollabWorkflow(projectKey: string) { return (await http.get<{ stages: CollabStage[]; progress?: number }>(`${requirementRoot}/${key(projectKey)}/workflow`)).data }
export async function getCollabEvents(projectKey: string) { const data = (await http.get<Page<CollabEvent> | CollabEvent[]>(`${requirementRoot}/${key(projectKey)}/events`)).data; return Array.isArray(data) ? data : data.items }
export async function getCollabArtifacts(projectKey: string) { const data = (await http.get<Page<CollabArtifact> | CollabArtifact[]>(`${requirementRoot}/${key(projectKey)}/artifacts`)).data; return Array.isArray(data) ? data : data.items }
export async function getCollabArtifactContent(projectKey: string, artifactVersionId: number) { return (await http.get<{ markdownContent: string }>(`${requirementRoot}/${key(projectKey)}/artifacts/${artifactVersionId}/content`)).data.markdownContent }
export async function getCollabContext(projectKey: string, stageKey: string, includeHistory = false) { return (await http.get<Record<string, unknown>>(`${requirementRoot}/${key(projectKey)}/context`, { params: { stageKey, includeHistory } })).data }
export async function getCollabTaskPrompt(projectKey: string, stageKey: string) { return (await http.get<{ prompt: string; contextPrompt?: string | null }>(`${requirementRoot}/${key(projectKey)}/task-prompt`, { params: { stageKey } })).data }
export async function uploadCollabArtifact(projectKey: string, stageKey: string, payload: Record<string, unknown>, idempotencyKey: string) {
  return (await http.post<CollabArtifact>(`${requirementRoot}/${key(projectKey)}/stages/${stageKey}/artifacts`, payload, { headers: { 'Idempotency-Key': idempotencyKey } })).data
}
export async function submitCollabStage(projectKey: string, stageKey: string, payload: Record<string, unknown>, idempotencyKey: string) {
  return (await http.post<CollabSubmission>(`${requirementRoot}/${key(projectKey)}/stages/${stageKey}/submissions`, payload, { headers: { 'Idempotency-Key': idempotencyKey } })).data
}
export async function decideCollabSubmission(projectKey: string, submissionId: number, payload: { decision: 'APPROVE' | 'REJECT'; comment: string; expectedVersion: number }) {
  return (await http.post<CollabSubmission>(`${requirementRoot}/${key(projectKey)}/submissions/${submissionId}/decision`, payload)).data
}
export async function retryCollabFeishuPublication(projectKey: string, submissionId: number) {
  return (await http.post<CollabSubmission>(`${requirementRoot}/${key(projectKey)}/submissions/${submissionId}/feishu:retry`)).data
}
export async function updateCollabStageAssignment(projectKey: string, stageKey: string, payload: { ownerUserId: number; reviewerUserId: number | null; additionalReviewerUserIds: number[] }) {
  return (await http.put<CollabStage>(`${requirementRoot}/${key(projectKey)}/stages/${stageKey}/assignment`, payload)).data
}
export async function updateCollabStageInclusion(projectKey: string, stageKey: string, included: boolean) {
  return (await http.put<CollabStage>(`${root}/${key(projectKey)}/stages/${stageKey}/inclusion`, { included })).data
}
export async function updateCollabProject(projectKey: string, payload: { name: string; description: string; approvalLevel: ApprovalLevel; expectedVersion: number }) {
  return (await http.patch<CollabProject>(`${requirementRoot}/${key(projectKey)}`, payload)).data
}
export async function transferCollabProjectOwnership(projectKey: string, newOwnerUserId: number) {
  return (await http.post<CollabProject>(`${requirementRoot}/${key(projectKey)}/ownership:transfer`, { newOwnerUserId })).data
}
export async function addCollabMember(projectKey: string, userId: number) { return (await http.post(`${requirementRoot}/${key(projectKey)}/members`, { userId })).data }
export async function removeCollabMember(projectKey: string, userId: number) { return (await http.delete(`${requirementRoot}/${key(projectKey)}/members/${userId}`)).data }

export interface RequirementRole { roleKey: string; roleName?: string; name?: string; userIds?: number[]; members?: CollabMember[] }
export interface RequirementRolesResponse { roles: RequirementRole[]; stages: (CollabStage & { frozen?: boolean; actorsFrozenAt?: string | null })[]; groupKey?: string; groupTemplateVersion?: number }
export interface RequirementStageActorsResponse { stageId: number; stageKey: string; status: string; versionNo: number; actorsFrozen: boolean; ownerRoleKey?: string | null; ownerRoleName?: string | null; ownerUserIds: number[]; reviewerRoleKey?: string | null; reviewerRoleName?: string | null; reviewerRoleKeys: string[]; reviewerRoleNames: string[]; reviewerUserIds: number[]; reviewerRoleActors: { roleKey: string; roleName: string; userIds: number[] }[] }
export interface RequirementStageSyncPreview { requirementKey: string; stageKey: string; expectedStageVersion: number; groupTemplateVersion: number; status: string; actorsFrozen: boolean; duties: { duty: string; roleKey?: string | null; roleName?: string | null; addedUserIds: number[]; removedUserIds: number[] }[] }
export async function getRequirementRoles(requirementKey: string) { return (await http.get<RequirementRolesResponse>(`${requirementRoot}/${key(requirementKey)}/roles`)).data }
export async function updateRequirementStageActors(requirementKey: string, stageKey: string, payload: { duty: 'OWNER'|'REVIEWER'; roleKey: string; userIds: number[]; expectedStageVersion: number }) { return (await http.put<RequirementStageActorsResponse>(`${requirementRoot}/${key(requirementKey)}/stages/${key(stageKey)}/actors`, payload)).data }
export async function getRequirementStageSyncPreview(requirementKey: string, stageKey: string) { return (await http.get<RequirementStageSyncPreview>(`${requirementRoot}/${key(requirementKey)}/stages/${key(stageKey)}/sync-preview`)).data }
export async function syncRequirementStageMembers(requirementKey: string, stageKey: string, payload: { expectedStageVersion: number; expectedGroupTemplateVersion: number; mode: 'REPLACE'; confirm: true }) { return (await http.post(`${requirementRoot}/${key(requirementKey)}/stages/${key(stageKey)}:sync-members`, payload)).data }
