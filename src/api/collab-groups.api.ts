import { http } from './http'
import type { ApprovalLevel, CollabTeam, CollabUser } from './collab-projects.api'

export interface GroupMember extends CollabUser { userId: number; memberType?: string; status?: string }
export interface GroupRole { roleKey: string; roleName: string; name?: string; userIds: number[]; members?: GroupMember[] }
export interface GroupStageTemplate { stageKey: string; title?: string; included: boolean; ownerRoleKey?: string | null; ownerRoleName?: string | null; ownerUserIds?: number[]; reviewerRoleKey?: string | null; reviewerRoleName?: string | null; reviewerRoleKeys?: string[]; reviewerRoleNames?: string[]; reviewerUserIds?: number[]; status?: string; stageOrder?: number; order?: number; versionNo?: number }
export interface CollabGroup {
  groupKey: string; name: string; description?: string | null; homeTeamId: number; homeTeamName?: string
  ownerUserId: number; ownerName?: string; asdmRepositoryUrl?: string | null; gitlabRootUrl?: string | null; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  templateVersion: number; versionNo: number; legacyImport?: boolean; publishedAt?: string | null
  members?: GroupMember[]; roles?: GroupRole[]; stages?: GroupStageTemplate[]; wikiRootUrl?: string | null; feishuStatus?: string
  requirementCount?: number
}
export interface RequirementSummary { requirementKey: string; groupKey: string; name: string; description?: string | null; approvalLevel: ApprovalLevel; inheritedTemplateVersion?: number; currentStageOrder?: number; status?: string; progress?: number; asdmBranch?: string; asdmBindingStatus?: string }
export interface AsdmCredentialView { configured: boolean; status: string; gitlabProjectId?: number | null; lastValidatedAt?: string | null; expiresAt?: string | null; versionNo?: number; lastErrorCode?: string | null }
export interface AsdmGroupView { enabled: boolean; repositoryUrl?: string | null; credentialStatus?: string; configured?: boolean; lastValidatedAt?: string | null; monitoringStatus?: string; gitlabProjectId?: number | null; versionNo?: number; lastErrorCode?: string | null }
export interface AsdmRequirementView { enabled: boolean; branch?: string; requirementPath?: string | null; bindingStatus?: string; lastScannedCommitSha?: string | null; latestCandidate?: { candidateId: number; revision: number; status: string; filePath: string; commitSha: string; notifyAfter?: string | null } | null; versionNo?: number; lastErrorCode?: string | null }
export interface AsdmDirectoryCandidate { path: string; name?: string; commitSha?: string }
export type AsdmAssociation = 'CONFIRMED' | 'LIKELY' | 'UNCERTAIN' | 'EXTERNAL_REF' | 'EXCLUDED' | 'OVERSIZE'
export type AsdmDeliveryMode = 'DOCX' | 'DRIVE_FILE' | 'LINK_ONLY'
export interface AsdmCandidateFile {
  path: string; association: AsdmAssociation; deliverAs?: AsdmDeliveryMode; selected?: boolean
  reason?: string; sizeBytes?: number; mimeType?: string; blobSha?: string; gitlabUrl?: string
  toolCategory?: string; publishStatus?: string; lastErrorCode?: string
}
export interface AsdmFileCounts { confirmed?: number; likely?: number; uncertain?: number; externalRefs?: number; excluded?: number; oversize?: number }
export interface AsdmStageCandidate {
  stageKey: string; attemptNo: number; candidateId: number; revision: number; sourceCommitSha?: string
  versionNo?: number
  markerReady?: boolean; notifyAfter?: string | null; status: string; ruleVersion?: string
  sourceBranch?: string; lastScanTime?: string; markerEvidence?: unknown[]; fileCounts?: AsdmFileCounts
  files?: AsdmCandidateFile[]
}
export interface AsdmStageView {
  enabled?: boolean; stageKey: string; status?: string; candidateId?: number | null; versionNo?: number; sourceBranch?: string; headSha?: string
  ruleVersion?: string; lastScanTime?: string; triggerReady?: boolean; markerEvidence?: unknown[]
  lastErrorCode?: string; candidate?: AsdmStageCandidate | null; latestCandidate?: AsdmStageCandidate | null
  packageId?: number | null; packageStatus?: string; packageUrl?: string | null; docxPublished?: number
  docxTotal?: number; attachmentPublished?: number; attachmentTotal?: number
}
export interface AsdmPackageFile {
  path: string; deliveryMode?: AsdmDeliveryMode; publishStatus: string; feishuUrl?: string | null
  lastErrorCode?: string | null; sourceSizeBytes?: number; sourceBlobSha?: string
}
export interface AsdmPackageView {
  packageId: number; status: string; indexUrl?: string | null; files: AsdmPackageFile[]
  docxPublished?: number; docxTotal?: number; attachmentPublished?: number; attachmentTotal?: number
}
export interface AsdmStagesView { enabled?: boolean; stages?: AsdmStageView[]; items?: AsdmStageView[] }
export interface AsdmRuleStage {
  stageKey: string; title?: string; enabled: boolean
  defaultRules?: { includeGlobs?: string[]; excludeGlobs?: string[]; markerGlobs?: string[]; markerGroups?: string[][]; relativeBase?: string | null }
  overrides?: { addIncludeGlobs?: string[]; excludeGlobs?: string[]; disabledIncludeGlobs?: string[]; addMarkerGlobs?: string[]; markerGroups?: string[][]; relativeBase?: string | null }
}
export interface AsdmGroupRulesView { defaultVersion: string; revision: number; updatedBy?: string | null; stages: AsdmRuleStage[] | Record<string, AsdmRuleStage> }
export interface AsdmRequirementRuleBinding { groupRevision?: number; defaultVersion?: string; rules?: unknown; effectiveHash?: string }
export interface AsdmRequirementRulesView {
  inUse?: AsdmRequirementRuleBinding; latestGroupRules?: AsdmRequirementRuleBinding
  effectiveRuleHash?: string; ruleVersion?: string; groupRevision?: number; latestGroupRevision?: number
  inSync?: boolean; differsFromLatestGroupRules?: boolean; defaultVersion?: string
}
export interface AsdmSyncFileResult { path?: string; sourcePath?: string; syncAction?: string; publishStatus?: string; feishuUrl?: string | null; lastErrorCode?: string | null }
export interface AsdmSyncStageResult {
  stageKey: string; stageStatusSnapshot?: string; action?: string; status?: string
  foundCount?: number; newCount?: number; updatedCount?: number; uncertainCount?: number; skippedCount?: number
  publishedCount?: number; failedCount?: number; supplementalIndexUrl?: string | null; lastErrorCode?: string | null
  candidateId?: number | null; candidateStatus?: string | null; notifyAfter?: string | null; files?: AsdmSyncFileResult[]
}
export interface AsdmSyncJobView {
  syncJobId: number; status: string; headSha?: string | null; ruleVersion?: string | null; ruleHash?: string | null
  message?: string | null; lastErrorCode?: string | null; stages?: AsdmSyncStageResult[]; items?: AsdmSyncStageResult[]
}
export interface GroupOptions { teams: CollabTeam[] }
const root = '/collab-groups'
const enc = (value: string) => encodeURIComponent(value)
const items = <T>(data: T[] | { items: T[] }) => Array.isArray(data) ? data : data.items

export async function getGroupCreationOptions() {
  const data=(await http.get<CollabTeam[] | GroupOptions>(`${root}/creation-options`)).data
  return Array.isArray(data)?{teams:data}:data
}
export async function listCollabGroups() { return items((await http.get<CollabGroup[] | {items: CollabGroup[]}>(root)).data) }
export async function createCollabGroup(payload: { name: string; description: string; homeTeamId: number; asdmRepositoryUrl?: string | null }) { return (await http.post<CollabGroup>(root, payload)).data }
export async function getCollabGroup(groupKey: string) { return (await http.get<CollabGroup>(`${root}/${enc(groupKey)}`)).data }
export async function getGroupAsdm(groupKey: string) { return (await http.get<AsdmGroupView>(`${root}/${enc(groupKey)}/asdm`)).data }
export async function getGroupAsdmRules(groupKey: string) { return (await http.get<AsdmGroupRulesView>(`${root}/${enc(groupKey)}/asdm/rules`)).data }
export async function saveGroupAsdmRules(groupKey: string, payload: { expectedRevision: number; stages: Record<string, { enabled: boolean; addIncludeGlobs?: string[]; excludeGlobs?: string[]; disabledIncludeGlobs?: string[]; addMarkerGlobs?: string[]; markerGroups?: string[][]; relativeBase?: string | null }> }) { return (await http.put<AsdmGroupRulesView>(`${root}/${enc(groupKey)}/asdm/rules`, payload)).data }
export async function resetGroupAsdmRuleStage(groupKey: string, stageKey: string, expectedRevision: number) { return (await http.post<AsdmGroupRulesView>(`${root}/${enc(groupKey)}/asdm/rules:reset-stage`, { stageKey, expectedRevision })).data }
export async function previewGroupAsdmRules(groupKey: string, payload: { stageKey: string; requirementKey: string; overrides?: { enabled: boolean; addIncludeGlobs?: string[]; excludeGlobs?: string[]; disabledIncludeGlobs?: string[]; addMarkerGlobs?: string[]; markerGroups?: string[][]; relativeBase?: string | null } }) { return (await http.post<{ stageKey: string; headSha?: string; matchedPaths?: string[]; unmatchedPaths?: string[] }>(`${root}/${enc(groupKey)}/asdm/rules:preview`, payload)).data }
export async function updateGroupAsdmRepository(groupKey: string, repositoryUrl: string | null, expectedVersion: number) { return (await http.put<AsdmGroupView>(`${root}/${enc(groupKey)}/asdm/repository`, { repositoryUrl, expectedVersion })).data }
export async function saveGroupAsdmCredential(groupKey: string, projectAccessToken: string, expectedVersion: number) { return (await http.put<AsdmCredentialView>(`${root}/${enc(groupKey)}/asdm/credential`, { projectAccessToken, expectedVersion })).data }
export async function revalidateGroupAsdmCredential(groupKey: string) { return (await http.post<AsdmCredentialView>(`${root}/${enc(groupKey)}/asdm/credential:revalidate`)).data }
export async function updateCollabGroup(groupKey: string, payload: { name: string; description: string; expectedVersion: number }) { return (await http.patch<CollabGroup>(`${root}/${enc(groupKey)}`, payload)).data }
export async function addGroupMember(groupKey: string, userId: number) { return (await http.post(`${root}/${enc(groupKey)}/members`, { userId })).data }
export async function removeGroupMember(groupKey: string, userId: number) { return (await http.delete(`${root}/${enc(groupKey)}/members/${userId}`)).data }
export async function createGroupRole(groupKey: string, roleName: string) { return (await http.post<GroupRole>(`${root}/${enc(groupKey)}/roles`, { roleName })).data }
export async function deleteGroupRole(groupKey: string, roleKey: string) { return (await http.delete(`${root}/${enc(groupKey)}/roles/${enc(roleKey)}`)).data }
export async function replaceGroupRoleMembers(groupKey: string, roleKey: string, userIds: number[]) { return (await http.put<GroupRole>(`${root}/${enc(groupKey)}/roles/${enc(roleKey)}/members`, { userIds })).data }
export async function updateGroupStageTemplate(groupKey: string, stageKey: string, payload: { ownerRoleKey: string | null; reviewerRoleKeys: string[]; included: boolean; expectedVersion: number }) { return (await http.put<GroupStageTemplate>(`${root}/${enc(groupKey)}/stages/${enc(stageKey)}/template`, payload)).data }
export async function publishCollabGroup(groupKey: string, expectedVersion: number) { return (await http.post<CollabGroup>(`${root}/${enc(groupKey)}:publish`, { expectedVersion }, { headers: { 'Idempotency-Key': `publish-${groupKey}-${expectedVersion}` } })).data }
export async function getGroupTemplatePreview(groupKey: string) { return (await http.get<{ valid: boolean; issues: { stageKey: string; duty?: string; code?: string; message: string }[]; warnings: { stageKey: string; duty?: string; code?: string; message: string }[] }>(`${root}/${enc(groupKey)}/template-preview`)).data }
export async function getGroupRequirements(groupKey: string) { return items((await http.get<RequirementSummary[] | {items: RequirementSummary[]}>(`${root}/${enc(groupKey)}/requirements`)).data) }
export async function createGroupRequirement(groupKey: string, payload: { name: string; description: string; approvalLevel: ApprovalLevel; includedStageKeys: string[]; stagesWithoutApproval?: string[]; expectedTemplateVersion: number; asdmBranch?: string }) { return (await http.post<RequirementSummary>(`${root}/${enc(groupKey)}/requirements`, payload)).data }
export async function configureGroupWikiRoot(groupKey: string, url: string) { return (await http.put(`${root}/${enc(groupKey)}/feishu-binding`, { url })).data }
const requirementRoot = '/collab-requirements'
export async function getRequirementAsdm(requirementKey: string) { return (await http.get<AsdmRequirementView>(`${requirementRoot}/${enc(requirementKey)}/asdm`)).data }
export async function getRequirementAsdmRules(requirementKey: string) { return (await http.get<AsdmRequirementRulesView>(`${requirementRoot}/${enc(requirementKey)}/asdm/rules`)).data }
export async function startRequirementAsdmSync(requirementKey: string, idempotencyKey: string) { return (await http.post<AsdmSyncJobView>(`${requirementRoot}/${enc(requirementKey)}/asdm/sync`, { applyLatestGroupRules: true, scope: 'ALL_STAGES', includeCompletedStages: true }, { headers: { 'Idempotency-Key': idempotencyKey } })).data }
export async function getRequirementAsdmSyncJob(requirementKey: string, jobId: number) { return (await http.get<AsdmSyncJobView>(`${requirementRoot}/${enc(requirementKey)}/asdm/sync-jobs/${jobId}`)).data }
export async function retryRequirementAsdmSyncJob(requirementKey: string, jobId: number) { return (await http.post<AsdmSyncJobView>(`${requirementRoot}/${enc(requirementKey)}/asdm/sync-jobs/${jobId}/retry`)).data }
export async function scanRequirementAsdm(requirementKey: string) { return (await http.post(`${requirementRoot}/${enc(requirementKey)}/asdm:scan-now`)).data }
export async function getRequirementAsdmDirectoryCandidates(requirementKey: string) { const data=(await http.get<AsdmDirectoryCandidate[] | {items: AsdmDirectoryCandidate[]}>(`${requirementRoot}/${enc(requirementKey)}/asdm/directories:candidates`)).data; return items(data) }
export async function bindRequirementAsdmDirectory(requirementKey: string, path: string, expectedVersion: number) { return (await http.post<AsdmRequirementView>(`${requirementRoot}/${enc(requirementKey)}/asdm/directory:bind`, { path, expectedVersion })).data }
export async function getRequirementAsdmStages(requirementKey: string) { return (await http.get<AsdmStagesView | AsdmStageView[]>(`${requirementRoot}/${enc(requirementKey)}/asdm/stages`)).data }
export async function getRequirementAsdmStage(requirementKey: string, stageKey: string) { const data=(await http.get<{stage: AsdmStageView; markerEvidence?: unknown[]; packageId?: number | null}>(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}`)).data; return {...data.stage, markerEvidence: data.markerEvidence, packageId: data.packageId} }
export async function getRequirementAsdmCandidate(requirementKey: string, stageKey: string) { const data=(await http.get<AsdmStageCandidate & {confirmedCount?: number; likelyCount?: number; uncertainCount?: number; externalRefCount?: number}>(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}/candidate`)).data; return {...data, fileCounts: {confirmed: data.confirmedCount, likely: data.likelyCount, uncertain: data.uncertainCount, externalRefs: data.externalRefCount}, files: data.files?.map(file => ({...file, sizeBytes: file.sizeBytes ?? (file as AsdmCandidateFile & {size?: number}).size}))} }
export async function scanRequirementAsdmStage(requirementKey: string, stageKey: string) { return (await http.post(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}:scan`)).data }
export async function updateRequirementAsdmAssociation(requirementKey: string, stageKey: string, payload: { candidateId: number; expectedRevision: number; expectedVersion: number; path: string; decision: 'INCLUDE' | 'EXCLUDE' }) { await http.put(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}/associations`, {expectedRevision: payload.expectedRevision, expectedVersion: payload.expectedVersion, changes: [{path: payload.path, association: payload.decision === 'INCLUDE' ? 'CONFIRMED' : 'EXCLUDED'}]}); return getRequirementAsdmCandidate(requirementKey, stageKey) }
export async function includeRequirementAsdmSuspected(requirementKey: string, stageKey: string, payload: { candidateId: number; expectedRevision: number }) { return (await http.post<{ includedCount: number; rescanQueued: boolean }>(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}/candidate:include-suspected`, payload)).data }
export async function getRequirementAsdmPackage(requirementKey: string, stageKey: string, packageId: number) { return (await http.get<AsdmPackageView>(`${requirementRoot}/${enc(requirementKey)}/asdm/stages/${enc(stageKey)}/packages/${packageId}`)).data }
export async function retryRequirementAsdmPackage(requirementKey: string, packageId: number) { return (await http.post(`${requirementRoot}/${enc(requirementKey)}/asdm/packages/${packageId}:retry`)).data }
export type { CollabUser }
