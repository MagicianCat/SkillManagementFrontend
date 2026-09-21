<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ accepting: boolean; stageName?: string; stageKey?: string }>()
const emit = defineEmits<{ decide: [decision: 'ACCEPT' | 'REWORK', comment: string] }>()
const comment = ref('')
</script>

<template>
  <section class="acceptance panel" data-testid="final-acceptance">
    <header class="panel-head">
      <h3>{{ stageName || '阶段' }}验收</h3>
      <span class="tag">人工门槛</span>
    </header>
    <p class="muted">真实项目成员审批当前阶段产物后，满足依赖的后续阶段才会继续执行。</p>
    <textarea v-model="comment" rows="3" placeholder="审批备注（可选）" data-testid="acceptance-comment" />
    <div class="row">
      <button type="button" class="primary" :disabled="accepting" @click="emit('decide', 'ACCEPT', comment)">通过{{ stageName || stageKey || '当前阶段' }}</button>
      <button type="button" class="danger" :disabled="accepting" @click="emit('decide', 'REWORK', comment)">退回{{ stageName || stageKey || '当前阶段' }}</button>
    </div>
  </section>
</template>

<style scoped>
.panel { padding: 16px 18px; border: 1px solid rgb(167 139 250 / 35%); border-radius: var(--radius-md); background: var(--purple-soft); box-shadow: var(--inner-highlight); }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.panel-head h3 { font-size: 14px; color: var(--text-1); font-weight: 600; }
.tag { font-size: 10px; padding: 2px 9px; border-radius: var(--radius-full); color: var(--purple); border: 1px solid rgb(167 139 250 / 45%); }
.muted { color: var(--text-2); font-size: 12px; margin: 0 0 10px; }
textarea { box-sizing: border-box; width: 100%; margin: 0 0 10px; padding: 10px; font-size: 13px; color: var(--text-1); background: var(--bg-2); border: 1px solid var(--border-2); border-radius: var(--radius-sm); resize: vertical; }
textarea::placeholder { color: var(--text-4); }
.row { display: flex; gap: 8px; }
button { padding: 9px 16px; font-size: 13px; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; }
.primary { color: #fff; background: var(--accent-600); }
.primary:hover:not(:disabled) { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.danger { color: #fff; background: #b94e55; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
