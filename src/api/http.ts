import axios from 'axios'
import { apiBaseUrl } from '../config/api'

export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

/** Safe diagnostic fields returned by ApiExceptionHandler. */
export interface ApiErrorInfo { code: string; message: string; requestId?: string; diagnosticId?: string }
export function apiErrorInfo(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError(error)) return { code: 'CLIENT_ERROR', message: '操作失败' }
  const data = error.response?.data as Record<string, unknown> | undefined
  const code = typeof data?.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(data.code) ? data.code : 'REQUEST_FAILED'
  const message = typeof data?.message === 'string' ? data.message.slice(0, 160) : '请求暂时不可用'
  const requestId = typeof data?.requestId === 'string' ? data.requestId : error.response?.headers?.['x-request-id']
  const details = data?.details && typeof data.details === 'object' ? data.details as Record<string, unknown> : undefined
  const diagnosticId = typeof details?.diagnosticId === 'string' ? details.diagnosticId : undefined
  return { code, message, requestId, diagnosticId }
}
