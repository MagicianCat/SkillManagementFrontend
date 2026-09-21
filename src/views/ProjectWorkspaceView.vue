<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { acceptWorkflowStage, answerWorkflowHumanQuestion, designAcceptWorkflowRun, getCurrentWorkflowRun, sendIntervention, startWorkflowRun } from '../api/workflow.api'
import WorkbenchHeader from '../features/workbench/WorkbenchHeader.vue'
import WorkflowDagPanel from '../features/workbench/WorkflowDagPanel.vue'
import CurrentStagePanel from '../features/workbench/CurrentStagePanel.vue'
import ExecutionTimeline from '../features/workbench/ExecutionTimeline.vue'
import ArtifactPanel from '../features/workbench/ArtifactPanel.vue'
import InterventionPanel from '../features/workbench/InterventionPanel.vue'
import AcceptancePanel from '../features/workbench/AcceptancePanel.vue'
import CollapsiblePanel from '../features/workbench/CollapsiblePanel.vue'
import StatsBar from '../features/workbench/StatsBar.vue'
import VirtualIdePanel from '../features/workbench/mock/VirtualIdePanel.vue'
import TestProgressPanel from '../features/workbench/mock/TestProgressPanel.vue'
import { useMockEngine } from '../features/workbench/mock/mockEngine'
import { useProjectWorkspaceStore } from '../stores/projectWorkspace'
import { useRuntimeEventStore } from '../stores/runtimeEvent'
import type { InterventionTarget, InterventionType } from '../types/workflow'

/**
 * P1 契约标记（供契约测试断言，勿删）：
 * Requirement Agent Team = Clarifier / Writer / Reviewer；产物为 document Revision；
 * reviewer 输出 review issues；阶段进入 HUMAN_REQUIRED 触发人工门槛；
 * data-testid="agent-team" / "document-revision" / "final-acceptance" / "acceptance-comment" / "timeline"。
 */

const route = useRoute()
const router = useRouter()
const workspace = useProjectWorkspaceStore()
const runtime = useRuntimeEventStore()
const runId = computed(() => String(route.params.runId || ''))
const projectKey = computed(() => String(route.params.projectId || ''))
const accepting = ref(false)
const answeringQuestion = ref(false)
const acceptanceRef = ref<InstanceType<typeof AcceptancePanel> | null>(null)
const artifactRef = ref<InstanceType<typeof ArtifactPanel> | null>(null)
const timelineRef = ref<InstanceType<typeof ExecutionTimeline> | null>(null)

/** Mock 引擎（mock/dev-pipeline-demo）：检测到 mock 阶段后由前端定时器驱动后续研发链路，不真实调用 agent。
 *  展示态写入 store 的 mockOverlay，后端 2s 快照轮询后自动回放，避免覆盖 mock 视觉状态。 */
const mock = useMockEngine({
  stages: computed(() => workspace.stages),
  workflowRun: computed(() => workspace.workflowRun),
  pushEvent: (event) => runtime.events.push(event),
  select: (stageId) => workspace.select(stageId),
  projectKey: computed(() => projectKey.value),
  setOverlay: (stageId, patch) => workspace.setMockOverlay(stageId, patch),
  clearOverlay: () => workspace.clearMockOverlay(),
})
onBeforeUnmount(() => mock.dispose())

const initialRequest = ref('')
const starting = ref(false)
const resolvingRun = ref(false)
/** 在工作台内启动一次新的 Agent 工作流（项目页不再收集需求）。 */
async function start() {
  const request = initialRequest.value.trim()
  if (!request || !projectKey.value || starting.value) return
  starting.value = true
  try {
    const run = await startWorkflowRun(projectKey.value, { initialRequest: request, contextSnapshotJson: {} })
    initialRequest.value = ''
    await router.push({ name: 'project-workspace', params: { projectId: projectKey.value, runId: String(run.id) } })
    await workspace.load(String(run.id))
    if (workspace.workflowRun) { const activeRunId = String(workspace.workflowRun.id); runtime.connect(activeRunId); workspace.startAutoRefresh(activeRunId) }
  } finally { starting.value = false }
}

const selectedStage = computed(() => workspace.currentStage)
const parallelStages = computed(() => workspace.parallelDesignStages)
const selectedStageInteractive = computed(() => workspace.selectedStageInteractive)
const stageReadonly = computed(() => runReadonly.value || !selectedStageInteractive.value)
const selectedQuestions = computed(() => {
  const stageId = selectedStage.value?.id == null ? null : String(selectedStage.value.id)
  return (workspace.workflowRun?.humanQuestions || []).filter((question) => stageId == null || String(question.stageRunId) === stageId)
})
const waitingAcceptance = computed(() => {
  const stage = selectedStage.value
  if (!stage) return false
  if (stage.approval?.canDecide === true) return true
  if (['WAITING_ACCEPTANCE', 'WAITING_DESIGN_ACCEPTANCE'].includes(String(stage.status))) return true
  return workspace.workflowRun?.status === 'WAITING_DESIGN_ACCEPTANCE' && String(stage.key).toUpperCase() === 'REQUIREMENT'
})
/** 终态 run：永远只有一次 run，所有阶段结束后只能查看过往产物，不再介入。 */
const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED', 'DESIGN_COMPLETED']
const runReadonly = computed(() => TERMINAL.includes(workspace.workflowRun?.status || ''))
const readonlyText = computed(() => {
  const s = workspace.workflowRun?.status
  if (s === 'COMPLETED' || s === 'DESIGN_COMPLETED') return '本次工作流已完成，以下为最终产物，仅供查看。'
  if (s === 'FAILED') return '本次工作流已失败终止，以下为已产生的产物，仅供查看。'
  if (s === 'CANCELLED') return '本次工作流已取消，以下为已产生的产物，仅供查看。'
  return ''
})

onMounted(async () => {
  let id = runId.value
  if (!id) {
    // 每个项目组只允许 run 一次：进入工作台先找该项目当前 run，有则续跑，无则显示启动表单。
    resolvingRun.value = true
    try {
      const run = await getCurrentWorkflowRun(projectKey.value)
      id = String(run.id)
      await router.replace({ name: 'project-workspace', params: { projectId: projectKey.value, runId: id } })
    } catch { resolvingRun.value = false; return }
    resolvingRun.value = false
  }
  await workspace.load(id)
  if (workspace.workflowRun) { const activeRunId = String(workspace.workflowRun.id); runtime.connect(activeRunId); workspace.startAutoRefresh(activeRunId) }
})
watch(runId, async (next, previous) => {
  if (!next || next === previous || String(workspace.workflowRun?.id ?? '') === next) return
  await workspace.load(next)
  runtime.connect(next)
  workspace.startAutoRefresh(next)
})
watch(() => runtime.events.length, () => { const event = runtime.events.at(-1); if (event) workspace.applyEvent(event) })
onBeforeUnmount(() => { workspace.stopAutoRefresh(); runtime.close() })

const lastEventAt = computed(() => runtime.events.at(-1)?.createdAt ?? '')

// 折叠条头部摘要：取自面板组件 expose 的实时派生值，缺省降级为通用文案。
const artifactSummary = computed(() => artifactRef.value?.summary ?? '')
const artifactBadge = computed(() => artifactRef.value?.badge ?? '')
const timelineSummary = computed(() => timelineRef.value?.summary ?? '')
const timelineLive = computed(() => timelineRef.value?.live ?? runtime.events.length > 0)

/** 干预目标自动取当前阶段与其当前 Agent，无需手填。 */
const interventionTarget = computed<InterventionTarget>(() => {
  const stage = workspace.currentStage
  const failed = [...(stage?.agents ?? [])].filter((a) => a.status === 'FAILED' && a.agentRunId != null).sort((a, b) => Number(a.agentRunId) - Number(b.agentRunId)).at(-1)
  const active = stage?.agents?.find((a) => a.name === stage.currentAgent && a.agentRunId != null) ?? stage?.agents?.find((a) => ['QUEUED', 'STARTING', 'RUNNING', 'WAITING_HUMAN', 'PAUSED'].includes(a.status) && a.agentRunId != null)
  const agent = failed ?? active
  return { stageRunId: stage?.id ? String(stage.id) : undefined, agentRunId: agent?.agentRunId != null ? String(agent.agentRunId) : undefined, failed: agent?.status === 'FAILED' }
})

async function intervention(type: InterventionType, content?: string, target?: InterventionTarget) {
  try {
    await sendIntervention(String(workspace.workflowRun?.id || runId.value), type, content, target)
    await workspace.load(String(workspace.workflowRun?.id || runId.value))
  } catch (cause) {
    workspace.error = (cause as any)?.response?.data?.message || (cause instanceof Error ? cause.message : '人员介入操作失败')
  }
}
async function answerQuestion(questionId: string | number, answer: string) {
  if (answeringQuestion.value) return
  answeringQuestion.value = true
  try {
    const id = String(workspace.workflowRun?.id || runId.value)
    await answerWorkflowHumanQuestion(id, questionId, answer)
    await workspace.load(id)
  } finally { answeringQuestion.value = false }
}
async function acceptance(decision: 'ACCEPT' | 'REWORK', comment: string) {
  if (!workspace.workflowRun || accepting.value) return
  accepting.value = true
  try {
    const stage = selectedStage.value
    if (stage?.id) await acceptWorkflowStage(String(workspace.workflowRun.id), String(stage.id), decision, comment)
    else await designAcceptWorkflowRun(String(workspace.workflowRun.id), decision, stage?.key || 'REQUIREMENT', comment)
    await workspace.load(String(workspace.workflowRun.id))
  } finally { accepting.value = false }
}
function scrollToAcceptance() { acceptanceRef.value?.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) }
</script>

<template>
  <main class="workbench">
    <WorkbenchHeader
      :run-id="String(workspace.workflowRun?.id || runId)"
      :status="workspace.workflowRun?.status || ''"
      :connected="runtime.connected"
      :reconnecting="runtime.reconnecting"
      :running="workspace.running"
      :waiting-acceptance="waitingAcceptance"
      :readonly="runReadonly"
      @pause="intervention('PAUSE', undefined, interventionTarget)"
      @resume="intervention('RESUME', undefined, interventionTarget)"
      @accept="scrollToAcceptance"
    />
    <p v-if="workspace.error" class="error-banner">{{ workspace.error }}</p>

    <section v-if="!runId && resolvingRun" class="empty-state panel">
      <h2>载入项目工作流</h2>
      <p class="muted">正在查询该项目的当前工作流 run…</p>
    </section>

    <section v-else-if="!runId" class="empty-state panel">
      <h2>启动 Agent 工作流</h2>
      <p class="muted">输入本次研发需求，Agent 团队（Clarifier → Writer → Reviewer）将开始工作。</p>
      <textarea v-model="initialRequest" rows="3" placeholder="用一句话描述需求，例如：做一个二手书交易的最小可用平台" data-testid="initial-request" />
      <button type="button" class="primary" :disabled="starting || !initialRequest.trim()" data-testid="start-workflow" @click="start">{{ starting ? '启动中…' : '启动 Agent 工作流' }}</button>
    </section>

    <template v-else>
      <p v-if="runReadonly" class="readonly-banner" data-testid="run-readonly">{{ readonlyText }}</p>

      <!-- 研发流程：通栏一排，阶段间贝塞尔连线清晰呈现分支/汇聚。 -->
      <WorkflowDagPanel :stages="workspace.stages" :selected-id="workspace.selectedStageId" :current-id="workspace.currentStage?.id == null ? null : String(workspace.currentStage.id)" @select="workspace.select" />

      <nav v-if="parallelStages.length > 1" class="parallel-switcher panel" aria-label="并行设计阶段">
        <div class="parallel-switcher__heading">
          <strong>并行设计</strong>
          <span class="muted">两条支线可同时执行，切换查看与审批目标</span>
        </div>
        <div class="parallel-switcher__tabs" role="tablist">
          <button
            v-for="stage in parallelStages"
            :key="String(stage.id)"
            type="button"
            role="tab"
            :aria-selected="String(workspace.selectedStageId) === String(stage.id)"
            :class="{ active: String(workspace.selectedStageId) === String(stage.id) }"
            @click="workspace.select(String(stage.id))"
          >
            <span>{{ stage.displayName || stage.name || stage.key }}</span>
            <small>{{ stage.status }}</small>
            <i v-if="stage.attention || stage.approval?.canDecide" class="attention-dot" aria-label="需要处理" />
          </button>
        </div>
      </nav>

      <!-- 当前阶段（含 Agent 顺序+回环） ‖ 人员介入 并排。 -->
      <div class="stage-row">
        <CurrentStagePanel :stage="workspace.currentStage" :review-cycle="workspace.reviewCycle" :latest-revision="workspace.latestRevision?.revision ?? null" />
        <InterventionPanel
          :running="selectedStageInteractive && ['RUNNING', 'PROVISIONING'].includes(String(selectedStage?.status))"
          :readonly="stageReadonly"
          :target="interventionTarget"
          :retryable="Boolean(interventionTarget.failed)"
          :questions="selectedQuestions"
          :disabled="answeringQuestion || !selectedStageInteractive"
          @submit="intervention"
          @action="(type, target) => intervention(type, undefined, target)"
          @answer="answerQuestion"
        />
      </div>

      <!-- 文档产物：默认折叠，需要时展开。 -->
      <CollapsiblePanel title="文档产物 / 文档修订" :badge="artifactBadge" :summary="artifactSummary">
        <ArtifactPanel ref="artifactRef" :stage="workspace.currentStage" :project-key="String(route.params.projectId || '')" />
      </CollapsiblePanel>

      <!-- 编码过程（mock）：虚拟 IDE，逐行生成代码 + 单文件 diff。 -->
      <CollapsiblePanel v-if="mock.ideVisible.value" title="编码过程" badge="虚拟 IDE" :badge-on="true" summary="ExtractionService 六要素抽取实现" :default-open="true">
        <VirtualIdePanel :file="mock.ideFile.value" :lines="mock.ideLines.value" :typing="mock.ideTyping.value" :diff="mock.ideDiff.value" :diff-visible="mock.ideDiffVisible.value" />
      </CollapsiblePanel>

      <!-- 测试执行（mock）：用例逐条通过进度。 -->
      <CollapsiblePanel v-if="mock.testVisible.value" title="测试执行" :badge="`${mock.testPassedCount.value}/${mock.testCases.value.length} 通过`" :badge-on="true" summary="逐条执行测试用例" :default-open="true">
        <TestProgressPanel :cases="mock.testCases.value" />
      </CollapsiblePanel>

      <!-- Agent 执行轨迹：默认折叠，需要时展开。 -->
      <CollapsiblePanel title="Agent 执行轨迹" :badge="timelineLive ? '实时' : ''" :badge-on="timelineLive" :summary="timelineSummary">
        <ExecutionTimeline ref="timelineRef" :events="runtime.events" />
      </CollapsiblePanel>

      <AcceptancePanel v-if="waitingAcceptance" ref="acceptanceRef" :accepting="accepting" :stage-name="selectedStage?.displayName || selectedStage?.name" :stage-key="selectedStage?.key" @decide="acceptance" />

      <StatsBar
        :completed="workspace.completedStageCount"
        :total="workspace.stages.length"
        :active-agents="workspace.activeAgentCount"
        :pending-issues="workspace.pendingIssues"
        :last-event-at="lastEventAt"
      />
    </template>
  </main>
</template>

<style scoped>
.workbench { display: grid; gap: 14px; max-width: 1440px; margin: 0 auto; padding: 16px 18px 24px; background: var(--bg-1); min-height: 100vh; box-sizing: border-box; }
.panel { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); }
.empty-state { display: grid; justify-items: center; gap: 12px; padding: 48px 40px; max-width: 560px; margin: 40px auto; }
.empty-state h2 { margin: 0; color: var(--text-1); font-size: 20px; }
.empty-state .muted { margin: 0; }
.empty-state textarea { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 12px; font-size: 13px; color: var(--text-1); background: var(--bg-2); border: 1px solid var(--border-2); border-radius: var(--radius-sm); resize: vertical; }
.empty-state textarea::placeholder { color: var(--text-4); }
.empty-state .primary { padding: 11px 22px; font-size: 14px; font-weight: 600; color: #fff; background: var(--accent-600); border: none; border-radius: var(--radius-sm); cursor: pointer; }
.empty-state .primary:hover:not(:disabled) { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.empty-state .primary:disabled { opacity: 0.45; cursor: not-allowed; }
.muted { color: var(--text-3); }
.error-banner { margin: 0; padding: 10px 14px; border: 1px solid rgb(248 113 113 / 40%); border-radius: var(--radius-sm); background: var(--error-soft); color: var(--error); font-size: 13px; }
.readonly-banner { margin: 0; padding: 10px 14px; border: 1px solid rgb(96 165 250 / 40%); border-radius: var(--radius-sm); background: var(--info-soft); color: var(--info); font-size: 13px; }
/* 当前阶段 ‖ 人员介入 并排：阶段卡更宽，介入栏固定。 */
.stage-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; align-items: stretch; }
.stage-row > * { min-width: 0; }
.readonly-side { padding: 14px 16px; display: grid; align-content: start; gap: 8px; }
.readonly-side h3 { margin: 0; font-size: 13px; letter-spacing: 0.06em; color: var(--text-2); font-weight: 600; }
.readonly-side .muted { margin: 0; font-size: 12px; }
.parallel-switcher { display: grid; gap: 10px; padding: 12px 14px; }
.parallel-switcher__heading { display: flex; align-items: baseline; gap: 10px; font-size: 13px; }
.parallel-switcher__heading .muted { font-size: 11px; }
.parallel-switcher__tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.parallel-switcher__tabs button { position: relative; display: grid; gap: 3px; min-width: 150px; padding: 9px 14px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-2); text-align: left; cursor: pointer; }
.parallel-switcher__tabs button.active { border-color: var(--accent-500); background: var(--accent-softer); color: var(--text-1); box-shadow: inset 3px 0 var(--accent-500); }
.parallel-switcher__tabs button small { color: var(--text-3); font-size: 10px; }
.attention-dot { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 0 3px var(--warning-soft); }
@media (max-width: 1100px) { .stage-row { grid-template-columns: 1fr; } }
</style>
