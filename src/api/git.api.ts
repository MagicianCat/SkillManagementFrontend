import { http } from './http'

export interface GitRepositoryResolution { repositoryPath: string; normalizedUrl: string; defaultBranch?: string | null; branches: string[]; headCommit?: string | null }
export interface ProjectGitRepository { id: number; displayName: string; locatorMode: string; repositoryPath: string; remoteUrl: string; normalizedUrl: string; defaultBranch?: string | null; trackedBranch: string; status: string; lastValidatedAt?: string | null; lastValidationError?: string | null; stageKeys: string[] }
export interface ProjectGitRepositoryInput { url: string; displayName?: string; branch: string; stageKeys: string[] }
export interface GitCommitObservation { commitSha: string; parentSha?: string | null; authorName?: string | null; authorEmail?: string | null; commitTime?: string | null; subject?: string | null; observationType: string; observedAt: string }
export interface GitWatch { id: number; repositoryId: number; repositoryName: string; normalizedUrl: string; branch: string; baselineCommit?: string | null; latestCommit?: string | null; status: string; lastPolledAt?: string | null; nextPollAt?: string | null; consecutiveFailures: number; lastError?: string | null; commits: GitCommitObservation[] }
export interface GitStageStatus { stageRunId: number; stageKey: string; stageStatus: string; watches: GitWatch[] }

export async function resolveGitRepository(projectKey: string, url: string) { return (await http.post<GitRepositoryResolution>(`/projects/${encodeURIComponent(projectKey)}/git-repositories:resolve`, { url })).data }
export async function getProjectGitRepositories(projectKey: string) { return (await http.get<ProjectGitRepository[]>(`/projects/${encodeURIComponent(projectKey)}/git-repositories`)).data }
export async function saveProjectGitRepositories(projectKey: string, repositories: ProjectGitRepositoryInput[]) { return (await http.put<ProjectGitRepository[]>(`/projects/${encodeURIComponent(projectKey)}/git-repositories`, { repositories })).data }
export async function appendProjectGitRepository(projectKey: string, repository: ProjectGitRepositoryInput) { return (await http.post<ProjectGitRepository[]>(`/projects/${encodeURIComponent(projectKey)}/git-repositories:append`, repository)).data }
export async function getGitStageStatus(runId: string, stageRunId: string) { return (await http.get<GitStageStatus>(`/workflow-runs/${encodeURIComponent(runId)}/stages/${encodeURIComponent(stageRunId)}/git-status`)).data }
export async function refreshGitStage(runId: string, stageRunId: string) { return (await http.post<GitStageStatus>(`/workflow-runs/${encodeURIComponent(runId)}/stages/${encodeURIComponent(stageRunId)}/git:refresh`)).data }
