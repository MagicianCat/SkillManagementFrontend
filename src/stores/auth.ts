import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { login, logout, refresh } from '../api/auth.api'
import { setAccessToken } from '../api/http'
import type { AuthUser } from '../types/auth'

const REFRESH_TOKEN_KEY = 'skill-management.refresh-token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(
    sessionStorage.getItem(REFRESH_TOKEN_KEY),
  )
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  const isAuthenticated = computed(() =>
    Boolean(accessToken.value && user.value),
  )

  function setSession(
    nextAccessToken: string,
    nextRefreshToken: string,
    nextUser: AuthUser,
  ) {
    accessToken.value = nextAccessToken
    setAccessToken(nextAccessToken)
    refreshToken.value = nextRefreshToken
    user.value = nextUser
    sessionStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken)
  }

  function clearSession() {
    accessToken.value = null
    setAccessToken(null)
    refreshToken.value = null
    user.value = null
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  async function authenticate(username: string, password: string) {
    const result = await login({ username, password, provider: 'MOCK' })
    setSession(result.accessToken, result.refreshToken, result.user)
  }

  async function initialize() {
    if (initialized.value) return
    initialized.value = true
    if (!refreshToken.value) return
    try {
      const result = await refresh(refreshToken.value)
      setSession(result.accessToken, result.refreshToken, result.user)
    } catch {
      clearSession()
    }
  }

  async function signOut() {
    const token = refreshToken.value
    try {
      if (token) await logout(token)
    } finally {
      clearSession()
    }
  }

  return {
    accessToken,
    user,
    initialized,
    isAuthenticated,
    authenticate,
    initialize,
    signOut,
    clearSession,
  }
})
