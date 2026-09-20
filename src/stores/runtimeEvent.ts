import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiUrl } from '../config/api'
import type { WorkflowEvent } from '../types/workflow'
import { workflowEventsUrl } from '../api/workflow.api'

export const useRuntimeEventStore = defineStore('runtimeEvent', () => {
  const events = ref<WorkflowEvent[]>([]); const connected = ref(false); const reconnecting = ref(false); const error = ref('')
  let source: EventSource | null = null; let retryTimer: ReturnType<typeof setTimeout> | undefined; let runId = ''; let lastEventId = ''
  function close() { if (retryTimer) clearTimeout(retryTimer); source?.close(); source = null; connected.value = false }
  function connect(nextRunId: string) {
    const changedRun = runId !== nextRunId
    close(); runId = nextRunId; error.value = ''
    if (changedRun) { events.value = []; lastEventId = '' } else if (!events.value.length) {
      try { const saved = JSON.parse(sessionStorage.getItem(`workflow-events:${runId}`) || '{}') as { events?: WorkflowEvent[]; lastEventId?: string }; events.value = saved.events ?? []; lastEventId = saved.lastEventId ?? '' } catch { /* ignore stale browser cache */ }
    }
    const query = new URLSearchParams(); if (lastEventId) query.set('lastEventId', lastEventId)
    source = new EventSource(`${apiUrl(workflowEventsUrl(runId))}${query.size ? `?${query}` : ''}`, { withCredentials: true })
    source.onopen = () => { connected.value = true; reconnecting.value = false }
    source.onmessage = (message) => dispatch(message.data, message.lastEventId)
    // Named SSE events are normalized into the same store stream as default messages.
    for (const eventType of ['workflow.snapshot', 'workflow.status.changed', 'stage.status.changed', 'agent.status.changed', 'agent.protocol.retry.requested', 'agent.message.delta', 'agent.paused', 'agent.resumed', 'artifact.revision.created', 'tool.started', 'tool.completed', 'tool.failed', 'human.intervention.created', 'human.question.created', 'human.question.answer_submitted', 'human.question.answered', 'human.question.answer_failed', 'human.question.cancelled', 'workflow.completed', 'workflow.failed']) {
      source.addEventListener(eventType, (event) => { const message = event as MessageEvent; dispatch(message.data, message.lastEventId) })
    }
    source.onerror = () => { connected.value = false; source?.close(); reconnecting.value = true; retryTimer = setTimeout(() => connect(runId), 1500) }
  }
  function dispatch(raw: string, id?: string) { if (id) lastEventId = id; try { const event = JSON.parse(raw) as WorkflowEvent; events.value.push(event); if (events.value.length > 500) events.value.shift(); sessionStorage.setItem(`workflow-events:${runId}`, JSON.stringify({ events: events.value, lastEventId })) } catch { error.value = '执行事件格式无效' } }
  return { events, connected, reconnecting, error, connect, close, dispatch }
})
