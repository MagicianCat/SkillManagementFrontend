<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAgentStore } from './store'
import AgentBatchDownloadDialog from './AgentBatchDownloadDialog.vue'
import { renderAgentMarkdown } from './markdown'
import type { AgentRecommendation } from './types'

defineProps<{ compact?: boolean }>()
const store = useAgentStore()
const router = useRouter()
const input = ref('')
const stream = ref<null | { scrollTop: number; scrollHeight: number }>(null)
const batchVisible = ref(false)
const batchRunKey = ref<string | null>(null)
const batchRecommendation = ref<AgentRecommendation | null>(null)
const thinkingMessages = ['正在理解你的问题…', '正在分析相关上下文…', '正在检索相关信息…', '正在组织回答…']
const thinkingIndex = ref(0)
const thinkingText = computed(() => store.toolStatus || thinkingMessages[thinkingIndex.value] || thinkingMessages[0])
const showThinking = computed(() => {
  const lastMessage = store.visibleMessages.at(-1)
  return store.busy && !store.streamingText && lastMessage?.role !== 'ASSISTANT' && !store.error
})
let thinkingTimer: ReturnType<typeof setInterval> | undefined

function stopThinkingRotation() {
  if (thinkingTimer) clearInterval(thinkingTimer)
  thinkingTimer = undefined
}

async function submit() { const value = input.value; if (!value.trim() || store.busy) return; input.value = ''; await store.send(value) }
function openSkill(item: { skillKey: string; platform?: string | null; osType?: string | null }) { const platform = item.platform || store.platform; const osType = item.osType || store.osType; void router.push({ name: 'skill-detail', params: { skillKey: item.skillKey }, query: { ...(platform ? { platform } : {}), ...(osType ? { osType } : {}) } }); store.floatingOpen = false }
function openBatch(runKey: string | null | undefined, recommendation: AgentRecommendation | null | undefined) { if (!runKey || !recommendation?.items.length) return; batchRunKey.value = runKey; batchRecommendation.value = recommendation; batchVisible.value = true }
watch(showThinking, (visible) => {
  stopThinkingRotation()
  thinkingIndex.value = 0
  if (visible) thinkingTimer = setInterval(() => { thinkingIndex.value = (thinkingIndex.value + 1) % thinkingMessages.length }, 1600)
}, { immediate: true })
watch(() => [store.visibleMessages.length, store.streamingText, showThinking.value, thinkingText.value], async () => { await nextTick(); if (stream.value) stream.value.scrollTop = stream.value.scrollHeight })
onUnmounted(stopThinkingRotation)
</script>

<template>
  <div class="agent-chat" :class="{ 'is-compact': compact }">
    <div ref="stream" class="agent-chat__stream" aria-live="polite">
      <div v-if="!store.visibleMessages.length && !store.busy" class="agent-welcome"><span class="agent-avatar">AI</span><div><p>你好！我是研途助手，你的研发全流程助手。</p><p>我可以根据研发需求推荐有权限访问的平台 Skill，基于你有权限查看的飞书云文档回答公司内部业务问题，也可以结合已有知识回答研发基础问题。</p><p class="agent-context-reminder">我不会编造答案；公司资料会标明文档来源，无法确认的内容会明确说明。</p><p v-if="!store.platform || !store.osType" class="agent-context-reminder">开始首轮对话前，请在上方选择平台和操作系统，或直接在问题中说明，例如“推荐 OpenCode + Windows 的测试 Skill”。</p><div class="agent-prompts"><t-button size="small" theme="primary" @click="store.send('推荐研发全流程最佳实践的全部 Skill')">获取研发全流程 36 个 Skill</t-button><t-button size="small" variant="outline" @click="store.send('推荐后端编码阶段可用的 Skill')">推荐后端编码 Skill</t-button><t-button size="small" variant="outline" @click="store.send('帮我找支持 pytest 的测试 Skill')">查找 pytest Skill</t-button></div></div></div>
      <template v-for="message in store.visibleMessages" :key="`${message.sequence}-${message.status}`">
        <div class="agent-message" :class="`is-${message.role.toLowerCase()}`"><span v-if="message.role === 'ASSISTANT'" class="agent-avatar">AI</span><div v-if="message.role === 'ASSISTANT'" class="agent-message__bubble markdown-body" v-html="renderAgentMarkdown(message.content)"></div><div v-else class="agent-message__bubble">{{ message.content }}</div></div>
        <section v-if="message.role === 'ASSISTANT' && (message.recommendation || (message.status === 'STREAMING' && store.streamingRecommendation))" class="agent-recommendations" aria-label="本轮 Skill 推荐">
          <div class="recommendation-heading"><strong>本轮推荐 Skill</strong><t-button size="small" variant="outline" @click="openBatch(message.runKey, message.recommendation || store.streamingRecommendation)">批量下载</t-button></div>
          <p>{{ message.recommendation?.summary || store.streamingRecommendation?.summary }}</p>
          <article v-for="item in message.recommendation?.items || store.streamingRecommendation?.items || []" :key="item.skillKey" class="recommendation-card"><div><strong>{{ item.displayName || item.skillKey }}</strong><span>{{ item.priority }}</span></div><p>{{ item.description || item.reason }}</p><small v-if="item.version">版本 {{ item.version }}</small><t-button size="small" theme="primary" @click="openSkill(item)">查看详情</t-button></article>
        </section>
      </template>
      <div v-if="showThinking" class="agent-message is-assistant agent-thinking" role="status" aria-live="polite" aria-atomic="true">
        <span class="agent-avatar">AI</span>
        <div class="agent-message__bubble agent-thinking__bubble">
          <Transition name="thinking-copy" mode="out-in"><span :key="thinkingText">{{ thinkingText }}</span></Transition>
          <span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        </div>
      </div>
      <p v-if="store.toolStatus" class="agent-tool-status">{{ store.toolStatus }}</p>
      <div v-if="store.error" class="agent-error"><span>{{ store.error }}</span><RouterLink :to="{ name: 'skills' }">使用普通搜索</RouterLink></div>
    </div>
    <form class="agent-chat__composer" @submit.prevent="submit"><t-input v-model="input" :disabled="store.busy" maxlength="10000" placeholder="描述你的研发场景或 Skill 需求..." /><t-button v-if="store.running" type="button" theme="danger" @click="store.cancel">停止</t-button><t-button v-else type="submit" theme="primary" :loading="store.loading" :disabled="store.loading || !input.trim()">发送</t-button></form>
    <AgentBatchDownloadDialog v-model:visible="batchVisible" :run-key="batchRunKey" :recommendation="batchRecommendation" :default-platform="store.platform" :default-os-type="store.osType" />
  </div>
</template>

<style scoped>
.agent-chat{display:flex;min-height:0;flex:1;flex-direction:column;background:#fbf6f0}.agent-chat__stream{flex:1;overflow:auto;padding:24px}.agent-message,.agent-welcome{display:flex;gap:10px;margin:0 auto 18px;max-width:820px}.agent-message.is-user{justify-content:flex-end}.agent-avatar{display:grid;width:32px;height:32px;flex:0 0 32px;place-items:center;border-radius:50%;color:#e86600;background:#fff1e0;font-size:10px;font-weight:800}.agent-message__bubble,.agent-welcome>div{min-width:0;max-width:75%;padding:12px 14px;border:1px solid #ece1d2;border-radius:12px;background:#fff;color:#334155;font-size:14px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word}.agent-message.is-user .agent-message__bubble{border-color:#e86600;color:#fff;background:#e86600}.agent-thinking__bubble{display:flex;min-width:190px;align-items:center;gap:9px;color:#64748b}.thinking-copy-enter-active,.thinking-copy-leave-active{transition-property:opacity,transform;transition-duration:150ms;transition-timing-function:ease-out}.thinking-copy-enter-from{opacity:0;transform:translateY(3px)}.thinking-copy-leave-to{opacity:0;transform:translateY(-3px)}.thinking-dots{display:inline-flex;align-items:center;gap:3px}.thinking-dots i{width:4px;height:4px;border-radius:50%;background:#e86600;animation:thinking-pulse 1.1s ease-in-out infinite}.thinking-dots i:nth-child(2){animation-delay:.16s}.thinking-dots i:nth-child(3){animation-delay:.32s}@keyframes thinking-pulse{0%,70%,100%{opacity:.25;transform:translateY(0)}35%{opacity:1;transform:translateY(-2px)}}.markdown-body :deep(p){margin:0 0 8px}.markdown-body :deep(p:last-child){margin-bottom:0}.markdown-body :deep(pre){padding:10px;overflow:auto;border-radius:6px;background:#fff8ef}.markdown-body :deep(code){font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.agent-prompts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.agent-tool-status{margin:0 auto 14px;max-width:820px;color:#64748b;font-size:12px}.agent-recommendations{display:grid;gap:10px;margin:0 auto 18px;max-width:820px}.recommendation-heading{display:flex;align-items:center;justify-content:space-between}.agent-recommendations>p{margin:0;color:#334155;font-size:13px}.recommendation-card{padding:13px;border:1px solid #ffe6c7;border-radius:10px;background:#fff}.recommendation-card>div{display:flex;justify-content:space-between;gap:10px}.recommendation-card strong{color:#1e293b}.recommendation-card span{color:#b34a00;font-size:10px}.recommendation-card p{margin:7px 0;color:#64748b;font-size:12px}.recommendation-card small{color:#94a3b8}.recommendation-card .t-button{float:right}.agent-error{display:flex;justify-content:space-between;gap:12px;margin:0 auto;padding:10px 12px;max-width:820px;border-radius:8px;color:#991b1b;background:#fef2f2;font-size:12px}.agent-chat__composer{display:flex;gap:10px;padding:16px;border-top:1px solid #ece1d2;background:#fff}.agent-chat__composer .t-input{min-width:0;flex:1}.is-compact .agent-chat__stream{padding:14px}.is-compact .agent-message__bubble,.is-compact .agent-welcome>div{max-width:88%;padding:9px 11px;font-size:12px}.is-compact .agent-avatar{width:26px;height:26px;flex-basis:26px}.is-compact .agent-prompts{display:grid}.is-compact .agent-chat__composer{padding:10px}@media(prefers-reduced-motion:reduce){.thinking-copy-enter-active,.thinking-copy-leave-active{transition-duration:0s}.thinking-dots i{animation:none;opacity:.65}}
</style>
