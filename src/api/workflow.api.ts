import { http } from './http'
import type { WorkflowRun, WorkflowEvent, InterventionType, InterventionTarget } from '../types/workflow'

export async function getWorkflowRun(runId: string) { const { data } = await http.get<WorkflowRun>(`/workflow-runs/${encodeURIComponent(runId)}`); return data }
export async function startWorkflowRun(projectKey: string, input: { initialRequest: string; workflowCode: string; workflowVersion: number; profileVersionIds?: Array<string | number> }) { const { data } = await http.post<WorkflowRun>(`/projects/${encodeURIComponent(projectKey)}/workflow-runs`, input); return data }
/** 每个项目组只有一个工作流 run：返回该项目当前 run，没有则 404。 */
export async function getCurrentWorkflowRun(projectKey: string) { const { data } = await http.get<WorkflowRun>(`/projects/${encodeURIComponent(projectKey)}/workflow-runs/current`); return data }
export async function sendIntervention(runId: string, type: InterventionType, content?: string, target?: InterventionTarget) { const { data } = await http.post(`/workflow-runs/${encodeURIComponent(runId)}/interventions`, { type, content, ...target }); return data }
export async function finalAcceptWorkflowRun(runId: string, decision: 'ACCEPT' | 'REWORK', targetStageKey?: string, comment?: string) { const { data } = await http.post(`/workflow-runs/${encodeURIComponent(runId)}/final-acceptance`, { decision, targetStageKey, comment }); return data }
export async function designAcceptWorkflowRun(runId: string, decision: 'ACCEPT' | 'REWORK', targetStageKey = 'REQUIREMENT', comment?: string) { const { data } = await http.post(`/workflow-runs/${encodeURIComponent(runId)}/design-acceptance`, { decision, targetStageKey, comment }); return data }

export function workflowEventsUrl(runId: string) { return `/workflow-runs/${encodeURIComponent(runId)}/events` }
export type { WorkflowEvent }
