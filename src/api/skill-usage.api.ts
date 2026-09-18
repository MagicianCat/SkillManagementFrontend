import { http } from './http'

export interface SkillUsageFilters {
  from?: string
  to?: string
  teamId?: number
  skillKey?: string
  userId?: number
}

export interface SkillUsageTeamOption {
  id: number
  name: string
  parentId: number | null
}

export interface SkillUsageAccessScope {
  global: boolean
  teams: SkillUsageTeamOption[]
}

export interface SkillUsageSummary {
  calls: number
  activeUsers: number
  skills: number
  mergedConversations: number
  conversationSuccessRate: number
}

export interface SkillUsageOverview {
  summary: SkillUsageSummary
  trend: Array<{ bucket: string; calls: number; activeUsers: number }>
  skills: Array<{ skillKey: string; displayName: string; calls: number; users: number; lastInvokedAt: string | null }>
  members: Array<{ userId: number; displayName: string; username: string; calls: number; skills: number; lastInvokedAt: string | null }>
  conversationStatuses: Array<{ status: string; count: number }>
  categories: SkillUsageDimension[]
  teams: SkillUsageDimension[]
  projects: SkillUsageDimension[]
  clients: SkillUsageDimension[]
  timeBands: Array<{ band: string; calls: number; users: number }>
  from: string
  to: string
}

export interface SkillUsageDimension {
  key: string
  name: string
  calls: number
  users: number
  skills: number
}

export interface SkillUsageEvent {
  eventId: string
  invokedAt: string
  userId: number
  displayName: string
  username: string
  skillKey: string
  skillVersionId: number | null
  version: string | null
  skillDisplayName: string
  localDirectory: string
  teamNames: string | null
  client: string
  clientVersion: string | null
  agentType: string | null
  model: string | null
  clientSessionId: string
  conversationStatus: string
  messageCount: number
  conversationAvailable: boolean
}

export interface SkillUsageConversation {
  status: string
  version: number
  totalMessages: number
  page: number
  size: number
  messages: Array<{ id?: string; role?: string; content?: string; createdAt?: string }>
}

export interface SkillUsagePage {
  items: SkillUsageEvent[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function params(filters: SkillUsageFilters) {
  return {
    from: filters.from,
    to: filters.to,
    teamId: filters.teamId,
    skillKey: filters.skillKey || undefined,
    userId: filters.userId,
  }
}

export async function getSkillUsageAccessScope() {
  const { data } = await http.get<SkillUsageAccessScope>('/admin/skill-usage/access-scope')
  return data
}

export async function getSkillUsageOverview(filters: SkillUsageFilters) {
  const { data } = await http.get<SkillUsageOverview>('/admin/skill-usage/overview', { params: params(filters) })
  return data
}

export async function listSkillUsageEvents(filters: SkillUsageFilters, page = 0, size = 20) {
  const { data } = await http.get<SkillUsagePage>('/admin/skill-usage/events', { params: { ...params(filters), page, size } })
  return data
}

export async function getSkillUsageConversation(eventId: string, page = 0, size = 100) {
  const { data } = await http.get<SkillUsageConversation>(`/admin/skill-usage/events/${encodeURIComponent(eventId)}/conversation`, { params: { page, size } })
  return data
}
