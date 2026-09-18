import { http } from './http'
import type { WorkflowRun, WorkflowStage, WorkflowEvent, InterventionType } from '../types/workflow'

export async function getWorkflowRun(runId: string) { const { data } = await http.get<WorkflowRun>(`/workflow-runs/${encodeURIComponent(runId)}`); return data }
export async function startWorkflowRun(projectKey: string, input?: { workflowCode?: string; workflowVersion?: number; profileVersionIds?: Array<string | number> }) { const { data } = await http.post<WorkflowRun>(`/projects/${encodeURIComponent(projectKey)}/workflow-runs`, input || {}); return data }
export async function sendIntervention(runId: string, type: InterventionType, content?: string) { const { data } = await http.post(`/workflow-runs/${encodeURIComponent(runId)}/interventions`, { type, content }); return data }
export async function getWorkflowStages(runId: string) { const { data } = await http.get<WorkflowStage[]>(`/workflow-runs/${encodeURIComponent(runId)}/stages`); return data }
export async function finalAcceptWorkflowRun(runId: string, decision: 'ACCEPT' | 'REWORK', targetStageKey?: string, comment?: string) { const { data } = await http.post(`/workflow-runs/${encodeURIComponent(runId)}/final-acceptance`, { decision, targetStageKey, comment }); return data }

export function workflowEventsUrl(runId: string) { return `/workflow-runs/${encodeURIComponent(runId)}/events` }
export type { WorkflowEvent }
