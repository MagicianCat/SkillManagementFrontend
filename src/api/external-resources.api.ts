import { http } from './http'

export interface ExternalRole { id: number; sourceSystem: string; externalRoleId: string; roleName: string; status: 'ACTIVE' | 'INACTIVE' }
export interface ExternalResource { id: number; roleId: number; sourceSystem: string; externalResourceId: string; resourceType: 'SKILL' | 'DOCUMENT'; name: string; description?: string; developmentStage?: string | null; subStageKey?: string | null; currentVersionId: number; externalVersion?: string; sizeBytes: number; receivedAt: string }
export interface ExternalVersion { id: number; externalVersion?: string; fileName: string; sizeBytes: number; sha256: string; developmentStage?: string | null; subStageKey?: string | null; receivedAt: string }
export interface ExternalImport { id: number; entryPath?: string; targetType: string; targetId: number; result: string; createdAt: string }
export interface SkillPreparation { skillKey?: string; fileCount: number; exists: boolean; skillId?: number; activeDraftVersionId?: number }
export interface DocumentEntry { path: string; sizeBytes: number }
export interface Readiness { ready: boolean; pendingSkills: { id: number; name: string; externalResourceId: string; versionId: number }[]; skillIds: number[] }
export interface ExternalImportJob { job: { id: number; roleId: number; kind: 'SKILL' | 'DOCUMENT'; status: string; totalCount: number; successCount: number; failureCount: number; errorMessage?: string | null }; items: Array<{ resourceId: number; versionId: number; entryPath?: string | null; status: string; targetId?: number | null; errorCode?: string | null; errorMessage?: string | null }> }

export async function listExternalRoles() { return (await http.get<ExternalRole[]>('/external-resources/roles')).data }
export async function listExternalResources(roleId?: number, type?: string, keyword?: string, page = 0, size = 50) { return (await http.get<ExternalResource[]>('/external-resources', { params: { roleId, type, keyword, page, size } })).data }
export async function listExternalVersions(id: number) { return (await http.get<ExternalVersion[]>(`/external-resources/${id}/versions`)).data }
export async function listExternalImports(id: number) { return (await http.get<ExternalImport[]>(`/external-resource-versions/${id}/imports`)).data }
export async function downloadExternalZip(id: number) { return (await http.get<Blob>(`/external-resource-versions/${id}/download`, { responseType: 'blob' })).data }
export async function prepareExternalSkill(id: number, skillKey?: string) { return (await http.post<SkillPreparation>(`/external-resource-versions/${id}/skill:prepare`, null, { params: { skillKey } })).data }
export async function importExternalSkill(id: number, request: { skillKey: string; displayName: string; description: string; categoryId: number | null; teamId: number | null; confirmExisting: boolean; reimport: boolean }) { return (await http.post<{ skillKey: string; skillId: number; draftVersionId: number }>(`/external-resource-versions/${id}/skill:import-draft`, request)).data }
export async function listExternalDocuments(id: number) { return (await http.get<DocumentEntry[]>(`/external-resource-versions/${id}/documents`)).data }
export async function getExternalDocument(id: number, path: string) { return (await http.get<string>(`/external-resource-versions/${id}/documents/content`, { params: { path }, responseType: 'text' })).data }
export async function getExternalReadiness(roleId: number) { return (await http.get<Readiness>(`/external-resources/roles/${roleId}/import-readiness`)).data }
export async function startBulkSkillImport(roleId: number, resourceIds: number[]) { return (await http.post<{ jobId: number }>(`/external-resources/roles/${roleId}/skills:import-all`, { resourceIds })).data }
export async function startBulkWikiImport(roleId: number, request: { teamId: number | null; parentWikiId: number | null; linkRoleSkills: boolean; selections: Array<{ resourceId: number; paths: string[] }> }) { return (await http.post<{ jobId: number }>(`/external-resources/roles/${roleId}/wikis:import-all`, request)).data }
export async function getExternalImportJob(id: number) { return (await http.get<ExternalImportJob>(`/external-import-jobs/${id}`)).data }
