import { http } from './http'

export interface AgentOperationsDashboard {
  dataStatus?: string
  activeAlerts?: Record<string, number>
  generatedAt: string
  overallStatus: string
  components: Array<{ key: string; name: string; status: string; latencyMs: number; error?: string }>
  workload: { running: number; pending: number; runningNow: number; agentExecutorActive: number; agentExecutorQueued: number; agentExecutorQueueCapacity: number; dshActiveRuns: number; dshMaxConcurrentRuns: number; dshBusyRejections: number; recentTotal: number; recentFailed: number; errorRatePercent: number; buildRunning: number; buildQueued: number; queryRunning: number; semanticIndexing: number }
  resources: { cpuPercent: number; memoryUsedBytes: number; memoryMaxBytes: number; diskUsedBytes: number; diskTotalBytes: number }
  latency: { p95Ms: number; p99Ms: number; window: string }
  codeGraphBindings: Record<string, number>
  qdrant: { collection: string; reachable: boolean }
  trend: Array<{ at: string; p95Ms: number; p99Ms: number; errorRatePercent: number }>
  alerts: Array<{ key: string; level: string; message: string }>
  capacity: Record<string, unknown>
}

export async function getAgentOperationsDashboard(window = 'PT15M') {
  const { data } = await http.get<AgentOperationsDashboard>('/admin/agent/operations/dashboard', { params: { window } })
  return data
}
