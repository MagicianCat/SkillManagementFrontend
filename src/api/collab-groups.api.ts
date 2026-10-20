import { http } from './http'
import type { ApprovalLevel, CollabTeam, CollabUser } from './collab-projects.api'

export interface GroupMember extends CollabUser { userId: number; memberType?: string; status?: string }
export interface GroupRole { roleKey: string; roleName: string; name?: string; userIds: number[]; members?: GroupMember[] }
export interface GroupStageTemplate { stageKey: string; title?: string; included: boolean; ownerRoleKey?: string | null; ownerRoleName?: string | null; ownerUserIds?: number[]; reviewerRoleKey?: string | null; reviewerRoleName?: string | null; reviewerRoleKeys?: string[]; reviewerRoleNames?: string[]; reviewerUserIds?: number[]; status?: string; stageOrder?: number; order?: number; versionNo?: number }
export interface CollabGroup {
  groupKey: string; name: string; description?: string | null; homeTeamId: number; homeTeamName?: string
  ownerUserId: number; ownerName?: string; gitlabRootUrl: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  templateVersion: number; versionNo: number; legacyImport?: boolean; publishedAt?: string | null
  members?: GroupMember[]; roles?: GroupRole[]; stages?: GroupStageTemplate[]; wikiRootUrl?: string | null; feishuStatus?: string
  requirementCount?: number
}
export interface RequirementSummary { requirementKey: string; groupKey: string; name: string; description?: string | null; approvalLevel: ApprovalLevel; inheritedTemplateVersion?: number; currentStageOrder?: number; status?: string; progress?: number }
export interface GroupOptions { teams: CollabTeam[] }
const root = '/collab-groups'
const enc = (value: string) => encodeURIComponent(value)
const items = <T>(data: T[] | { items: T[] }) => Array.isArray(data) ? data : data.items

export async function getGroupCreationOptions() {
  const data=(await http.get<CollabTeam[] | GroupOptions>(`${root}/creation-options`)).data
  return Array.isArray(data)?{teams:data}:data
}
export async function listCollabGroups() { return items((await http.get<CollabGroup[] | {items: CollabGroup[]}>(root)).data) }
export async function createCollabGroup(payload: { name: string; description: string; homeTeamId: number; gitlabRootUrl: string }) { return (await http.post<CollabGroup>(root, payload)).data }
export async function getCollabGroup(groupKey: string) { return (await http.get<CollabGroup>(`${root}/${enc(groupKey)}`)).data }
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
export async function createGroupRequirement(groupKey: string, payload: { name: string; description: string; approvalLevel: ApprovalLevel; includedStageKeys: string[]; stagesWithoutApproval?: string[]; expectedTemplateVersion: number }) { return (await http.post<RequirementSummary>(`${root}/${enc(groupKey)}/requirements`, payload)).data }
export async function configureGroupWikiRoot(groupKey: string, url: string) { return (await http.put(`${root}/${enc(groupKey)}/feishu-binding`, { url })).data }
export type { CollabUser }
