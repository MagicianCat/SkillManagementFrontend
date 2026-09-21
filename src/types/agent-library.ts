import type { AgentProfileVersion, AgentSkillBinding, AgentToolPermission } from '../api/agent-config.api'

export type AgentSourceType = 'SYSTEM' | 'USER' | 'PROJECT'
export type ProjectConfigSource = 'SYSTEM_PRESET' | 'PROJECT_COPY' | 'CUSTOM'
export type ProjectConfigStatus = 'DRAFT' | 'READY' | 'LOCKED'
export interface AgentLibraryProfile { id?: string | number; code: string; name: string; category: string; description?: string; sourceType: AgentSourceType; ownerUserId?: string | number | null; maintainer?: string; latestVersion?: AgentProfileVersion; versions?: AgentProfileVersion[] }
export interface AgentTeamPreset { code: string; name: string; description?: string; versionNo?: number; versionId?: string | number; isDefault?: boolean; bindings?: AgentTeamBinding[] }
export interface AgentTeamBinding { stageKey: string; stageName?: string; stageDisplayName?: string; nodeKey: string; nodeName?: string; nodeDisplayName?: string; agentProfileCode?: string; agentProfileVersionId?: string | number; agent?: AgentLibraryProfile }
export interface ProjectAgentConfiguration { projectKey: string; status: ProjectConfigStatus; sourceType: ProjectConfigSource; sourcePresetVersionId?: string | number | null; sourceProjectKey?: string | null; workflowTemplateVersionId?: string | number; configHash?: string; preset?: AgentTeamPreset; nodes: AgentTeamBinding[]; validation?: { valid: boolean; issues: string[]; checks?: Array<{ label: string; passed: boolean }> } }
export interface ProjectConfigValidation { valid: boolean; issues: string[]; checks?: Array<{ label: string; passed: boolean }> }
export interface ReusableProject { projectKey: string; name: string; workflowVersion?: string; agentCount?: number; sourceType?: ProjectConfigSource; status?: ProjectConfigStatus; lastRunAt?: string | null }
export interface ProjectAgentNodeDraft {
  projectKey: string; stageKey: string; nodeKey: string; nodeName?: string
  sourceAgentProfileVersionId?: string | number | null
  profileCode?: string; profileName?: string
  versionId?: string | number; versionNo?: number; status?: 'DRAFT' | 'PUBLISHED' | 'LOCKED'
  systemPrompt?: string; modelCode?: string; temperature?: number | null
  maxIterationPerRun?: number; timeoutSeconds?: number
  outputSchemaJson?: Record<string, unknown> | string; runtimeConfigJson?: Record<string, unknown> | string
  workflowProtocolPrompt?: string; workflowOutputSchemaJson?: Record<string, unknown> | string
  skills?: AgentSkillBinding[]; tools?: AgentToolPermission[]
  modified?: boolean
}
export interface ProjectAgentContext {
  kind: 'PLATFORM_WIKI' | 'FEISHU'; id: string | number; title: string; revisionNo?: number
  documentType?: string; docType?: string; readable?: boolean; url?: string
}
export interface ProjectAgentContexts { platformWiki: ProjectAgentContext[]; feishu: ProjectAgentContext[] }
export type { AgentProfileVersion, AgentSkillBinding, AgentToolPermission }
