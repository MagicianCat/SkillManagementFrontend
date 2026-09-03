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
