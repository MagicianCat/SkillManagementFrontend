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

// ---- AI 研发效能（Generation 事实中心） ----

export interface EfficiencyFilters {
  from?: string
  to?: string
  teamId?: number
  userId?: number
}

export interface EfficiencySummary {
  generations: number
  activeUsers: number
  linesAdded: number
  linesDeleted: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  tokenCoverageRate: number
  locPer1kTokens: number
  avgGenerationDurationMs: number
  avgModelCalls: number
  toolFailureRate: number
}

export interface EfficiencyTrendPoint {
  bucket: string
  generations: number
  activeUsers: number
  linesAdded: number
  totalTokens: number
}

export interface DimensionEfficiency {
  key: string
  name: string
  generations: number
  users: number
  linesAdded: number
  totalTokens: number
}

export interface SkillEfficiency {
  skillKey: string
  displayName: string
  generations: number
  invocations: number
  users: number
  projects: number
  lastInvokedAt: string | null
}

export interface MemberEfficiency {
  userId: number
  displayName: string
  username: string
  generations: number
  linesAdded: number
  totalTokens: number
  lastActiveAt: string | null
}

export interface FileTypeEfficiency {
  category: string
  linesAdded: number
  linesDeleted: number
  filesCreated: number
  filesModified: number
}

export interface TokenBreakdown {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheMissTokens: number
  thinkingTokens: number
  answerTokens: number
}

export interface SkillCombo {
  skillKey: string
  displayName: string
  coGenerations: number
}

export interface EfficiencyDashboard {
  summary: EfficiencySummary
  trend: EfficiencyTrendPoint[]
  stageRanking: DimensionEfficiency[]
  teamRanking: DimensionEfficiency[]
  projectRanking: DimensionEfficiency[]
  skillRanking: SkillEfficiency[]
  fileTypes: FileTypeEfficiency[]
  tokenBreakdown: TokenBreakdown
  from: string
  to: string
}

export interface StageDetail {
  stage: string
  summary: EfficiencySummary
  projectCount: number
  trend: EfficiencyTrendPoint[]
  teamRanking: DimensionEfficiency[]
  projectRanking: DimensionEfficiency[]
  skillRanking: SkillEfficiency[]
  fileTypes: FileTypeEfficiency[]
  from: string
  to: string
}

export interface TeamDetail {
  teamId: number
  teamName: string
  summary: EfficiencySummary
  trend: EfficiencyTrendPoint[]
  members: MemberEfficiency[]
  stageDistribution: DimensionEfficiency[]
  projectDistribution: DimensionEfficiency[]
  skillDistribution: SkillEfficiency[]
  from: string
  to: string
}

export interface ProjectDetail {
  projectKey: string
  projectName: string
  summary: EfficiencySummary
  skillCount: number
  trend: EfficiencyTrendPoint[]
  stageDistribution: DimensionEfficiency[]
  fileTypes: FileTypeEfficiency[]
  skillRanking: SkillEfficiency[]
  members: MemberEfficiency[]
  from: string
  to: string
}

export interface SkillDetail {
  skillKey: string
  summary: {
    invocations: number
    generations: number
    users: number
    projects: number
    linesAdded: number
    totalTokens: number
  }
  trend: EfficiencyTrendPoint[]
  teamRanking: DimensionEfficiency[]
  projectRanking: DimensionEfficiency[]
  stageDistribution: DimensionEfficiency[]
  fileTypes: FileTypeEfficiency[]
  skillCombos: SkillCombo[]
  from: string
  to: string
}

export interface GenerationRow {
  id: number
  generationId: string
  startedAt: string
  userId: number
  displayName: string
  username: string
  teamNames: string | null
  projectKey: string | null
  projectName: string | null
  primaryStage: string | null
  status: string
  skillKeys: string | null
  linesAdded: number
  linesDeleted: number
  totalTokens: number
  tokenQuality: string | null
  locPer1kTokens: number
  durationMs: number | null
  modelCallCount: number | null
  toolCallCount: number
  toolFailureCount: number
}

export interface GenerationPage {
  items: GenerationRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

function efficiencyParams(filters: EfficiencyFilters) {
  return { from: filters.from, to: filters.to, teamId: filters.teamId, userId: filters.userId }
}

export async function getEfficiencyDashboard(filters: EfficiencyFilters) {
  const { data } = await http.get<EfficiencyDashboard>('/admin/skill-usage/dashboard', { params: efficiencyParams(filters) })
  return data
}

export async function listGenerations(filters: EfficiencyFilters, page = 0, size = 20) {
  const { data } = await http.get<GenerationPage>('/admin/skill-usage/generations', { params: { ...efficiencyParams(filters), page, size } })
  return data
}

export async function getStageDetail(stage: string, filters: EfficiencyFilters) {
  const { data } = await http.get<StageDetail>(`/admin/skill-usage/stages/${encodeURIComponent(stage)}`, { params: efficiencyParams(filters) })
  return data
}

export async function getTeamDetail(teamId: number, filters: EfficiencyFilters) {
  const { data } = await http.get<TeamDetail>(`/admin/skill-usage/teams/${teamId}`, { params: efficiencyParams(filters) })
  return data
}

export async function getProjectDetail(projectKey: string, filters: EfficiencyFilters) {
  const { data } = await http.get<ProjectDetail>(`/admin/skill-usage/projects/${encodeURIComponent(projectKey)}`, { params: efficiencyParams(filters) })
  return data
}

export async function getSkillDetail(skillKey: string, filters: EfficiencyFilters) {
  const { data } = await http.get<SkillDetail>(`/admin/skill-usage/skills/${encodeURIComponent(skillKey)}`, { params: efficiencyParams(filters) })
  return data
}
