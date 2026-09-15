import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '../../stores/auth'
import {
  cancelAgentRun,
  closeAgentSession,
  createAgentSession,
  getAgentRun,
  getAgentSession,
  listAgentSessions,
  sendAgentMessage,
  streamAgentRun,
  updateAgentSessionContext,
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
  const streamingRecommendation = ref<AgentRecommendation | null>(null)
  const toolStatus = ref('')
  const error = ref('')
  const activeRunKey = ref<string | null>(null)
  const platform = ref('')
  const osType = ref('')
  let streamController: AbortController | null = null
  let contextSave: Promise<void> = Promise.resolve()

  const running = computed(() => Boolean(activeRunKey.value))
  const busy = computed(() => loading.value || running.value)
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
        runKey: activeRunKey.value,
        recommendation: streamingRecommendation.value,
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
    platform.value = current.value.session.platform ?? ''
    osType.value = current.value.session.osType ?? ''
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
    streamingRecommendation.value = null
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
    if (!value || busy.value) return
    loading.value = true
    error.value = ''
    toolStatus.value = ''
    streamingText.value = ''
    streamingRecommendation.value = null
    let pollingStopped = false
    let terminalObserved = false
    try {
      const session = await ensureSession()
      session.messages.push({
        sequence: (session.messages.at(-1)?.sequence ?? 0) + 1,
        role: 'USER',
        content: value,
        status: 'COMPLETE',
      })
      await contextSave
      const accepted = await sendAgentMessage(session.session.sessionKey, value)
      platform.value = accepted.platform ?? ''
      osType.value = accepted.osType ?? ''
      session.session.platform = accepted.platform
      session.session.osType = accepted.osType
      activeRunKey.value = accepted.runKey
      loading.value = false
      streamController = new AbortController()
      const token = auth.accessToken
      if (!token) throw new Error('登录状态已失效')
      const onStreamEvent = (event: AgentStreamEvent) => {
        if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') {
          terminalObserved = true
        }
        handleEvent(event)
      }
      let streamFailure: unknown
      const streamPromise = streamAgentRun(
        accepted.runKey,
        token,
        onStreamEvent,
        streamController.signal,
      ).catch((cause) => {
        streamFailure = cause
        return null
      })
      const pollPromise = pollAgentRunUntilTerminal(
        accepted.runKey,
        () => pollingStopped || terminalObserved || streamController?.signal.aborted === true,
        onStreamEvent,
      )
      await Promise.race([streamPromise, pollPromise])
      if (!terminalObserved && !streamController.signal.aborted) await pollPromise
      if (!terminalObserved && streamFailure) throw streamFailure
      pollingStopped = true
      streamController.abort()
      await reloadCurrent()
    } catch (cause) {
      if (!streamController?.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'Agent 请求失败'
      }
    } finally {
      pollingStopped = true
      loading.value = false
      activeRunKey.value = null
      streamController = null
      streamingText.value = ''
      toolStatus.value = ''
      await refreshSessions().catch(() => undefined)
    }
  }

  async function pollAgentRunUntilTerminal(
    runKey: string,
    stopped: () => boolean,
    onTerminal: (event: AgentStreamEvent) => void,
  ) {
    const deadline = Date.now() + 270_000
    while (!stopped() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      if (stopped()) return
      try {
        const run = await getAgentRun(runKey)
        if (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) continue
        const type = run.status === 'SUCCEEDED' ? 'run.completed' : run.status === 'FAILED' ? 'run.failed' : 'run.cancelled'
        onTerminal({
          sequence: Number.MAX_SAFE_INTEGER,
          type,
          data: type === 'run.completed'
            ? { runKey: run.runKey, message: '' }
            : { runKey: run.runKey, code: run.errorCode, message: run.errorMessage },
        })
        return
      } catch {
        // A transient status request failure must not interrupt the live SSE stream.
      }
    }
    if (!stopped()) throw new Error('Agent 等待超时，请稍后重试')
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
        const next = {
          summary: String(payload.summary ?? ''),
          status: String(payload.status ?? 'VALID') as AgentRecommendation['status'],
          items: Array.isArray(payload.items)
            ? (payload.items as AgentRecommendation['items'])
            : [],
        }
        streamingRecommendation.value = next
        current.value.latestRecommendation = next
      }
    } else if (event.type === 'run.phase') {
      toolStatus.value = String(payload.message ?? '正在处理…')
    } else if (event.type === 'run.completed') {
      const message = String(payload.message ?? '')
      if (message && !streamingText.value.trim()) streamingText.value = message
      toolStatus.value = ''
    } else if (event.type === 'run.retrying') {
      toolStatus.value = String(payload.message ?? '模型未生成最终回答，正在重新整理结果…')
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
    streamingRecommendation.value = null
    toolStatus.value = ''
    await reloadCurrent()
  }

  function setContext(nextPlatform: string, nextOsType: string) {
    platform.value = nextPlatform
    osType.value = nextOsType
    if (current.value?.session.status === 'ACTIVE' && !running.value) {
      const sessionKey = current.value.session.sessionKey
      contextSave = contextSave.then(async () => {
        const updated = await updateAgentSessionContext(sessionKey, nextPlatform || null, nextOsType || null)
        if (current.value?.session.sessionKey === sessionKey) current.value = updated
      }).catch((cause) => { error.value = cause instanceof Error ? cause.message : '保存环境失败' })
    }
    return contextSave
  }

  return {
    sessions,
    current,
    floatingOpen,
    loading,
    visibleMessages,
    recommendation,
    running,
    busy,
    streamingText,
    streamingRecommendation,
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
