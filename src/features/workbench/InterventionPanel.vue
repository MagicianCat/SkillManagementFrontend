<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InterventionTarget, InterventionType, WorkflowHumanQuestion } from '../../types/workflow'

const props = defineProps<{ running: boolean; readonly?: boolean; target?: InterventionTarget; retryable?: boolean; disabled?: boolean; questions?: WorkflowHumanQuestion[] }>()
const emit = defineEmits<{ submit: [type: InterventionType, content: string, target: InterventionTarget]; action: [type: InterventionType, target: InterventionTarget]; answer: [questionId: string | number, answer: string] }>()

const content = ref('')
const mode = ref<InterventionType>('ASK')
const input = ref<HTMLInputElement | null>(null)
const answer = ref('')
const pending = computed(() => [...(props.questions ?? [])].reverse().find(item => item.status === 'PENDING' || item.status === 'ANSWER_SUBMITTED'))

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
function submitAnswer() { const value=answer.value.trim(); if(!pending.value||!value||pending.value.status==='ANSWER_SUBMITTED')return; emit('answer',pending.value.id,value); answer.value='' }
function statusText(status: WorkflowHumanQuestion['status']) {
  return { PENDING: '等待你的回答', ANSWER_SUBMITTED: '正在恢复 Agent', ANSWERED: '已回答', CANCELLED: '已取消' }[status]
}
</script>

<template>
  <section class="intervention panel" aria-label="人员介入">
    <header class="panel-head">
      <h3>人员介入</h3>
      <span class="state" :class="{ on: !readonly && (running || Boolean(pending)) }">{{ readonly ? '已完成 · 仅查看' : pending ? '等待人员回答' : running ? '运行中' : '已暂停' }}</span>
    </header>

    <div class="thread" data-testid="intervention-thread">
      <article v-for="question in questions || []" :key="String(question.id)" class="question-card" :class="{ pending: question.status === 'PENDING' || question.status === 'ANSWER_SUBMITTED' }" data-testid="human-question">
        <small>{{ question.agentNodeKey }} · {{ statusText(question.status) }}</small>
        <strong>{{ question.question }}</strong>
        <p v-if="question.answer">你的回答：{{ question.answer }}</p>
        <p v-if="question.lastError" class="answer-error">恢复失败：{{ question.lastError }}，请重新提交回答。</p>
      </article>
      <p v-if="!(questions || []).length" class="empty muted">暂无 Agent 提问；可直接下发指令干预 Agent。</p>
    </div>

    <div v-if="pending && !readonly" class="answer-card" data-testid="human-answer-card">
      <div v-if="pending.choices?.length" class="choices"><button v-for="choice in pending.choices" :key="choice" type="button" :disabled="pending.status==='ANSWER_SUBMITTED'" @click="answer=choice">{{ choice }}</button></div>
      <div class="composer"><input v-model="answer" :disabled="pending.status==='ANSWER_SUBMITTED'" placeholder="输入对 Agent 问题的回答…" data-testid="human-answer-input" @keydown.enter.prevent="submitAnswer" /><button type="button" class="send" :disabled="pending.status==='ANSWER_SUBMITTED'||!answer.trim()" data-testid="submit-human-answer" @click="submitAnswer">{{ pending.status==='ANSWER_SUBMITTED' ? '正在恢复…' : '提交回答' }}</button></div>
    </div>

    <div v-if="!readonly" class="ops">
      <button type="button" :disabled="disabled || Boolean(pending)" @click="pick('ASK')">询问</button>
      <button type="button" :disabled="disabled || Boolean(pending)" @click="pick('CORRECT')">纠正</button>
      <button type="button" :disabled="disabled || Boolean(pending)" @click="pick('PROVIDE_INFO')">补充信息</button>
      <span class="sep" />
      <button v-if="running" type="button" :disabled="disabled" @click="action('PAUSE')">暂停</button>
      <button v-else type="button" :disabled="disabled" @click="action('RESUME')">继续</button>
      <button type="button" :disabled="disabled || !retryable" title="仅可重试当前阶段失败的 Agent" @click="action('RETRY')">重试</button>
      <button type="button" class="danger" :disabled="disabled" @click="action('CANCEL')">取消</button>
    </div>

    <div v-if="!readonly" class="composer">
      <select v-model="mode" :disabled="disabled || Boolean(pending)" aria-label="介入类型">
        <option value="ASK">询问</option>
        <option value="CORRECT">纠正</option>
        <option value="PROVIDE_INFO">补充信息</option>
      </select>
      <input ref="input" v-model="content" :disabled="disabled || Boolean(pending)" placeholder="输入指令，Enter 发送…" @keydown.enter.prevent="submit" />
      <button type="button" class="send" :disabled="disabled || Boolean(pending) || !content.trim()" @click="submit">发送</button>
    </div>
  </section>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); min-height: 0; }
.intervention { align-self: start; height: min(70vh, 680px); max-height: calc(100vh - 32px); box-sizing: border-box; overflow: hidden; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.panel-head h3 { font-size: 13px; letter-spacing: 0.06em; color: var(--text-2); font-weight: 600; }
.state { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid var(--border-2); color: var(--text-4); }
.state.on { color: var(--warning); border-color: rgb(251 191 36 / 40%); background: var(--warning-soft); }
.thread { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 6px 0; }
.question-card{display:grid;gap:5px;padding:10px;margin-bottom:8px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:var(--surface-2)}.question-card.pending{border-color:var(--border-accent)}.question-card small{color:var(--accent-300)}.question-card strong{font-size:13px;line-height:1.5}.question-card p{margin:0;color:var(--text-2);font-size:12px}.answer-card{display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--border-1)}.choices{display:flex;flex-wrap:wrap;gap:6px}
.question-card .answer-error { color: var(--error); }
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
