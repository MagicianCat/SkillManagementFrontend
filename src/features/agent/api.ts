import { http } from '../../api/http'
import { apiUrl } from '../../config/api'
import type {
  AgentProfile,
  AgentRun,
  AgentSessionDetail,
  AgentSessionSummary,
  AgentStreamEvent,
  BatchDownloadResult,
} from './types'

export async function getAgentProfiles() {
  const { data } = await http.get<AgentProfile[]>('/agent/profiles')
  return data
}

export async function createAgentSession(platform?: string, osType?: string) {
  const { data } = await http.post<AgentSessionDetail>('/agent/sessions', {
    profileKey: 'skill-advisor',
    context: { platform: platform || null, osType: osType || null },
  })
  return data
}

export async function listAgentSessions() {
  const { data } = await http.get<AgentSessionSummary[]>('/agent/sessions')
  return data
}

export async function getAgentSession(sessionKey: string) {
  const { data } = await http.get<AgentSessionDetail>(
    `/agent/sessions/${encodeURIComponent(sessionKey)}`,
  )
  return data
}

export async function closeAgentSession(sessionKey: string) {
  await http.delete(`/agent/sessions/${encodeURIComponent(sessionKey)}`)
}

export async function updateAgentSessionContext(sessionKey: string, platform: string | null, osType: string | null) {
  const { data } = await http.patch<AgentSessionDetail>(`/agent/sessions/${encodeURIComponent(sessionKey)}/context`, { platform, osType })
  return data
}

export async function createAgentBatchDownload(runKey: string, platform: string, osType: string) {
  const { data } = await http.post<BatchDownloadResult>(`/agent/runs/${encodeURIComponent(runKey)}/bundle`, { platform, osType })
  return data
}

export async function downloadAgentBundle(bundleId: number) {
  return http.get(`/bundles/${bundleId}/download`, { responseType: 'blob' })
}

export async function sendAgentMessage(sessionKey: string, content: string) {
  const { data } = await http.post<{ runKey: string; status: string; platform: string | null; osType: string | null }>(
    `/agent/sessions/${encodeURIComponent(sessionKey)}/messages`,
    { content },
  )
  return data
}

export async function getAgentRun(runKey: string) {
  const { data } = await http.get<AgentRun>(
    `/agent/runs/${encodeURIComponent(runKey)}`,
  )
  return data
}

export async function cancelAgentRun(runKey: string) {
  await http.post(`/agent/runs/${encodeURIComponent(runKey)}:cancel`)
}

export async function streamAgentRun(
  runKey: string,
  accessToken: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal: AbortSignal,
): Promise<AgentStreamEvent | null> {
  let lastSequence = 0
  for (let attempt = 0; attempt < 3 && !signal.aborted; attempt += 1) {
    try {
      const response = await fetch(
        apiUrl(`/agent/runs/${encodeURIComponent(runKey)}/events`),
        {
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${accessToken}`,
            ...(lastSequence ? { 'Last-Event-ID': String(lastSequence) } : {}),
          },
          signal,
        },
      )
      if (!response.ok || !response.body) {
        throw new Error(`Agent stream returned HTTP ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!signal.aborted) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (data) {
            const event = JSON.parse(data) as AgentStreamEvent
            lastSequence = Math.max(lastSequence, event.sequence)
            onEvent(event)
            if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') {
              await reader.cancel().catch(() => undefined)
              return event
            }
          }
          boundary = buffer.indexOf('\n\n')
        }
        if (done) return null
      }
    } catch (error) {
      if (signal.aborted) return null
      throw error
    }
  }
  return null
}
