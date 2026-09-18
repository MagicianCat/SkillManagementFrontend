import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getWorkflowRun, getWorkflowStages } from '../api/workflow.api'
import type { WorkflowRun, WorkflowStage } from '../types/workflow'

export const useProjectWorkspaceStore = defineStore('projectWorkspace', () => {
  const workflowRun = ref<WorkflowRun | null>(null); const stagesById = ref<Record<string, WorkflowStage>>({}); const selectedStageId = ref<string | null>(null); const loading = ref(false); const error = ref('')
  const stages = computed(() => Object.values(stagesById.value))
  async function load(runId: string) { loading.value = true; error.value = ''; try { workflowRun.value = await getWorkflowRun(runId); const data = workflowRun.value.stages ?? await getWorkflowStages(runId); stagesById.value = Object.fromEntries(data.map((stage) => [stage.id, stage])); selectedStageId.value ||= data[0]?.id ?? null } catch (cause) { error.value = cause instanceof Error ? cause.message : '工作台加载失败' } finally { loading.value = false } }
  function applyEvent(event: { type: string; data: Record<string, unknown> }) { const stageId = String(event.data.stageId ?? ''); if (!stageId || !stagesById.value[stageId]) return; stagesById.value[stageId] = { ...stagesById.value[stageId], ...(event.data as Partial<WorkflowStage>) } }
  return { workflowRun, stagesById, stages, selectedStageId, loading, error, load, applyEvent }
})
