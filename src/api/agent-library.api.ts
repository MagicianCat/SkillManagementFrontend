import { http } from './http'
import type { AgentLibraryProfile, AgentTeamPreset, ProjectAgentConfiguration, ProjectConfigValidation, ReusableProject } from '../types/agent-library'

export async function listAgentLibrary(params?: { sourceType?: string; category?: string }) { return (await http.get<AgentLibraryProfile[]>('/agent-profiles', { params })).data }
export async function forkAgent(code: string, input: { newCode: string; newName: string; versionNo?: number }) { return (await http.post<AgentLibraryProfile>(`/agent-profiles/${encodeURIComponent(code)}:fork`, input)).data }
type PresetEnvelope = AgentTeamPreset[] | { items?: AgentTeamPreset[]; presets?: AgentTeamPreset[]; data?: AgentTeamPreset[] }
function normalizePreset(raw: AgentTeamPreset): AgentTeamPreset {
  const candidate = raw as AgentTeamPreset & { id?: string | number; latestVersion?: AgentTeamPreset & { id?: string | number }; latestPublishedVersion?: AgentTeamPreset & { id?: string | number } }
  const version = candidate.latestPublishedVersion ?? candidate.latestVersion
  return { ...raw, versionId: raw.versionId ?? version?.versionId ?? version?.id, versionNo: raw.versionNo ?? version?.versionNo, bindings: raw.bindings ?? version?.bindings ?? [] }
}
export async function listTeamPresets() { const { data } = await http.get<PresetEnvelope>('/agent-team-presets'); const items = Array.isArray(data) ? data : (data.items ?? data.presets ?? data.data ?? []); return items.map(normalizePreset) }
export async function getProjectAgentConfiguration(projectKey: string) { return (await http.get<ProjectAgentConfiguration>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration`)).data }
export async function applyPreset(projectKey: string, presetVersionId: string | number) { return (await http.post<ProjectAgentConfiguration>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration:apply-preset`, { presetVersionId })).data }
export async function copyProjectConfiguration(projectKey: string, sourceProjectKey: string) { return (await http.post<ProjectAgentConfiguration>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration:copy-from-project`, { sourceProjectKey, versionStrategy: 'EXACT' })).data }
export async function updateProjectAgentNode(projectKey: string, stageKey: string, nodeKey: string, agentProfileVersionId: string | number) { return (await http.put<ProjectAgentConfiguration>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration/nodes/${encodeURIComponent(stageKey)}/${encodeURIComponent(nodeKey)}`, { agentProfileVersionId })).data }
export async function validateProjectAgentConfiguration(projectKey: string) { return (await http.post<ProjectConfigValidation>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration:validate`)).data }
export async function confirmProjectAgentConfiguration(projectKey: string) { return (await http.post<ProjectAgentConfiguration>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration:confirm`)).data }
export async function listReusableProjects(projectKey: string) { return (await http.get<ReusableProject[]>(`/projects/${encodeURIComponent(projectKey)}/agent-configuration/reusable-projects`)).data }
