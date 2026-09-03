import { http } from './http'
import type { TokenResult } from '../types/auth'

export interface LoginRequest {
  username: string
  password: string
  provider: 'MOCK'
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
