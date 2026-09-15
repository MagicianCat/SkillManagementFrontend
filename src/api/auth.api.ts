import { http } from './http'
import type {
  IdeAuthorizationApprovalRequest,
  IdeAuthorizationDetails,
  TokenResult,
  BrowserAuthResult,
} from '../types/auth'

export async function getFeishuAuthorizeUrl(redirectPath: string): Promise<string> {
  const { data } = await http.get<{ authorizeUrl: string }>('/auth/oauth/feishu/authorize', { params: { redirectPath } })
  return data.authorizeUrl
}
export async function feishuCallback(code: string, state: string): Promise<BrowserAuthResult> {
  const { data } = await http.post<BrowserAuthResult>('/auth/oauth/feishu/callback', { code, state })
  return data
}
export async function restoreBrowserSession(): Promise<BrowserAuthResult> {
  const { data } = await http.get<BrowserAuthResult>('/auth/session')
  return data
}

export async function refresh(refreshToken: string): Promise<TokenResult> {
  const { data } = await http.post<TokenResult>('/auth/refresh', {
    refreshToken,
  })
  return data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

export async function getFeishuDocumentAccess(): Promise<{ status: string }> {
  const { data } = await http.get<{ status: string }>('/auth/feishu/document-access')
  return data
}

export async function approveIdeAuthorization(
  request: IdeAuthorizationApprovalRequest,
): Promise<void> {
  await http.post('/auth/ide/authorizations/approve', request)
}

export async function getIdeAuthorization(userCode: string): Promise<IdeAuthorizationDetails> {
  const { data } = await http.get<IdeAuthorizationDetails>('/auth/ide/authorizations', {
    params: { userCode },
  })
  return data
}
