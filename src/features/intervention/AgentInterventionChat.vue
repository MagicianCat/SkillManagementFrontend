<script setup lang="ts">
import { ref } from 'vue'
import type { InterventionType } from '../../types/workflow'
const props = defineProps<{ running: boolean; canAsk?: boolean; canCorrect?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ submit: [type: InterventionType, content: string]; action: [type: InterventionType] }>()
const content = ref(''); const mode = ref<InterventionType>('ASK')
function submit() { const value = content.value.trim(); if (!value) return; emit('submit', mode.value, value); content.value = '' }
</script>
<template>
  <section class="intervention-chat" aria-label="Agent 干预对话">
    <header><strong>Agent 对话与干预</strong><span v-if="props.running">运行中仍可发送消息</span></header>
    <textarea v-model="content" :disabled="props.disabled" rows="3" placeholder="询问进展，或输入纠正意见…" @keydown.ctrl.enter="submit" />
    <footer>
      <select v-model="mode" :disabled="props.disabled"><option v-if="props.canAsk !== false" value="ASK">询问 Agent</option><option v-if="props.canCorrect !== false" value="CORRECT">发送纠正</option></select>
      <button type="button" :disabled="props.disabled || !content.trim()" @click="submit">发送</button>
      <button v-if="props.running" type="button" class="secondary" @click="emit('action', 'PAUSE')">暂停</button>
      <button v-else type="button" class="secondary" @click="emit('action', 'RESUME')">继续</button>
      <button type="button" class="danger" @click="emit('action', 'CANCEL')">取消</button>
    </footer>
  </section>
</template>
<style scoped>
.intervention-chat { padding:18px; border:1px solid var(--border-1); border-radius:16px; background:var(--surface-1); }.intervention-chat header { display:flex; justify-content:space-between; margin-bottom:12px; }.intervention-chat header span { color:var(--text-2); font-size:12px; }.intervention-chat textarea { box-sizing:border-box; width:100%; resize:vertical; padding:10px; color:var(--text-1); border:1px solid var(--border-1); border-radius:8px; background:var(--surface-2); }.intervention-chat footer { display:flex; gap:8px; align-items:center; margin-top:10px; }.intervention-chat select,.intervention-chat button { padding:8px 12px; border:1px solid var(--border-1); border-radius:8px; }.intervention-chat button { color:#fff; background:var(--accent-600); cursor:pointer; }.intervention-chat .secondary { color:var(--text-1); background:var(--surface-2); }.intervention-chat .danger { background:#b94e55; }
</style>
