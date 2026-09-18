<script setup lang="ts">
import type { WorkflowEdge, WorkflowStage } from '../../types/workflow'
const props = defineProps<{ stages: WorkflowStage[]; edges?: WorkflowEdge[]; selectedId?: string | null }>()
const emit = defineEmits<{ select: [stage: WorkflowStage] }>()
const statusText: Record<string, string> = { COMPLETED: '已完成', RUNNING: '运行中', READY: '就绪', PENDING: '等待中', HUMAN_REQUIRED: '需人工', FAILED: '失败', STALE: '已失效', PAUSED: '已暂停' }
function select(stage: WorkflowStage) { emit('select', stage) }
</script>
<template>
  <section class="workflow-graph" aria-label="工作流阶段图">
    <div v-if="!props.stages.length" class="workflow-empty">暂无 Workflow 阶段数据</div>
    <template v-else>
      <div class="workflow-graph__nodes">
        <button v-for="stage in props.stages" :key="stage.id" type="button" class="workflow-stage" :class="[`workflow-stage--${stage.status.toLowerCase()}`, { 'workflow-stage--selected': stage.id === props.selectedId } ]" @click="select(stage)">
          <span class="workflow-stage__status">{{ statusText[stage.status] || stage.status }}</span>
          <strong>{{ stage.name }}</strong>
          <small>{{ stage.currentAgent || '未分配 Agent' }}</small>
          <span v-if="stage.loopCount != null" class="workflow-stage__loop">Loop {{ stage.loopCount }}{{ stage.maxLoopCount ? ` / ${stage.maxLoopCount}` : '' }}</span>
          <span v-if="stage.attention" class="workflow-stage__attention">需要关注</span>
        </button>
      </div>
      <div v-if="props.edges?.length" class="workflow-graph__edges" aria-label="阶段依赖">
        <span v-for="edge in props.edges" :key="edge.id">{{ edge.from }} → {{ edge.to }}</span>
      </div>
    </template>
  </section>
</template>
<style scoped>
.workflow-graph { padding: 20px; border: 1px solid var(--border-1); border-radius: 16px; background: var(--surface-1); }
.workflow-graph__nodes { display: flex; flex-wrap: wrap; gap: 14px; }
.workflow-stage { display: grid; gap: 7px; min-width: 170px; padding: 15px; color: var(--text-1); text-align: left; border: 1px solid var(--border-1); border-left: 4px solid var(--text-3); border-radius: 12px; background: var(--surface-2); cursor: pointer; }
.workflow-stage--completed { border-left-color: #24a66a; }.workflow-stage--running { border-left-color: #e7a52c; animation: pulse 2s infinite; }.workflow-stage--ready { border-left-color: #478bd1; }.workflow-stage--human_required { border-left-color: #ec8d3f; }.workflow-stage--failed { border-left-color: #d9535f; }.workflow-stage--stale { border-left-color: #8a61c7; }.workflow-stage--selected { outline: 2px solid var(--accent-500); }
.workflow-stage__status { font-size: 11px; color: var(--text-2); }.workflow-stage small, .workflow-stage__loop { color: var(--text-2); font-size: 12px; }.workflow-stage__attention { color: #d9792b; font-size: 11px; }.workflow-graph__edges { display:flex; flex-wrap:wrap; gap:8px; margin-top:15px; color:var(--text-2); font-size:12px; }.workflow-empty { color:var(--text-2); }
@keyframes pulse { 50% { box-shadow: 0 0 0 4px rgb(231 165 44 / 15%); } }
</style>
