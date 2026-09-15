export interface AuthUser {
  id: number
  username: string
  displayName: string
  roles: string[]
  permissions: string[]
}

export interface TokenResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface BrowserAuthResult {
  accessToken: string
  expiresIn: number
  user: AuthUser
}

export interface IdeAuthorizationApprovalRequest {
  userCode: string
}

export type IdeAuthorizationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'CONSUMED'
  | 'EXPIRED'

export interface IdeAuthorizationDetails {
  clientName: string
  status: IdeAuthorizationStatus
  expiresAt: string
}
