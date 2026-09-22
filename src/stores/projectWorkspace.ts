import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getWorkflowRun } from '../api/workflow.api'
import type { StageStatus, WorkflowRun, WorkflowStage } from '../types/workflow'

const ACTIVE = ['RUNNING', 'PROVISIONING', 'HUMAN_REQUIRED', 'WAITING_HUMAN', 'PAUSED']
const FOLLOWABLE = [...ACTIVE, 'WAITING_HUMAN', 'WAITING_ACCEPTANCE', 'WAITING_DESIGN_ACCEPTANCE']
const COMPLETED = ['COMPLETED']

export const useProjectWorkspaceStore = defineStore('projectWorkspace', () => {
  const workflowRun = ref<WorkflowRun | null>(null); const stagesById = ref<Record<string, WorkflowStage>>({}); const selectedStageId = ref<string | null>(null); const loading = ref(false); const error = ref('')
  let refreshPromise: Promise<void> | null = null; let refreshQueued = false; let refreshTimer: ReturnType<typeof setTimeout> | undefined; let pollTimer: ReturnType<typeof setInterval> | undefined; let autoRefreshRunId = ''; let visibilityHandler: (() => void) | undefined
  const activeStatuses = [...ACTIVE, 'WAITING_HUMAN', 'WAITING_DESIGN_ACCEPTANCE', 'WAITING_FINAL_ACCEPTANCE']
  const stages = computed(() => Object.values(stagesById.value))

  /** MOCK（mock/dev-pipeline-demo）：mock 引擎驱动后续研发链路时，把 mock 阶段的展示态并入此 overlay；
   *  后端周期快照只含 PENDING 占位，applySnapshot 后据此回放，避免 2s 轮询覆盖 mock 视觉状态。 */
  const mockOverlay = ref<Record<string, Partial<WorkflowStage>>>({})
  /** MOCK：DAG 上「前端编码」与「后端编码」是并行支线，但后端只落了 BACKEND_CODING 一个占位。
   *  前端 mock 不跑具体的前端编码过程，只注入一个虚拟阶段节点，随编码阶段完成一起变绿。 */
  const MOCK_FRONTEND_ID = 'mock-frontend-coding'
  function frontendCodingVirtual(status: StageStatus): WorkflowStage {
    return { id: MOCK_FRONTEND_ID, key: 'FRONTEND_CODING', name: '前端编码', displayName: '前端编码', status, maxLoopCount: 3, agents: [], artifacts: [], metadata: { virtual: true } }
  }
  function setMockOverlay(stageId: string, patch: Partial<WorkflowStage>) {
    mockOverlay.value = { ...mockOverlay.value, [stageId]: { ...mockOverlay.value[stageId], ...patch } }
    if (stagesById.value[stageId]) stagesById.value[stageId] = { ...stagesById.value[stageId], ...patch }
  }
  function clearMockOverlay() { mockOverlay.value = {} }

  function applySnapshot(run: WorkflowRun) {
    const previousSelected = selectedStageId.value ? stagesById.value[selectedStageId.value] : null
    workflowRun.value = run
    const data = run.stages ?? []
    const next = Object.fromEntries(data.map((stage) => [String(stage.id), stage]))
    // 回放 mock overlay：后端快照中的 mock 阶段仍为 PENDING 占位，用引擎维护的展示态覆盖。
    for (const [stageId, patch] of Object.entries(mockOverlay.value)) {
      if (next[stageId]) next[stageId] = { ...next[stageId], ...patch }
    }
    // MOCK：存在 mock 阶段时注入虚拟「前端编码」节点，状态跟随编码阶段（完成即变绿，不跑具体执行）。
    const backendCoding = data.find((stage) => String(stage.key).toUpperCase() === 'BACKEND_CODING')
    if (backendCoding) {
      const overlay = (mockOverlay.value[String(backendCoding.id)] ?? {}) as Partial<WorkflowStage>
      const backendStatus = String(overlay.status ?? backendCoding.status)
      next[MOCK_FRONTEND_ID] = frontendCodingVirtual(backendStatus === 'COMPLETED' ? 'COMPLETED' : backendStatus === 'PENDING' ? 'PENDING' : 'RUNNING')
    } else {
      delete next[MOCK_FRONTEND_ID]
    }
    stagesById.value = next
    const activeStage = data.find((stage) => FOLLOWABLE.includes(stage.status))
    const selected = selectedStageId.value ? stagesById.value[selectedStageId.value] : null
    const selectedJustFinished = previousSelected && FOLLOWABLE.includes(previousSelected.status) && selected && !FOLLOWABLE.includes(selected.status)
    if (!selected || (selectedJustFinished && activeStage)) {
      const next = activeStage ?? data[0]
      selectedStageId.value = next?.id == null ? null : String(next.id)
    }
    if (autoRefreshRunId && !activeStatuses.includes(run.status)) stopAutoRefresh()
  }
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


  /** 当前阶段：优先选中阶段，否则第一个活动阶段，否则第一个阶段。虚拟 mock 节点（前端编码）不参与兜底选中。 */
  const currentStage = computed(() => {
    const list = stages.value
    if (!list.length) return null
    if (selectedStageId.value && stagesById.value[selectedStageId.value]) return stagesById.value[selectedStageId.value]
    return list.find((stage) => ACTIVE.includes(stage.status) && !stage.metadata?.virtual) ?? list.find((stage) => !stage.metadata?.virtual) ?? null
  })
  /** 需求阶段（兼容旧版审批与默认目标）。 */
  const requirementStage = computed(() => stages.value.find((stage) => String(stage.key).toUpperCase() === 'REQUIREMENT') ?? null)
  /** 后端可通过 metadata.parallelGroup 标记并行设计分支；旧版本按稳定 stage key 兼容识别。 */
  const parallelDesignStages = computed(() => stages.value.filter((stage) => {
    const group = String(stage.metadata?.parallelGroup ?? stage.metadata?.parallel_group ?? '').toUpperCase()
    if (group === 'DESIGN' || group === 'DESIGN_BRANCH') return true
    const key = String(stage.key ?? '').toUpperCase()
    return key === 'ARCHITECTURE' || key === 'ARCHITECTURE_DESIGN' || key === 'UI' || key === 'UI_DESIGN'
  }))
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
  const completedStageCount = computed(() => stages.value.filter((stage) => COMPLETED.includes(stage.status) && !stage.metadata?.virtual).length)
  const activeAgentCount = computed(() => stages.value.reduce((total, stage) => total + (stage.agents ?? []).filter((agent) => ['QUEUED', 'STARTING', 'RUNNING', 'WAITING_HUMAN', 'PAUSED'].includes(agent.status)).length, 0))
  const running = computed(() => ['RUNNING', 'PROVISIONING'].includes(workflowRun.value?.status ?? ''))
  /** 选中的阶段可以交互的唯一条件：该阶段仍在执行/等待回答；历史及待验收阶段只读。 */
  const selectedStageInteractive = computed(() => {
    const stage = currentStage.value
    return Boolean(stage && ACTIVE.includes(String(stage.status)))
  })

  function select(stageId: string) { selectedStageId.value = stageId }

  return { workflowRun, stagesById, stages, selectedStageId, loading, error, load, refresh, startAutoRefresh, stopAutoRefresh, applyEvent, currentStage, requirementStage, parallelDesignStages, reviewCycle, latestRevision, pendingIssues, completedStageCount, activeAgentCount, running, selectedStageInteractive, select, mockOverlay, setMockOverlay, clearMockOverlay }
})
