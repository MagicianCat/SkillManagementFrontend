<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { activateWorkflowRun } from '../api/workflow.api'
import { getCodeGraphStatus, retryCodeGraphPreparation } from '../api/code-graph.api'
import type { CodeGraphStatus } from '../types/code-graph'
import CodeGraphBrowser from '../features/code-graph/CodeGraphBrowser.vue'

const route = useRoute()
const router = useRouter()
const projectKey = computed(() => String(route.params.projectKey ?? ''))
const runId = computed(() => String(route.query.runId ?? ''))
const status = ref<CodeGraphStatus | null>(null)
const loading = ref(true)
const retrying = ref(false)
const activating = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | undefined

const state = computed(() => String(status.value?.status ?? ''))
const progress = computed(() => Math.max(0, Math.min(100, Number(status.value?.progress ?? status.value?.job?.progress ?? 0))))
const preparing = computed(() => ['CREATED', 'PREPARING_CODE_GRAPH'].includes(state.value))
const ready = computed(() => state.value === 'READY_TO_START')
const failed = computed(() => state.value === 'CODE_GRAPH_PREPARATION_FAILED' || state.value === 'FAILED' || status.value?.job?.status === 'FAILED')
const browseable = computed(() => ['READY_TO_START', 'RUNNING', 'COMPLETED'].includes(state.value) && Boolean(status.value?.binding))
const stateLabel = computed(() => ({
  CREATED: '已创建',
  PREPARING_CODE_GRAPH: '正在准备代码图谱',
  CODE_GRAPH_PREPARATION_FAILED: '代码图谱准备失败',
  READY_TO_START: '代码图谱已就绪',
  RUNNING: '工作流运行中',
}[state.value] ?? state.value ?? '等待状态'))

async function load() {
  if (!runId.value) { error.value = '缺少 workflow runId'; loading.value = false; return }
  try {
    status.value = await getCodeGraphStatus(runId.value)
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '代码图谱状态加载失败'
  } finally { loading.value = false }
}

async function retry() {
  if (retrying.value) return
  retrying.value = true
  try {
    status.value = await retryCodeGraphPreparation(runId.value)
    MessagePlugin.success('已重新提交代码图谱准备任务')
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '重试失败') }
  finally { retrying.value = false }
}

async function activate() {
  if (activating.value) return
  activating.value = true
  try {
    await activateWorkflowRun(runId.value)
    await router.push({ name: 'project-workspace', params: { projectId: projectKey.value, runId: runId.value } })
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '工作流启动失败') }
  finally { activating.value = false }
}

onMounted(async () => {
  await load()
  pollTimer = setInterval(() => { if (preparing.value) void load() }, 2000)
})
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
  <main class="code-graph-page" data-testid="code-graph-page">
    <header class="hero">
      <div>
        <p class="eyebrow">WORKFLOW / CODE GRAPH</p>
        <h1>代码图谱准备</h1>
        <p class="muted">Workflow Run {{ runId }} · 项目 {{ projectKey }}</p>
      </div>
      <button class="back" type="button" @click="router.push({ name: 'project-agent-setup', params: { projectKey } })">返回 Agent 配置</button>
    </header>

    <section class="panel" aria-live="polite">
      <div v-if="loading" class="empty">正在加载图谱准备状态…</div>
      <div v-else-if="error" class="error-block"><strong>无法读取图谱状态</strong><p>{{ error }}</p><button type="button" @click="load">重新加载</button></div>
      <template v-else>
        <div class="status-head">
          <div><span class="status-dot" :class="{ ready, failed }" /><strong>{{ stateLabel }}</strong></div>
          <span class="status-code">{{ state }}</span>
        </div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${progress}%` }" /></div>
        <div class="progress-meta"><span>{{ progress }}%</span><span v-if="status?.repositoryCount != null">已冻结 {{ status.repositoryCount }} 个代码仓库</span></div>
        <div v-if="preparing" class="hint">系统正在冻结仓库 Commit 并生成代码图谱，完成后即可正式启动工作流。本页面会自动刷新。</div>
        <div v-if="failed" class="error-block"><strong>{{ status?.errorCode || status?.job?.errorCode || 'CODE_GRAPH_PREPARATION_FAILED' }}</strong><p>{{ status?.errorMessage || status?.job?.errorMessage || '代码图谱准备失败，请重试。' }}</p></div>
        <div v-if="ready" class="ready-block"><strong>代码图谱已准备完成</strong><p>图谱将作为所有 Agent 阶段的系统级代码上下文。</p></div>
        <div v-if="status?.repositories?.length" class="repo-list" aria-label="代码仓库图谱进度">
          <div v-for="repo in status.repositories" :key="repo.name" class="repo-row">
            <div><strong>{{ repo.name }}</strong><small>{{ repo.reuseDecision === 'REUSE_EXACT' ? '复用已有图谱' : '构建完整图谱' }}</small></div>
            <span :class="`repo-state state-${String(repo.status).toLowerCase()}`">{{ repo.status }}</span>
          </div>
        </div>
        <div class="actions">
          <button v-if="failed" type="button" class="secondary" :disabled="retrying" @click="retry">{{ retrying ? '重试中…' : '重试代码图谱' }}</button>
          <button v-if="ready" type="button" class="primary" :disabled="activating" @click="activate">{{ activating ? '启动中…' : '正式开始工作流' }}</button>
        </div>
      </template>
    </section>
    <CodeGraphBrowser v-if="browseable" :run-id="runId" :readonly="true" />
  </main>
</template>

<style scoped>
.code-graph-page{max-width:1100px;margin:0 auto;padding:26px 20px 70px;color:var(--text-1)}
.hero{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;gap:18px}.eyebrow{margin:0 0 8px;font:600 12px var(--font-mono);letter-spacing:.14em;color:var(--text-3)}h1{margin:0 0 8px;font-size:30px}.muted,.hint{color:var(--text-3)}.back,.secondary,.primary,.error-block button{border:1px solid var(--line-2);border-radius:8px;background:var(--surface-2);padding:10px 16px;color:var(--text-1);cursor:pointer}.panel{background:var(--surface-1);border:1px solid var(--line-1);border-radius:14px;padding:30px;box-shadow:0 8px 30px rgba(22,45,80,.06)}.empty{text-align:center;padding:80px 0;color:var(--text-3)}.status-head{display:flex;justify-content:space-between;align-items:center;font-size:18px}.status-head>div{display:flex;align-items:center;gap:10px}.status-code{font:12px var(--font-mono);color:var(--text-3)}.status-dot{width:10px;height:10px;border-radius:50%;background:#f3aa36;box-shadow:0 0 0 5px rgba(243,170,54,.14)}.status-dot.ready{background:#25a873;box-shadow:0 0 0 5px rgba(37,168,115,.14)}.status-dot.failed{background:#e34d59;box-shadow:0 0 0 5px rgba(227,77,89,.14)}.progress-track{height:12px;border-radius:8px;background:var(--surface-3);margin-top:28px;overflow:hidden}.progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4678ee,#35b995);transition:width .3s}.progress-meta{display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--text-3)}.hint{margin:24px 0 0;line-height:1.7}.error-block{margin-top:22px;padding:15px 18px;border-radius:9px;background:rgba(227,77,89,.08);color:#b73845}.error-block p{margin:8px 0;line-height:1.6}.ready-block{margin-top:22px;padding:15px 18px;border-radius:9px;background:rgba(37,168,115,.1);color:#197653}.ready-block p{margin:8px 0 0}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:28px}.primary{background:#315edb;border-color:#315edb;color:white}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:640px){.hero{align-items:flex-start;flex-direction:column}.back{width:100%}.panel{padding:20px}.status-head{align-items:flex-start;flex-direction:column;gap:8px}}
.repo-list{display:grid;gap:9px;margin-top:22px}.repo-row{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border:1px solid var(--line-1);border-radius:9px;background:var(--surface-2)}.repo-row>div{display:grid;gap:4px}.repo-row small{color:var(--text-3)}.repo-state{font:12px var(--font-mono);color:var(--text-3)}.state-ready,.state-reused{color:#197653}.state-failed{color:#b73845}
</style>
