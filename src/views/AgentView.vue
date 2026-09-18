<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentChat from '../features/agent/AgentChat.vue'
import { useAgentStore } from '../features/agent/store'
import { useAuthStore } from '../stores/auth'
import { DialogPlugin } from 'tdesign-vue-next'
import AgentBatchDownloadDialog from '../features/agent/AgentBatchDownloadDialog.vue'
import { getAgentRun } from '../features/agent/api'
import type { AgentRecommendation } from '../features/agent/types'

const store = useAgentStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const batchVisible = ref(false)
const batchRunKey = ref<string | null>(null)
const batchRecommendation = ref<AgentRecommendation | null>(null)

async function loadRequestedSession() {
  await store.refreshSessions()
  if (route.query.newSession === '1') {
    await store.newSession()
    if (store.current) await router.replace({ name: 'agent', query: { session: store.current.session.sessionKey } })
    return
  }
  const requested = typeof route.query.session === 'string' ? route.query.session : null
  if (requested) await store.selectSession(requested)
  else await store.ensureSession()
  const runKey = typeof route.query.runKey === 'string' ? route.query.runKey : null
  if (route.query.batchDownload === '1' && runKey) {
    const run = await getAgentRun(runKey)
    if (run.recommendation?.items.length) { batchRunKey.value = runKey; batchRecommendation.value = run.recommendation; batchVisible.value = true }
  }
}

async function select(key: string) {
  await store.selectSession(key)
  await router.replace({ name: 'agent', query: { session: key } })
}

async function create() {
  await store.newSession()
  if (store.current) await router.replace({ name: 'agent', query: { session: store.current.session.sessionKey } })
}

function remove(key: string) {
  const dialog = DialogPlugin.confirm({ header: '删除会话', body: '删除后会话将立即从列表中隐藏，180 天后永久清理。确定继续吗？', confirmBtn: '删除', theme: 'warning', onConfirm: async () => { await store.removeSession(key); if (!store.current) await store.ensureSession(); await router.replace({ name: 'agent', query: store.current ? { session: store.current.session.sessionKey } : {} }); dialog.destroy() }, onCancel: () => dialog.destroy() })
}

function changeContextValue(kind: 'platform' | 'osType', value: string | number | undefined) {
  const next = String(value ?? '')
  store.setContext(kind === 'platform' ? next : store.platform, kind === 'osType' ? next : store.osType)
}

function changePlatform(value: string | number | undefined) { changeContextValue('platform', value) }
function changeOsType(value: string | number | undefined) { changeContextValue('osType', value) }

onMounted(() => void loadRequestedSession())
watch(() => route.query.session, () => void loadRequestedSession())
</script>

<template>
  <div class="agent-page">
    <aside class="agent-sessions">
      <div class="agent-sessions__header">
        <strong>会话列表</strong><button @click="create">＋</button>
      </div>
      <button
        v-for="session in store.sessions"
        :key="session.sessionKey"
        class="session-item"
        :class="{ 'is-active': session.sessionKey === store.current?.session.sessionKey }"
        @click="select(session.sessionKey)"
      >
        <strong>{{ session.title || '新会话' }}</strong>
        <small>{{ session.status === 'ACTIVE' ? '进行中' : '已关闭' }}<t-button variant="text" theme="danger" size="small" @click.stop="remove(session.sessionKey)">删除</t-button></small>
      </button>
    </aside>
    <section class="agent-workspace">
      <div v-if="authStore.feishuDocumentAccess !== 'AUTHORIZED'" class="agent-knowledge-notice">
        <span>当前可使用 Skill 与团队 Wiki 推荐；授权飞书文档后，DSH 还能结合你有权访问的项目资料回答问题。</span>
        <RouterLink :to="{ name: 'login', query: { redirect: '/agent' } }">授权飞书文档</RouterLink>
      </div>
      <header><div><h1>研途助手</h1><p>研发全流程助手 · Skill 推荐、公司资料问答与研发知识支持</p></div><div class="agent-selectors"><t-select :value="store.platform" label="平台" :options="[{ label: '默认', value: '' }, { label: 'CodeBuddy', value: 'CODEBUDDY' }, { label: 'OpenCode', value: 'OPENCODE' }]" @change="changePlatform" /><t-select :value="store.osType" label="系统" :options="[{ label: '默认', value: '' }, { label: '通用', value: 'ANY' }, { label: 'Windows', value: 'WINDOWS' }, { label: 'macOS', value: 'MACOS' }, { label: 'Linux', value: 'LINUX' }]" @change="changeOsType" /></div></header>
      <AgentChat />
    </section>
    <aside class="agent-context">
      <h2>推荐上下文</h2>
      <div class="context-card">
        <strong>当前能力</strong>
        <p>按需求检索、分析并推荐已发布 Skill。</p>
      </div>
      <div class="context-card">
        <strong>安全边界</strong>
        <p>Agent 只提出推荐，不会自动下载、编辑、发布或审核 Skill。</p>
      </div>
      <RouterLink class="market-link" :to="{ name: 'skills' }">打开 Skill 市场</RouterLink>
    </aside>
    <AgentBatchDownloadDialog v-model:visible="batchVisible" :run-key="batchRunKey" :recommendation="batchRecommendation" :default-platform="store.platform" :default-os-type="store.osType" />
  </div>
</template>

<style scoped>
.agent-page{display:flex;height:100%;min-height:0;background:var(--surface-1)}.agent-sessions{width:240px;flex:0 0 240px;overflow:auto;border-right:1px solid var(--border-1);background:var(--surface-1)}.agent-sessions__header{display:flex;height:52px;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--border-1);font-size:13px}.agent-sessions__header button{border:0;background:transparent;font-size:20px;cursor:pointer}.session-item{display:grid;width:calc(100% - 12px);gap:3px;margin:6px;padding:10px;border:0;border-radius:7px;color:var(--text-2);background:transparent;text-align:left;cursor:pointer}.session-item:hover,.session-item.is-active{color:var(--accent-500);background:var(--accent-softer)}.session-item strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.session-item small{display:flex;align-items:center;justify-content:space-between;font-size:10px}.agent-workspace{display:flex;min-width:0;flex:1;flex-direction:column}.agent-workspace>header{display:flex;height:76px;align-items:center;justify-content:space-between;padding:0 22px;border-bottom:1px solid var(--border-1)}.agent-workspace h1{margin:0;color:var(--text-1);font-size:18px}.agent-workspace p{margin:3px 0 0;color:var(--text-3);font-size:11px}.agent-selectors{display:flex;gap:10px;padding:7px 10px;border:1px solid var(--border-1);border-radius:12px;background:var(--surface-1);backdrop-filter:blur(12px);box-shadow:var(--shadow-md)}.agent-selectors .t-select{width:132px}.agent-knowledge-notice{display:flex;justify-content:space-between;gap:14px;padding:9px 22px;color:var(--warning);background:var(--warning-soft);font-size:12px;line-height:1.5}.agent-knowledge-notice a{flex:0 0 auto;color:var(--accent-500);font-weight:700}.agent-context{width:260px;flex:0 0 260px;padding:18px;border-left:1px solid var(--border-1);background:var(--surface-1)}.agent-context h2{margin:0 0 14px;color:var(--text-1);font-size:13px}.context-card{margin-bottom:12px;padding:12px;border:1px solid var(--border-1);border-radius:8px}.context-card strong{color:var(--text-1);font-size:12px}.context-card p{margin:6px 0 0;color:var(--text-2);font-size:11px;line-height:1.6}.market-link{display:block;padding:9px;border-radius:7px;color:var(--text-on-accent);background:var(--accent-500);font-size:12px;text-align:center;text-decoration:none}@media(max-width:1050px){.agent-context{display:none}}@media(max-width:760px){.agent-sessions{display:none}.agent-workspace>header{height:auto;align-items:stretch;flex-direction:column;gap:10px;padding:14px}.agent-selectors{justify-content:stretch}.agent-selectors .t-select{width:50%}}
</style>
