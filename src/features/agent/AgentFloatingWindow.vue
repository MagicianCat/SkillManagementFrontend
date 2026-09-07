<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AgentChat from './AgentChat.vue'
import { useAgentStore } from './store'

const store = useAgentStore()
const router = useRouter()
onMounted(() => void store.refreshSessions().catch(() => undefined))

async function open() {
  store.floatingOpen = true
  await store.ensureSession()
}

function maximize() {
  const session = store.current?.session.sessionKey
  void router.push({ name: 'agent', query: session ? { session } : {} })
  store.floatingOpen = false
}
</script>

<template>
  <button
    v-if="!store.floatingOpen"
    class="agent-launcher"
    aria-label="打开 Agent 助手"
    @click="open"
  >
    AI
  </button>
  <aside v-else class="agent-floating" aria-label="Agent 助手悬浮窗">
    <header>
      <strong>Agent 助手</strong>
      <div>
        <button aria-label="打开独立页面" @click="maximize">□</button>
        <button aria-label="最小化" @click="store.floatingOpen = false">—</button>
      </div>
    </header>
    <AgentChat compact />
  </aside>
</template>

<style scoped>
.agent-launcher{position:fixed;z-index:40;right:24px;bottom:24px;width:52px;height:52px;border:0;border-radius:50%;color:#fff;background:#4f46e5;box-shadow:0 12px 30px rgb(79 70 229 / 35%);font-weight:800;cursor:pointer}.agent-floating{position:fixed;z-index:50;right:24px;bottom:24px;display:flex;width:390px;height:520px;overflow:hidden;flex-direction:column;border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 18px 50px rgb(15 23 42 / 20%)}.agent-floating>header{display:flex;height:48px;flex:0 0 48px;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:13px}.agent-floating header button{padding:5px;border:0;color:#64748b;background:transparent;cursor:pointer}@media(max-width:640px){.agent-floating{inset:12px;width:auto;height:auto}.agent-launcher{right:16px;bottom:16px}}
</style>
