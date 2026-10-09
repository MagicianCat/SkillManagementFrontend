<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { activateWorkflowRun } from '../api/workflow.api'
import { getCodeGraphStatus, retryCodeGraphPreparation, retryCodeGraphUpdate } from '../api/code-graph.api'
import type { CodeGraphStatus } from '../types/code-graph'
import CodeGraphBrowser from '../features/code-graph/CodeGraphBrowser.vue'
import { useRuntimeEventStore } from '../stores/runtimeEvent'

const route = useRoute()
const router = useRouter()
const runtimeEvents = useRuntimeEventStore()
const projectKey = computed(() => String(route.params.projectKey ?? ''))
const runId = computed(() => String(route.query.runId ?? ''))
const status = ref<CodeGraphStatus | null>(null)
const loading = ref(true)
const retrying = ref(false)
const retryingUpdate = ref(false)
const activating = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setInterval> | undefined

const state = computed(() => String(status.value?.status ?? ''))
const progress = computed(() => Math.max(0, Math.min(100, Number(status.value?.progress ?? status.value?.job?.progress ?? 0))))
const preparing = computed(() => ['CREATED', 'PREPARING_CODE_GRAPH'].includes(state.value))
const ready = computed(() => state.value === 'READY_TO_START')
const failed = computed(() => state.value === 'CODE_GRAPH_PREPARATION_FAILED' || state.value === 'FAILED' || status.value?.job?.status === 'FAILED')
const browseable = computed(() => ['READY_TO_START', 'RUNNING', 'COMPLETED'].includes(state.value) && Boolean(status.value?.binding ?? status.value?.activeBinding))
const stateLabel = computed(() => ({
  CREATED: '已创建',
  PREPARING_CODE_GRAPH: '正在准备代码图谱',
  CODE_GRAPH_PREPARATION_FAILED: '代码图谱准备失败',
  READY_TO_START: '代码图谱已就绪',
  RUNNING: '工作流运行中',
}[state.value] ?? state.value ?? '等待状态'))

// M7: version evolution view state
const activeBinding = computed(() => status.value?.activeBinding ?? null)
const preparingBinding = computed(() => status.value?.preparingBinding ?? null)
const pendingUpdate = computed(() => status.value?.pendingUpdate ?? null)
const lastUpdateError = computed(() => status.value?.lastUpdateError ?? null)
const hasUpdateActivity = computed(() => Boolean(preparingBinding.value ?? pendingUpdate.value ?? lastUpdateError.value))
const isRunning = computed(() => state.value === 'RUNNING')

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

/** M7: retry a FAILED REPO_APPEND update; only that target version is rebuilt. */
async function retryUpdate() {
  if (retryingUpdate.value || !lastUpdateError.value) return
  retryingUpdate.value = true
  try {
    await retryCodeGraphUpdate(runId.value, lastUpdateError.value.updateRequestId)
    MessagePlugin.success('已重新提交更新任务，代码图谱正在后台重新构建')
    await load()
  } catch (cause) { MessagePlugin.error(cause instanceof Error ? cause.message : '重试失败') }
  finally { retryingUpdate.value = false }
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

// M7: live-refresh on code graph events routed through the shared runtime event stream.
watch(
  () => runtimeEvents.events.length,
  () => {
    const latest = runtimeEvents.events[runtimeEvents.events.length - 1]
    if (!latest) return
    if (typeof latest.type === 'string' && latest.type.startsWith('code_graph.')) {
      void load()
    }
  },
)

onMounted(async () => {
  await load()
  pollTimer = setInterval(() => { if (preparing.value || preparingBinding.value) void load() }, 2000)
  if (runId.value) runtimeEvents.connect(runId.value)
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

    <!-- M7: version evolution panel. Only meaningful once the workflow is RUNNING with an ACTIVE binding. -->
    <section v-if="isRunning && (activeBinding || hasUpdateActivity)" class="panel versions" aria-label="图谱版本演进">
      <header class="versions-head">
        <div>
          <p class="eyebrow">BINDING / VERSIONS</p>
          <h2>图谱版本</h2>
        </div>
        <p class="muted">当前 Agent 继续使用运行中固定版本；新版本就绪后自动切换，不影响进行中的会话。</p>
      </header>

      <div class="versions-grid">
        <article class="version-card" :class="{ 'is-active': activeBinding }">
          <div class="version-tag active">ACTIVE</div>
          <div class="version-no">v{{ activeBinding?.version ?? '—' }}</div>
          <div class="version-meta">
            <span>{{ activeBinding?.repositoryCount ?? '—' }} 个仓库</span>
            <span v-if="activeBinding?.activatedAt">激活于 {{ new Date(activeBinding.activatedAt).toLocaleString() }}</span>
          </div>
          <div v-if="activeBinding?.semanticIndexStatus" class="version-semantic">
            <span :class="`semantic semantic-${String(activeBinding.semanticIndexStatus).toLowerCase()}`">
              语义索引 {{ activeBinding.semanticIndexStatus }}
            </span>
          </div>
        </article>

        <div v-if="preparingBinding" class="version-arrow" aria-hidden="true">→</div>

        <article v-if="preparingBinding" class="version-card is-preparing">
          <div class="version-tag preparing">PREPARING</div>
          <div class="version-no">v{{ preparingBinding.version ?? '—' }}</div>
          <div class="version-meta">
            <span>{{ preparingBinding.repositoryCount ?? '—' }} 个仓库</span>
            <span v-if="status?.job?.progress != null">构建进度 {{ status.job.progress }}%</span>
          </div>
          <div class="version-progress" role="progressbar" :aria-valuenow="status?.job?.progress ?? 0" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${status?.job?.progress ?? 0}%` }" />
          </div>
        </article>
      </div>

      <div v-if="pendingUpdate" class="pending-row">
        <span class="pending-label">待合并更新</span>
        <span class="pending-info">
          目标版本包含 {{ pendingUpdate.targetRepositoryCount ?? '—' }} 个仓库，
          将在当前构建完成后开始
          <template v-if="pendingUpdate.retryCount">（已重试 {{ pendingUpdate.retryCount }} 次）</template>
        </span>
      </div>

      <div v-if="lastUpdateError" class="error-block update-error">
        <div class="update-error-head">
          <strong>上次更新失败</strong>
          <button type="button" class="secondary" :disabled="retryingUpdate" @click="retryUpdate">{{ retryingUpdate ? '重试中…' : '重试更新' }}</button>
        </div>
        <p v-if="lastUpdateError.errorCode" class="update-error-code">{{ lastUpdateError.errorCode }}</p>
        <p v-if="lastUpdateError.errorMessage">{{ lastUpdateError.errorMessage }}</p>
      </div>
    </section>

    <CodeGraphBrowser v-if="browseable" :run-id="runId" :readonly="true" />
  </main>
</template>

<style scoped>
.code-graph-page{max-width:1680px;margin:0 auto;padding:26px 20px 70px;color:var(--text-1)}
.hero{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:22px;gap:18px}.eyebrow{margin:0 0 8px;font:600 12px var(--font-mono);letter-spacing:.14em;color:var(--text-3)}h1{margin:0 0 8px;font-size:30px}.muted,.hint{color:var(--text-3)}.back,.secondary,.primary,.error-block button{border:1px solid var(--border-2);border-radius:8px;background:var(--surface-2);padding:10px 16px;color:var(--text-1);cursor:pointer;transition:border-color .15s,background .15s}.back:hover,.secondary:hover{background:var(--surface-3);border-color:var(--border-3)}.panel{background:var(--surface-1);border:1px solid var(--border-1);border-radius:14px;padding:30px;box-shadow:var(--shadow-md);margin-bottom:18px}.empty{text-align:center;padding:80px 0;color:var(--text-3)}.status-head{display:flex;justify-content:space-between;align-items:center;font-size:18px}.status-head>div{display:flex;align-items:center;gap:10px}.status-code{font:12px var(--font-mono);color:var(--text-3)}.status-dot{width:10px;height:10px;border-radius:50%;background:var(--warning);box-shadow:0 0 0 5px var(--warning-soft)}.status-dot.ready{background:var(--success);box-shadow:0 0 0 5px var(--success-soft)}.status-dot.failed{background:var(--error);box-shadow:0 0 0 5px var(--error-soft)}.progress-track{height:12px;border-radius:8px;background:var(--surface-3);margin-top:28px;overflow:hidden}.progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent-500),var(--success));transition:width .3s}.progress-meta{display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--text-3)}.hint{margin:24px 0 0;line-height:1.7}.error-block{margin-top:22px;padding:15px 18px;border-radius:9px;background:var(--error-soft);color:var(--error);border:1px solid var(--error)}.error-block p{margin:8px 0;line-height:1.6}.ready-block{margin-top:22px;padding:15px 18px;border-radius:9px;background:var(--success-soft);color:var(--success);border:1px solid var(--success)}.ready-block p{margin:8px 0 0}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:28px}.primary{background:var(--accent-500);border-color:var(--accent-500);color:var(--text-on-accent)}.primary:hover:not(:disabled){background:var(--accent-600);border-color:var(--accent-600)}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}
.repo-list{display:grid;gap:9px;margin-top:22px}.repo-row{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border:1px solid var(--border-1);border-radius:9px;background:var(--surface-2)}.repo-row>div{display:grid;gap:4px}.repo-row small{color:var(--text-3)}.repo-state{font:12px var(--font-mono);color:var(--text-3)}.state-ready,.state-reused{color:var(--success)}.state-failed{color:var(--error)}

/* M7: version evolution panel */
.versions{display:grid;gap:18px}
.versions-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px}
.versions-head h2{margin:0;font-size:20px}
.versions-head p{margin:0}
.versions-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:stretch}
.version-card{position:relative;display:grid;gap:8px;padding:18px;border:1px solid var(--border-1);border-radius:12px;background:var(--surface-2)}
.version-card.is-active{border-color:var(--success);background:var(--success-soft)}
.version-card.is-preparing{border-color:var(--accent-500);background:var(--accent-softer)}
.version-tag{font:600 10px var(--font-mono);letter-spacing:.14em;padding:4px 8px;border-radius:6px;justify-self:start}
.version-tag.active{background:var(--success);color:var(--bg-0)}
.version-tag.preparing{background:var(--accent-500);color:var(--text-on-accent)}
.version-no{font:700 36px var(--font-mono);line-height:1;color:var(--text-1);font-variant-numeric:tabular-nums}
.version-meta{display:grid;gap:4px;font-size:12px;color:var(--text-3)}
.version-semantic{margin-top:4px}
.semantic{font:11px var(--font-mono);padding:3px 8px;border-radius:6px}
.semantic-ready{background:var(--success-soft);color:var(--success)}
.semantic-indexing{background:var(--warning-soft);color:var(--warning)}
.semantic-degraded{background:var(--error-soft);color:var(--error)}
.semantic-disabled{background:var(--surface-3);color:var(--text-3)}
.version-arrow{align-self:center;font:24px var(--font-mono);color:var(--text-3)}
.version-progress{height:6px;border-radius:4px;background:var(--surface-3);overflow:hidden;margin-top:6px}
.version-progress span{display:block;height:100%;background:var(--accent-500);transition:width .4s;animation:version-pulse 2s ease-in-out infinite}
@keyframes version-pulse{0%,100%{opacity:1}50%{opacity:.7}}
.pending-row{display:flex;gap:12px;padding:12px 14px;border:1px dashed var(--border-2);border-radius:9px;background:var(--surface-1);font-size:13px;align-items:baseline}
.pending-label{font:600 11px var(--font-mono);letter-spacing:.12em;color:var(--text-3);flex-shrink:0}
.pending-info{color:var(--text-2)}
.update-error{display:grid;gap:6px;margin-top:0}
.update-error-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.update-error-head strong{color:var(--error)}
.update-error-code{font:11px var(--font-mono);color:var(--error);opacity:.85;margin:0}

@media(max-width:760px){
  .hero{align-items:flex-start;flex-direction:column}.back{width:100%}
  .panel{padding:20px}.status-head{align-items:flex-start;flex-direction:column;gap:8px}
  .versions-grid{grid-template-columns:1fr}.version-arrow{justify-self:center;transform:rotate(90deg)}
}
</style>
