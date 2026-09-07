import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import {
  cancelAgentRun,
  closeAgentSession,
  createAgentSession,
  getAgentSession,
  listAgentSessions,
  sendAgentMessage,
  streamAgentRun,
} from './api'
import type {
  AgentMessage,
  AgentRecommendation,
  AgentSessionDetail,
  AgentSessionSummary,
  AgentStreamEvent,
} from './types'

export const useAgentStore = defineStore('agent', () => {
  const auth = useAuthStore()
  const sessions = ref<AgentSessionSummary[]>([])
  const current = ref<AgentSessionDetail | null>(null)
  const floatingOpen = ref(false)
  const loading = ref(false)
  const streamingText = ref('')
  const toolStatus = ref('')
  const error = ref('')
  const activeRunKey = ref<string | null>(null)
  const platform = ref('')
  const osType = ref('')
  let streamController: AbortController | null = null

  const running = computed(() => Boolean(activeRunKey.value))
  const visibleMessages = computed<AgentMessage[]>(() => {
    const saved = current.value?.messages ?? []
    if (!streamingText.value) return saved
    return [
      ...saved,
      {
        sequence: Number.MAX_SAFE_INTEGER,
        role: 'ASSISTANT',
        content: streamingText.value,
        status: 'STREAMING',
      },
    ]
  })
  const recommendation = computed<AgentRecommendation | null>(
    () => current.value?.latestRecommendation ?? null,
  )

  async function refreshSessions() {
    sessions.value = await listAgentSessions()
  }

  async function selectSession(sessionKey: string) {
    current.value = await getAgentSession(sessionKey)
    activeRunKey.value = ['PENDING', 'RUNNING'].includes(
      current.value.latestRun?.status ?? '',
    )
      ? current.value.latestRun?.runKey ?? null
      : null
  }

  async function ensureSession() {
    if (current.value?.session.status === 'ACTIVE') return current.value
    if (!sessions.value.length) await refreshSessions()
    const available = sessions.value.find((item) => item.status === 'ACTIVE')
    if (available) {
      await selectSession(available.sessionKey)
    } else {
      current.value = await createAgentSession(platform.value || undefined, osType.value || undefined)
      await refreshSessions()
    }
    return current.value!
  }

  async function newSession() {
    if (running.value) return
    current.value = await createAgentSession(platform.value || undefined, osType.value || undefined)
    streamingText.value = ''
    toolStatus.value = ''
    await refreshSessions()
  }

  async function removeSession(sessionKey: string) {
    await closeAgentSession(sessionKey)
    if (current.value?.session.sessionKey === sessionKey) current.value = null
    await refreshSessions()
  }

  async function send(content: string) {
    const value = content.trim()
    if (!value || running.value) return
    error.value = ''
    toolStatus.value = ''
    streamingText.value = ''
    const session = await ensureSession()
    session.messages.push({
      sequence: (session.messages.at(-1)?.sequence ?? 0) + 1,
      role: 'USER',
      content: value,
      status: 'COMPLETE',
    })
    try {
      const accepted = await sendAgentMessage(session.session.sessionKey, value)
      activeRunKey.value = accepted.runKey
      streamController = new AbortController()
      const token = auth.accessToken
      if (!token) throw new Error('登录状态已失效')
      await streamAgentRun(
        accepted.runKey,
        token,
        handleEvent,
        streamController.signal,
      )
      await reloadCurrent()
    } catch (cause) {
      if (!streamController?.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'Agent 请求失败'
      }
    } finally {
      activeRunKey.value = null
      streamController = null
      streamingText.value = ''
      toolStatus.value = ''
      await refreshSessions().catch(() => undefined)
    }
  }

  function handleEvent(event: AgentStreamEvent) {
    const payload = event.data ?? {}
    if (event.type === 'message.delta') {
      streamingText.value += String(payload.delta ?? '')
    } else if (event.type === 'tool.started') {
      toolStatus.value = `正在调用 ${String(payload.toolName ?? 'Skill 工具')}…`
    } else if (event.type === 'tool.completed') {
      toolStatus.value = 'Skill 检索已完成，正在整理推荐…'
    } else if (event.type === 'recommendation.completed') {
      if (current.value) {
        current.value.latestRecommendation = {
          summary: String(payload.summary ?? ''),
          status: String(payload.status ?? 'VALID') as AgentRecommendation['status'],
          items: Array.isArray(payload.items)
            ? (payload.items as AgentRecommendation['items'])
            : [],
        }
      }
    } else if (event.type === 'run.failed') {
      error.value = String(payload.message ?? 'Agent 运行失败，请稍后重试')
    }
  }

  async function reloadCurrent() {
    if (current.value) {
      current.value = await getAgentSession(current.value.session.sessionKey)
    }
  }

  async function cancel() {
    if (!activeRunKey.value) return
    const key = activeRunKey.value
    streamController?.abort()
    await cancelAgentRun(key)
    activeRunKey.value = null
    streamingText.value = ''
    toolStatus.value = ''
    await reloadCurrent()
  }

  function setContext(nextPlatform: string, nextOsType: string) {
    platform.value = nextPlatform
    osType.value = nextOsType
  }

  return {
    sessions,
    current,
    floatingOpen,
    loading,
    visibleMessages,
    recommendation,
    running,
    streamingText,
    toolStatus,
    error,
    refreshSessions,
    selectSession,
    ensureSession,
    newSession,
    removeSession,
    send,
    cancel,
    platform,
    osType,
    setContext,
  }
})
