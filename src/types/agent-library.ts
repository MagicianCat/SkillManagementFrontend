import type { AgentProfileVersion, AgentSkillBinding, AgentToolPermission } from '../api/agent-config.api'

export type AgentSourceType = 'SYSTEM' | 'USER'
export type ProjectConfigSource = 'SYSTEM_PRESET' | 'PROJECT_COPY' | 'CUSTOM'
export type ProjectConfigStatus = 'DRAFT' | 'READY' | 'LOCKED'
export interface AgentLibraryProfile { id?: string | number; code: string; name: string; category: string; description?: string; sourceType: AgentSourceType; ownerUserId?: string | number | null; maintainer?: string; latestVersion?: AgentProfileVersion; versions?: AgentProfileVersion[] }
export interface AgentTeamPreset { code: string; name: string; description?: string; versionNo?: number; versionId?: string | number; isDefault?: boolean; bindings?: AgentTeamBinding[] }
export interface AgentTeamBinding { stageKey: string; nodeKey: string; nodeName?: string; agentProfileCode?: string; agentProfileVersionId?: string | number; agent?: AgentLibraryProfile }
export interface ProjectAgentConfiguration { projectKey: string; status: ProjectConfigStatus; sourceType: ProjectConfigSource; sourcePresetVersionId?: string | number | null; sourceProjectKey?: string | null; workflowTemplateVersionId?: string | number; configHash?: string; preset?: AgentTeamPreset; nodes: AgentTeamBinding[]; validation?: { valid: boolean; issues: string[]; checks?: Array<{ label: string; passed: boolean }> } }
export interface ProjectConfigValidation { valid: boolean; issues: string[]; checks?: Array<{ label: string; passed: boolean }> }
export interface ReusableProject { projectKey: string; name: string; workflowVersion?: string; agentCount?: number; sourceType?: ProjectConfigSource; status?: ProjectConfigStatus; lastRunAt?: string | null }
export type { AgentProfileVersion, AgentSkillBinding, AgentToolPermission }
