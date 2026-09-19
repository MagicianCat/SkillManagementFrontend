<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { designAcceptWorkflowRun, getCurrentWorkflowRun, sendIntervention, startWorkflowRun } from '../api/workflow.api'
import WorkbenchHeader from '../features/workbench/WorkbenchHeader.vue'
import WorkflowDagPanel from '../features/workbench/WorkflowDagPanel.vue'
import CurrentStagePanel from '../features/workbench/CurrentStagePanel.vue'
import ExecutionTimeline from '../features/workbench/ExecutionTimeline.vue'
import ArtifactPanel from '../features/workbench/ArtifactPanel.vue'
import InterventionPanel from '../features/workbench/InterventionPanel.vue'
import AcceptancePanel from '../features/workbench/AcceptancePanel.vue'
import StatsBar from '../features/workbench/StatsBar.vue'
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
const acceptanceRef = ref<InstanceType<typeof AcceptancePanel> | null>(null)

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
    if (workspace.workflowRun) runtime.connect(String(workspace.workflowRun.id))
  } finally { starting.value = false }
}

const waitingAcceptance = computed(() => workspace.workflowRun?.status === 'WAITING_DESIGN_ACCEPTANCE')
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
  if (workspace.workflowRun) runtime.connect(String(workspace.workflowRun.id))
})
watch(() => runtime.events.length, () => { const event = runtime.events.at(-1); if (event) workspace.applyEvent(event) })
onBeforeUnmount(() => runtime.close())

const lastEventAt = computed(() => runtime.events.at(-1)?.createdAt ?? '')

/** 干预目标自动取当前阶段与其当前 Agent，无需手填。 */
const interventionTarget = computed<InterventionTarget>(() => {
  const stage = workspace.currentStage
  const agent = stage?.agents?.find((a) => a.name === stage.currentAgent) ?? stage?.agents?.find((a) => a.agentRunId != null)
  return { stageRunId: stage?.id ? String(stage.id) : undefined, agentRunId: agent?.agentRunId != null ? String(agent.agentRunId) : undefined }
})

async function intervention(type: InterventionType, content?: string, target?: InterventionTarget) {
  await sendIntervention(String(workspace.workflowRun?.id || runId.value), type, content, target)
  await workspace.load(String(workspace.workflowRun?.id || runId.value))
}
async function acceptance(decision: 'ACCEPT' | 'REWORK', comment: string) {
  if (!workspace.workflowRun || accepting.value) return
  accepting.value = true
  try { await designAcceptWorkflowRun(String(workspace.workflowRun.id), decision, 'REQUIREMENT', comment); await workspace.load(String(workspace.workflowRun.id)) } finally { accepting.value = false }
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

      <div class="flow-row">
        <WorkflowDagPanel :stages="workspace.stages" :selected-id="workspace.selectedStageId" :current-id="workspace.currentStage?.id ?? null" @select="workspace.select" />
        <CurrentStagePanel :stage="workspace.currentStage" :review-cycle="workspace.reviewCycle" :latest-revision="workspace.latestRevision?.revision ?? null" />
      </div>

      <div class="columns" :class="{ readonly: runReadonly }">
        <ExecutionTimeline :events="runtime.events" />
        <ArtifactPanel :stage="workspace.currentStage" :project-key="String(route.params.projectId || '')" />
        <InterventionPanel v-if="!runReadonly" :running="workspace.running" :target="interventionTarget" @submit="intervention" @action="(type, target) => intervention(type, undefined, target)" />
      </div>

      <AcceptancePanel v-if="waitingAcceptance" ref="acceptanceRef" :accepting="accepting" @decide="acceptance" />

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
.flow-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; align-items: stretch; }
.flow-row > * { min-width: 0; }
@media (max-width: 1100px) { .flow-row { grid-template-columns: 1fr; } }
.columns { display: grid; grid-template-columns: 300px 1fr 340px; gap: 14px; align-items: stretch; }
.columns.readonly { grid-template-columns: 300px 1fr; }
.columns > * { min-height: 320px; max-height: 460px; }
@media (max-width: 1100px) { .columns, .columns.readonly { grid-template-columns: 1fr 1fr; } .columns > *:last-child { grid-column: 1 / -1; } }
@media (max-width: 720px) { .columns { grid-template-columns: 1fr; } .columns > * { max-height: none; } }
</style>
