<script setup lang="ts">
import { ref } from 'vue'
import type { InterventionTarget, InterventionType } from '../../types/workflow'
const props = defineProps<{ running: boolean; canAsk?: boolean; canCorrect?: boolean; disabled?: boolean; target?: InterventionTarget }>()
const emit = defineEmits<{ submit: [type: InterventionType, content: string, target: InterventionTarget]; action: [type: InterventionType, target: InterventionTarget] }>()
const content = ref(''); const mode = ref<InterventionType>('ASK'); const stageRunId = ref(props.target?.stageRunId || ''); const agentSessionId = ref(props.target?.agentSessionId || ''); const agentRunId = ref(props.target?.agentRunId || '')
const targets = (): InterventionTarget => ({ stageRunId: stageRunId.value || undefined, agentSessionId: agentSessionId.value || undefined, agentRunId: agentRunId.value || undefined })
function submit() { const value = content.value.trim(); if (!value) return; emit('submit', mode.value, value, targets()); content.value = '' }
</script>
<template>
  <section class="intervention-chat" aria-label="Agent 干预对话">
    <header><strong>Agent 对话与干预</strong><span v-if="props.running">运行中仍可发送消息</span></header>
    <textarea v-model="content" :disabled="props.disabled" rows="3" placeholder="询问进展，或输入纠正意见…" @keydown.ctrl.enter="submit" />
    <footer>
      <select v-model="mode" :disabled="props.disabled"><option v-if="props.canAsk !== false" value="ASK">询问 Agent</option><option v-if="props.canCorrect !== false" value="CORRECT">发送纠正</option><option value="PROVIDE_INFO">补充信息</option></select>
      <button type="button" :disabled="props.disabled || !content.trim()" @click="submit">发送</button>
      <input v-model="stageRunId" data-testid="intervention-stage-run-id" placeholder="Stage Run ID" />
      <input v-model="agentSessionId" placeholder="Agent Session ID" />
      <input v-model="agentRunId" placeholder="Agent Run ID" />
      <button v-if="props.running" type="button" class="secondary" @click="emit('action', 'PAUSE', targets())">暂停</button>
      <button v-else type="button" class="secondary" @click="emit('action', 'RESUME', targets())">继续</button>
      <button type="button" class="secondary" @click="emit('action', 'RETRY', targets())">重试</button><button type="button" class="danger" @click="emit('action', 'CANCEL', targets())">取消</button>
    </footer>
  </section>
</template>
<style scoped>
.intervention-chat { padding:18px; border:1px solid var(--border-1); border-radius:16px; background:var(--surface-1); }.intervention-chat header { display:flex; justify-content:space-between; margin-bottom:12px; }.intervention-chat header span { color:var(--text-2); font-size:12px; }.intervention-chat textarea { box-sizing:border-box; width:100%; resize:vertical; padding:10px; color:var(--text-1); border:1px solid var(--border-1); border-radius:8px; background:var(--surface-2); }.intervention-chat footer { display:flex; gap:8px; align-items:center; margin-top:10px; }.intervention-chat select,.intervention-chat button { padding:8px 12px; border:1px solid var(--border-1); border-radius:8px; }.intervention-chat button { color:#fff; background:var(--accent-600); cursor:pointer; }.intervention-chat .secondary { color:var(--text-1); background:var(--surface-2); }.intervention-chat .danger { background:#b94e55; }
</style>
