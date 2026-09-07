<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentChat from '../features/agent/AgentChat.vue'
import { useAgentStore } from '../features/agent/store'

const store = useAgentStore()
const route = useRoute()
const router = useRouter()

async function loadRequestedSession() {
  await store.refreshSessions()
  const requested = typeof route.query.session === 'string' ? route.query.session : null
  if (requested) await store.selectSession(requested)
  else await store.ensureSession()
}

async function select(key: string) {
  await store.selectSession(key)
  await router.replace({ name: 'agent', query: { session: key } })
}

async function create() {
  await store.newSession()
  if (store.current) await router.replace({ name: 'agent', query: { session: store.current.session.sessionKey } })
}

function changeContext(event: Event, kind: 'platform' | 'osType') {
  const value = (event.target as unknown as { value: string }).value
  store.setContext(kind === 'platform' ? value : store.platform, kind === 'osType' ? value : store.osType)
}

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
        <small>{{ session.status === 'ACTIVE' ? '进行中' : '已关闭' }}</small>
      </button>
    </aside>
    <section class="agent-workspace">
      <header><div><h1>Agent 助手</h1><p>根据研发需求推荐内部 Skill</p></div><div class="agent-selectors"><label>平台<select :value="store.platform" @change="changeContext($event, 'platform')"><option value="">默认</option><option value="CODEBUDDY">CodeBuddy</option><option value="OPENCODE">OpenCode</option></select></label><label>系统<select :value="store.osType" @change="changeContext($event, 'osType')"><option value="">默认</option><option value="ANY">通用</option><option value="WINDOWS">Windows</option><option value="MACOS">macOS</option><option value="LINUX">Linux</option></select></label></div></header>
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
  </div>
</template>

<style scoped>
.agent-page{display:flex;height:100%;min-height:0;background:#fff}.agent-sessions{width:240px;flex:0 0 240px;overflow:auto;border-right:1px solid #e2e8f0;background:#fff}.agent-sessions__header{display:flex;height:52px;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #e2e8f0;font-size:13px}.agent-sessions__header button{border:0;background:transparent;font-size:20px;cursor:pointer}.session-item{display:grid;width:calc(100% - 12px);gap:3px;margin:6px;padding:10px;border:0;border-radius:7px;color:#64748b;background:transparent;text-align:left;cursor:pointer}.session-item:hover,.session-item.is-active{color:#4f46e5;background:#eef2ff}.session-item strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.session-item small{font-size:10px}.agent-workspace{display:flex;min-width:0;flex:1;flex-direction:column}.agent-workspace>header{display:flex;height:64px;align-items:center;padding:0 22px;border-bottom:1px solid #e2e8f0}.agent-workspace h1{margin:0;color:#0f172a;font-size:18px}.agent-workspace p{margin:3px 0 0;color:#94a3b8;font-size:11px}.agent-context{width:260px;flex:0 0 260px;padding:18px;border-left:1px solid #e2e8f0;background:#fff}.agent-context h2{margin:0 0 14px;color:#334155;font-size:13px}.context-card{margin-bottom:12px;padding:12px;border:1px solid #e2e8f0;border-radius:8px}.context-card strong{color:#334155;font-size:12px}.context-card p{margin:6px 0 0;color:#64748b;font-size:11px;line-height:1.6}.market-link{display:block;padding:9px;border-radius:7px;color:#fff;background:#4f46e5;font-size:12px;text-align:center;text-decoration:none}@media(max-width:1050px){.agent-context{display:none}}@media(max-width:760px){.agent-sessions{display:none}}
</style>
