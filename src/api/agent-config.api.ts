import { http } from './http'

export type AgentCategory = 'requirement' | 'architecture' | 'ui' | 'frontend' | 'backend' | 'test' | 'release' | string
export type ProfileVersionStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'

export interface AgentSkillBinding { skillId?: number; skillKey: string; name?: string; versionPolicy: 'FIXED' | 'LATEST_PUBLISHED'; version?: string; fixedSkillVersionId?: string | number; required: boolean; sortOrder: number }
export interface AgentToolPermission { toolCode: string; enabled: boolean; permissionMode: 'AUTO' | 'CONFIRM' | 'DENY'; config?: Record<string, unknown>; configJson?: string }
export interface AgentProfileVersion {
  id?: string | number; versionNo: number; systemPrompt?: string; modelCode?: string; temperature?: number | null
  maxIterationPerRun?: number; timeoutSeconds?: number; outputSchemaJson?: Record<string, unknown> | string
  runtimeConfigJson?: Record<string, unknown> | string; status: ProfileVersionStatus; changelog?: string | null
  publishedBy?: string | null; publishedAt?: string | null; skills?: AgentSkillBinding[]; tools?: AgentToolPermission[]
}
export interface AgentProfile { id: string | number; code: string; name: string; category: AgentCategory; description: string; status: 'ACTIVE' | 'DISABLED'; sourceType?: 'SYSTEM' | 'USER'; ownerUserId?: string | number | null; maintainer?: string; latestVersion?: AgentProfileVersion; versions?: AgentProfileVersion[] }

const profilesPath = '/agent-profiles'
function parseConfig(value?: string) { if (!value) return undefined; try { return JSON.parse(value) as Record<string, unknown> } catch { return undefined } }
function normalizeVersion(version: AgentProfileVersion): AgentProfileVersion { return { ...version, skills: version.skills ?? [], tools: (version.tools ?? []).map((tool) => ({ ...tool, config: tool.config ?? parseConfig(tool.configJson) })), systemPrompt: version.systemPrompt ?? '', modelCode: version.modelCode ?? '', outputSchemaJson: version.outputSchemaJson ?? {}, runtimeConfigJson: version.runtimeConfigJson ?? {} } }
function normalizeProfile(profile: AgentProfile): AgentProfile { const versions = profile.versions?.map(normalizeVersion); return { ...profile, latestVersion: profile.latestVersion ? normalizeVersion(profile.latestVersion) : versions?.[0], versions } }
export async function listAgentProfiles() { const { data } = await http.get<AgentProfile[] | { items: AgentProfile[] }>(profilesPath); return (Array.isArray(data) ? data : data.items).map(normalizeProfile) }
export async function getAgentProfile(code: string) { const { data } = await http.get<AgentProfile>(`${profilesPath}/${encodeURIComponent(code)}`); return normalizeProfile(data) }
export async function publishAgentProfileVersion(profileCode: string, versionNo: string | number) { const { data } = await http.post<AgentProfileVersion>(`${profilesPath}/${encodeURIComponent(profileCode)}/versions/${versionNo}:publish`); return data }
function stringifyJson(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value ?? {}) }
export function buildAgentProfileVersionRequest(version: Partial<AgentProfileVersion>) { return { ...version, id: undefined, outputSchemaJson: stringifyJson(version.outputSchemaJson), runtimeConfigJson: stringifyJson(version.runtimeConfigJson), skills: (version.skills ?? []).map((skill) => ({ skillId: skill.skillId, versionPolicy: skill.versionPolicy, fixedSkillVersionId: skill.fixedSkillVersionId, required: skill.required, sortOrder: skill.sortOrder })), tools: (version.tools ?? []).map((tool) => ({ toolCode: tool.toolCode, enabled: tool.enabled, permissionMode: tool.permissionMode, config: tool.config })) } }
export async function saveAgentProfileVersion(profileCode: string, version: Partial<AgentProfileVersion>, options?: { createNewVersion?: boolean }) {
  const payload = buildAgentProfileVersionRequest(version)
  const encodedCode = encodeURIComponent(profileCode)
  const updateDraft = version.status === 'DRAFT' && !options?.createNewVersion && version.versionNo != null
  const { data } = updateDraft
    ? await http.put<AgentProfileVersion>(`${profilesPath}/${encodedCode}/versions/${version.versionNo}`, payload)
    : await http.post<AgentProfileVersion>(`${profilesPath}/${encodedCode}/versions`, payload)
  return normalizeVersion(data)
}
