import { http } from './http'
import type { TokenResult } from '../types/auth'

export interface LoginRequest {
  username: string
  password: string
  provider: 'MOCK'
}
export interface AuthProviders { passwordLogin: boolean; providers: string[] }
export async function getAuthProviders(): Promise<AuthProviders> {
  const { data } = await http.get<AuthProviders>('/auth/providers')
  return data
}
export async function getFeishuAuthorizeUrl(redirectPath: string): Promise<string> {
  const { data } = await http.get<{ authorizeUrl: string }>('/auth/oauth/feishu/authorize', { params: { redirectPath } })
  return data.authorizeUrl
}
export async function feishuCallback(code: string, state: string): Promise<TokenResult> {
  const { data } = await http.post<TokenResult>('/auth/oauth/feishu/callback', { code, state })
  return data
}

export async function login(request: LoginRequest): Promise<TokenResult> {
  const { data } = await http.post<TokenResult>('/auth/login', request)
  return data
}

export async function refresh(refreshToken: string): Promise<TokenResult> {
  const { data } = await http.post<TokenResult>('/auth/refresh', {
    refreshToken,
  })
  return data
}

export async function logout(refreshToken: string): Promise<void> {
  await http.post('/auth/logout', { refreshToken })
}
