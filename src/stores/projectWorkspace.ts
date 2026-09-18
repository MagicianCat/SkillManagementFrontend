import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getWorkflowRun } from '../api/workflow.api'
import type { WorkflowRun, WorkflowStage } from '../types/workflow'

const ACTIVE = ['RUNNING', 'PROVISIONING', 'HUMAN_REQUIRED', 'PAUSED']
const COMPLETED = ['COMPLETED']

export const useProjectWorkspaceStore = defineStore('projectWorkspace', () => {
  const workflowRun = ref<WorkflowRun | null>(null); const stagesById = ref<Record<string, WorkflowStage>>({}); const selectedStageId = ref<string | null>(null); const loading = ref(false); const error = ref('')
  const stages = computed(() => Object.values(stagesById.value))
  async function load(runId: string) { loading.value = true; error.value = ''; try { workflowRun.value = await getWorkflowRun(runId); const data = workflowRun.value.stages ?? []; stagesById.value = Object.fromEntries(data.map((stage) => [stage.id, stage])); if (!selectedStageId.value || !stagesById.value[selectedStageId.value]) selectedStageId.value = (data.find((stage) => ACTIVE.includes(stage.status)) ?? data[0])?.id ?? null } catch (cause) { error.value = cause instanceof Error ? cause.message : '工作台加载失败' } finally { loading.value = false } }
  function applyEvent(event: { type: string; data: Record<string, unknown> }) {
    if (event.type === 'workflow.snapshot') {
      const snapshot = event.data.workflowRun as WorkflowRun | undefined
      if (snapshot) { workflowRun.value = snapshot; const snapshotStages = snapshot.stages ?? []; stagesById.value = Object.fromEntries(snapshotStages.map((stage) => [stage.id, stage])) }
      return
    }
    if (event.type === 'workflow.status.changed' && workflowRun.value) workflowRun.value = { ...workflowRun.value, ...(event.data as Partial<WorkflowRun>) }
    // 产物创建：SSE 实时事件只带 id，缺少名称/revision_no，静默重取一次以拿到完整产物（含可链接的 documentId）。
    if (event.type === 'artifact.revision.created') {
      void refreshArtifacts()
      return
    }
    const stageId = String(event.data.stageId ?? '')
    if (stageId && stagesById.value[stageId]) stagesById.value[stageId] = { ...stagesById.value[stageId], ...(event.data as Partial<WorkflowStage>) }
  }

  /** 静默重取（不重置选中阶段、不显示全局 loading），用于产物实时刷新。
   *  用 getWorkflowRun：后端没有独立的 stages 端点，RunView.stages 即含完整 artifacts。 */
  let refreshing = false
  async function refreshArtifacts() {
    const runId = workflowRun.value?.id
    if (runId == null || refreshing) return
    refreshing = true
    try {
      const run = await getWorkflowRun(String(runId))
      workflowRun.value = run
      const data = run.stages ?? []
      for (const stage of data) {
        const prior = stagesById.value[stage.id]
        stagesById.value[stage.id] = prior ? { ...prior, ...stage } : stage
      }
    } catch { /* 保留现有数据，下一次事件或手动刷新会再试 */ } finally { refreshing = false }
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
    if (!stage || stage.maxLoopCount == null) return null
    return { current: (stage.loopCount ?? 0) + 1, max: stage.maxLoopCount }
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

  return { workflowRun, stagesById, stages, selectedStageId, loading, error, load, applyEvent, currentStage, requirementStage, reviewCycle, latestRevision, pendingIssues, completedStageCount, activeAgentCount, running, select }
})
