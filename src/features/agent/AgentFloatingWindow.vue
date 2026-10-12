<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentChat from './AgentChat.vue'
import { useAgentStore } from './store'

const store = useAgentStore()
const route = useRoute()
const router = useRouter()
const manuallyClosed = ref(false)

onMounted(() => void store.refreshSessions().catch(() => undefined))

async function open() {
  manuallyClosed.value = false
  store.floatingOpen = true
  await store.ensureSession()
}

function minimize() {
  manuallyClosed.value = true
  store.floatingOpen = false
}

// 进入 Skill 市场页时默认展开（除非本次会话中用户已手动最小化）
watch(
  () => route.name,
  (name) => {
    if (name === 'skills' && !manuallyClosed.value) {
      store.floatingOpen = true
      void store.ensureSession().catch(() => undefined)
    }
  },
  { immediate: true },
)

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
    aria-label="打开研途助手"
    @click="open"
  >
    <span class="agent-launcher__ring" aria-hidden="true"></span>
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="16" height="12" rx="3.5" />
      <path d="M12 8V5.6" />
      <circle cx="12" cy="4" r="1.6" />
      <circle cx="9" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.6" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.5 17h5" />
      <path d="M2 13h1.3" />
      <path d="M20.7 13H22" />
    </svg>
  </button>
  <aside v-else class="agent-floating" aria-label="研途助手悬浮窗">
    <header>
      <strong><span class="agent-floating__mark" aria-hidden="true"></span>研途助手</strong>
      <div>
        <button aria-label="打开独立页面" @click="maximize">□</button>
        <button aria-label="最小化" @click="minimize">—</button>
      </div>
    </header>
    <AgentChat compact />
  </aside>
</template>

<style scoped>
.agent-launcher {
  position: fixed;
  z-index: 40;
  right: 24px;
  bottom: 24px;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border: 2px solid var(--border-accent);
  border-radius: 50%;
  color: var(--text-on-accent);
  background: linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 100%);
  box-shadow: 0 0 20px rgb(38 198 255 / 35%);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.agent-launcher:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 0 28px rgb(38 198 255 / 45%);
}
.agent-launcher__ring {
  position: absolute;
  inset: -6px;
  border: 2px solid rgb(38 198 255 / 35%);
  border-radius: 50%;
  animation: agentPulse 2.4s ease-out infinite;
}
@keyframes agentPulse {
  0% {
    opacity: 0.9;
    transform: scale(0.92);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(1.18);
  }
}
.agent-floating {
  position: fixed;
  z-index: 50;
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  display: flex;
  /* 同时按视口比例和最大尺寸约束，兼容窄窗口、浏览器缩放和非全屏窗口。 */
  width: min(390px, max(320px, 34vw), calc(100vw - 24px));
  height: min(520px, 68vh, calc(100vh - 24px));
  max-width: calc(100vw - 24px);
  max-height: min(520px, 68vh, calc(100vh - 24px));
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--border-accent);
  border-radius: 14px;
  background: var(--surface-overlay);
  backdrop-filter: blur(20px) saturate(140%);
  box-shadow: var(--shadow-xl), var(--inner-highlight);
}
@supports (height: 100dvh) {
  .agent-floating {
    height: min(520px, 68dvh, calc(100dvh - 24px));
    max-height: min(520px, 68dvh, calc(100dvh - 24px));
  }
}
.agent-floating > header {
  display: flex;
  height: 48px;
  flex: 0 0 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--border-2);
  background: linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 100%);
  color: var(--text-on-accent);
  font-size: 13px;
}
.agent-floating > header strong {
  display: flex;
  align-items: center;
  gap: 8px;
}
.agent-floating__mark {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent-300);
  box-shadow: 0 0 0 3px rgb(38 198 255 / 30%), 0 0 8px rgb(38 198 255 / 50%);
}
.agent-floating header button {
  padding: 5px;
  border: 0;
  color: var(--text-on-accent);
  background: transparent;
  cursor: pointer;
}
@media (max-width: 640px) {
  .agent-floating {
    inset: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
  }
  .agent-launcher {
    right: 16px;
    bottom: 16px;
    width: 56px;
    height: 56px;
  }
}
</style>
