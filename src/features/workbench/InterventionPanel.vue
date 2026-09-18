<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InterventionTarget, InterventionType } from '../../types/workflow'

const props = defineProps<{ running: boolean; target?: InterventionTarget; disabled?: boolean }>()
const emit = defineEmits<{ submit: [type: InterventionType, content: string, target: InterventionTarget]; action: [type: InterventionType, target: InterventionTarget] }>()

const content = ref('')
const mode = ref<InterventionType>('ASK')
const input = ref<HTMLInputElement | null>(null)

const target = computed<InterventionTarget>(() => ({
  stageRunId: props.target?.stageRunId || undefined,
  agentSessionId: props.target?.agentSessionId || undefined,
  agentRunId: props.target?.agentRunId || undefined,
}))

function submit() {
  const value = content.value.trim()
  if (!value) return
  emit('submit', mode.value, value, target.value)
  content.value = ''
}
function action(type: InterventionType) { emit('action', type, target.value) }
function pick(type: InterventionType) { mode.value = type; input.value?.focus() }
</script>

<template>
  <section class="intervention panel" aria-label="人员介入">
    <header class="panel-head">
      <h3>人员介入</h3>
      <span class="state" :class="{ on: running }">{{ running ? '运行中' : '已暂停' }}</span>
    </header>

    <div class="thread">
      <p class="empty muted">对话记录由执行轨迹驱动；可直接下发指令干预 Agent。</p>
    </div>

    <div class="ops">
      <button type="button" :disabled="disabled" @click="pick('ASK')">询问</button>
      <button type="button" :disabled="disabled" @click="pick('CORRECT')">纠正</button>
      <button type="button" :disabled="disabled" @click="pick('PROVIDE_INFO')">补充信息</button>
      <span class="sep" />
      <button v-if="running" type="button" :disabled="disabled" @click="action('PAUSE')">暂停</button>
      <button v-else type="button" :disabled="disabled" @click="action('RESUME')">继续</button>
      <button type="button" :disabled="disabled" @click="action('RETRY')">重试</button>
      <button type="button" class="danger" :disabled="disabled" @click="action('CANCEL')">取消</button>
    </div>

    <div class="composer">
      <select v-model="mode" :disabled="disabled" aria-label="介入类型">
        <option value="ASK">询问</option>
        <option value="CORRECT">纠正</option>
        <option value="PROVIDE_INFO">补充信息</option>
      </select>
      <input ref="input" v-model="content" :disabled="disabled" placeholder="输入指令，Enter 发送…" @keydown.enter.prevent="submit" />
      <button type="button" class="send" :disabled="disabled || !content.trim()" @click="submit">发送</button>
    </div>
  </section>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); min-height: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.panel-head h3 { font-size: 13px; letter-spacing: 0.06em; color: var(--text-2); font-weight: 600; }
.state { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid var(--border-2); color: var(--text-4); }
.state.on { color: var(--warning); border-color: rgb(251 191 36 / 40%); background: var(--warning-soft); }
.thread { flex: 1; overflow-y: auto; min-height: 60px; padding: 6px 0; }
.muted { color: var(--text-3); font-size: 12px; }
.ops { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 10px 0; border-top: 1px solid var(--border-1); }
.ops button { padding: 6px 11px; font-size: 12px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-1); cursor: pointer; }
.ops button:hover:not(:disabled) { border-color: var(--border-accent); color: var(--accent-300); }
.ops button:disabled { opacity: 0.45; cursor: not-allowed; }
.ops .danger { border-color: rgb(248 113 113 / 40%); color: var(--error); }
.sep { flex: 1; }
.composer { display: flex; gap: 6px; }
.composer select, .composer input { padding: 8px 10px; font-size: 13px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-1); }
.composer input { flex: 1; }
.composer input::placeholder { color: var(--text-4); }
.composer .send { padding: 8px 16px; font-size: 13px; border: none; border-radius: var(--radius-sm); background: var(--accent-600); color: #fff; cursor: pointer; }
.composer .send:hover:not(:disabled) { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.composer .send:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
