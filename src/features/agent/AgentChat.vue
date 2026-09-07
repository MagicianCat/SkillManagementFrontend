<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAgentStore } from './store'

defineProps<{ compact?: boolean }>()
const store = useAgentStore()
const router = useRouter()
const input = ref('')
const stream = ref<null | { scrollTop: number; scrollHeight: number }>(null)

async function submit() {
  const value = input.value
  if (!value.trim() || store.running) return
  input.value = ''
  await store.send(value)
}

function openSkill(skillKey: string) {
  void router.push({ name: 'skill-detail', params: { skillKey }, query: { ...(store.platform ? { platform: store.platform } : {}), ...(store.osType ? { osType: store.osType } : {}) } })
  store.floatingOpen = false
}

watch(
  () => [store.visibleMessages.length, store.streamingText],
  async () => {
    await nextTick()
    if (stream.value) stream.value.scrollTop = stream.value.scrollHeight
  },
)
</script>

<template>
  <div class="agent-chat" :class="{ 'is-compact': compact }">
    <div ref="stream" class="agent-chat__stream" aria-live="polite">
      <div v-if="!store.visibleMessages.length" class="agent-welcome">
        <span class="agent-avatar">AI</span>
        <div>
          <p>你好！我是 Skill 推荐助手，可以根据研发场景帮你查找合适的 Skill。</p>
          <div class="agent-prompts">
            <button @click="store.send('推荐后端编码阶段可用的 Skill')">
              推荐后端编码 Skill
            </button>
            <button @click="store.send('帮我找支持 pytest 的测试 Skill')">
              查找 pytest Skill
            </button>
          </div>
        </div>
      </div>
      <div
        v-for="message in store.visibleMessages"
        :key="`${message.sequence}-${message.status}`"
        class="agent-message"
        :class="`is-${message.role.toLowerCase()}`"
      >
        <span v-if="message.role === 'ASSISTANT'" class="agent-avatar">AI</span>
        <div class="agent-message__bubble">{{ message.content }}</div>
      </div>
      <p v-if="store.toolStatus" class="agent-tool-status">
        {{ store.toolStatus }}
      </p>
      <section
        v-if="store.recommendation?.items.length"
        class="agent-recommendations"
        aria-label="Skill 推荐"
      >
        <p>{{ store.recommendation.summary }}</p>
        <article
          v-for="item in store.recommendation.items"
          :key="item.skillKey"
          class="recommendation-card"
        >
          <div>
            <strong>{{ item.displayName || item.skillKey }}</strong>
            <span>{{ item.priority }}</span>
          </div>
          <p>{{ item.description || item.reason }}</p>
          <small v-if="item.version">版本 {{ item.version }}</small>
          <button @click="openSkill(item.skillKey)">查看详情</button>
        </article>
      </section>
      <div v-if="store.error" class="agent-error">
        <span>{{ store.error }}</span>
        <RouterLink :to="{ name: 'skills' }">使用普通搜索</RouterLink>
      </div>
    </div>
    <form class="agent-chat__composer" @submit.prevent="submit">
      <input
        v-model="input"
        :disabled="store.running"
        type="text"
        maxlength="10000"
        placeholder="描述你的研发场景或 Skill 需求..."
      />
      <button v-if="store.running" type="button" class="cancel" @click="store.cancel">
        停止
      </button>
      <button v-else type="submit" :disabled="!input.trim()">发送</button>
    </form>
  </div>
</template>

<style scoped>
.agent-chat{display:flex;min-height:0;flex:1;flex-direction:column;background:#f8fafc}.agent-chat__stream{flex:1;overflow:auto;padding:24px}.agent-message,.agent-welcome{display:flex;gap:10px;margin:0 auto 18px;max-width:820px}.agent-message.is-user{justify-content:flex-end}.agent-avatar{display:grid;width:32px;height:32px;flex:0 0 32px;place-items:center;border-radius:50%;color:#4f46e5;background:#eef2ff;font-size:10px;font-weight:800}.agent-message__bubble,.agent-welcome>div{max-width:75%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#334155;font-size:14px;line-height:1.65;white-space:pre-wrap}.agent-message.is-user .agent-message__bubble{border-color:#4f46e5;color:#fff;background:#4f46e5}.agent-welcome p{margin:0}.agent-prompts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.agent-prompts button{padding:6px 9px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;color:#475569;cursor:pointer}.agent-tool-status{margin:0 auto 14px;max-width:820px;color:#64748b;font-size:12px}.agent-recommendations{display:grid;gap:10px;margin:0 auto 18px;max-width:820px}.agent-recommendations>p{margin:0;color:#334155;font-size:13px}.recommendation-card{padding:13px;border:1px solid #dbeafe;border-radius:10px;background:#fff}.recommendation-card>div{display:flex;justify-content:space-between;gap:10px}.recommendation-card strong{color:#1e293b}.recommendation-card span{color:#4f46e5;font-size:10px}.recommendation-card p{margin:7px 0;color:#64748b;font-size:12px}.recommendation-card small{color:#94a3b8}.recommendation-card button{float:right;padding:5px 9px;border:0;border-radius:5px;color:#fff;background:#4f46e5;cursor:pointer}.agent-error{display:flex;justify-content:space-between;gap:12px;margin:0 auto;padding:10px 12px;max-width:820px;border-radius:8px;color:#991b1b;background:#fef2f2;font-size:12px}.agent-error a{font-weight:700}.agent-chat__composer{display:flex;gap:10px;padding:16px;border-top:1px solid #e2e8f0;background:#fff}.agent-chat__composer input{min-width:0;flex:1;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.agent-chat__composer button{padding:9px 16px;border:0;border-radius:8px;color:#fff;background:#4f46e5;cursor:pointer}.agent-chat__composer button:disabled{opacity:.5;cursor:not-allowed}.agent-chat__composer .cancel{background:#dc2626}.is-compact .agent-chat__stream{padding:14px}.is-compact .agent-message__bubble,.is-compact .agent-welcome>div{max-width:88%;padding:9px 11px;font-size:12px}.is-compact .agent-avatar{width:26px;height:26px;flex-basis:26px}.is-compact .agent-prompts{display:grid}.is-compact .agent-chat__composer{padding:10px}.is-compact .agent-chat__composer button{padding:8px 10px}
</style>
