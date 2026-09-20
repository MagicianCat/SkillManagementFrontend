import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getWorkflowRun } from '../api/workflow.api'
import type { WorkflowRun, WorkflowStage } from '../types/workflow'

const ACTIVE = ['RUNNING', 'PROVISIONING', 'HUMAN_REQUIRED', 'PAUSED']
const COMPLETED = ['COMPLETED']

export const useProjectWorkspaceStore = defineStore('projectWorkspace', () => {
  const workflowRun = ref<WorkflowRun | null>(null); const stagesById = ref<Record<string, WorkflowStage>>({}); const selectedStageId = ref<string | null>(null); const loading = ref(false); const error = ref('')
  let refreshPromise: Promise<void> | null = null; let refreshQueued = false; let refreshTimer: ReturnType<typeof setTimeout> | undefined; let pollTimer: ReturnType<typeof setInterval> | undefined; let autoRefreshRunId = ''; let visibilityHandler: (() => void) | undefined
  const activeStatuses = [...ACTIVE, 'WAITING_HUMAN']
  const stages = computed(() => Object.values(stagesById.value))
  function applySnapshot(run: WorkflowRun) { workflowRun.value = run; const data = run.stages ?? []; stagesById.value = Object.fromEntries(data.map((stage) => [stage.id, stage])); if (!selectedStageId.value || !stagesById.value[selectedStageId.value]) selectedStageId.value = (data.find((stage) => ACTIVE.includes(stage.status)) ?? data[0])?.id ?? null; if (autoRefreshRunId && !activeStatuses.includes(run.status)) stopAutoRefresh() }
  async function load(runId: string) { loading.value = true; error.value = ''; try { applySnapshot(await getWorkflowRun(runId)) } catch (cause) { error.value = cause instanceof Error ? cause.message : '工作台加载失败' } finally { loading.value = false } }
  async function refresh() {
    const runId = workflowRun.value?.id
    if (runId == null) return
    if (refreshPromise) { refreshQueued = true; return refreshPromise }
    refreshPromise = getWorkflowRun(String(runId)).then(applySnapshot).catch(() => undefined).finally(() => { refreshPromise = null; if (refreshQueued) { refreshQueued = false; void refresh() } })
    return refreshPromise
  }
  function scheduleRefresh(delay = 300) { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh() }, delay) }
  function stopAutoRefresh() { if (refreshTimer) clearTimeout(refreshTimer); if (pollTimer) clearInterval(pollTimer); if (visibilityHandler && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibilityHandler); refreshTimer = undefined; pollTimer = undefined; visibilityHandler = undefined; autoRefreshRunId = '' }
  function startAutoRefresh(runId: string) {
    stopAutoRefresh(); autoRefreshRunId = runId
    const tick = () => { if (autoRefreshRunId !== runId || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return; if (workflowRun.value && activeStatuses.includes(workflowRun.value.status)) void refresh() }
    pollTimer = setInterval(tick, 2000)
    if (typeof document !== 'undefined') { visibilityHandler = tick; document.addEventListener('visibilitychange', tick); scheduleRefresh(0) }
  }
  function applyEvent(event: { type: string; data: Record<string, unknown> }) {
    if (event.type === 'workflow.snapshot') {
      const snapshot = event.data.workflowRun as WorkflowRun | undefined
      if (snapshot) applySnapshot(snapshot)
      return
    }
    if (event.type === 'workflow.status.changed' && workflowRun.value) workflowRun.value = { ...workflowRun.value, ...(event.data as Partial<WorkflowRun>) }
    // SSE 事件先于后端状态落库，延迟重取完整快照，避免只更新时间线而遗漏 Agent/Stage 状态。
    if (['workflow.status.changed', 'stage.status.changed', 'agent.status.changed', 'agent.protocol.retry.requested', 'artifact.revision.created'].includes(event.type) || event.type.startsWith('human.question.')) { scheduleRefresh(); return }
    const stageId = String(event.data.stageId ?? '')
    if (stageId && stagesById.value[stageId]) stagesById.value[stageId] = { ...stagesById.value[stageId], ...(event.data as Partial<WorkflowStage>) }
  }


  /** 当前阶段：优先选中阶段，否则第一个活动阶段，否则第一个阶段。 */
  const currentStage = computed(() => {
    const list = stages.value
    if (!list.length) return null
    if (selectedStageId.value && stagesById.value[selectedStageId.value]) return stagesById.value[selectedStageId.value]
    return list.find((stage) => ACTIVE.includes(stage.status)) ?? list[0]
  })
  /** 需求阶段（审批与默认目标）。 */
  const requirementStage = computed(() => stages.value.find((stage) => stage.key === 'REQUIREMENT' || stage.key === 'requirement' || stage.name.includes('需求')) ?? null)
  /** 当前阶段的 Review Cycle（loopCount+1 / maxLoopCount）。 */
  const reviewCycle = computed(() => {
    const stage = currentStage.value
    if (!stage) return null
    return { current: (stage.loopCount ?? 0) + 1, max: stage.maxLoopCount ?? 0 }
  })
  /** 当前阶段最新 Revision。 */
  const latestRevision = computed(() => {
    const artifacts = currentStage.value?.artifacts ?? []
    if (!artifacts.length) return null
    return artifacts.reduce((top, item) => ((item.revision ?? 0) > (top.revision ?? 0) ? item : top))
  })
  /** 待处理问题数（各阶段产物 reviewIssues 汇总）。 */
  const pendingIssues = computed(() => stages.value.reduce((total, stage) => total + (stage.artifacts ?? []).reduce((sum, artifact) => sum + (artifact.reviewIssues?.length ?? 0), 0), 0))
  const completedStageCount = computed(() => stages.value.filter((stage) => COMPLETED.includes(stage.status)).length)
  const activeAgentCount = computed(() => stages.value.reduce((total, stage) => total + (stage.agents ?? []).filter((agent) => ['QUEUED', 'STARTING', 'RUNNING', 'WAITING_HUMAN', 'PAUSED'].includes(agent.status)).length, 0))
  const running = computed(() => ['RUNNING', 'PROVISIONING'].includes(workflowRun.value?.status ?? ''))

  function select(stageId: string) { selectedStageId.value = stageId }

  return { workflowRun, stagesById, stages, selectedStageId, loading, error, load, refresh, startAutoRefresh, stopAutoRefresh, applyEvent, currentStage, requirementStage, reviewCycle, latestRevision, pendingIssues, completedStageCount, activeAgentCount, running, select }
})
