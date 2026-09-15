import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { feishuCallback, getFeishuDocumentAccess, logout, restoreBrowserSession } from '../api/auth.api'
import { setAccessToken } from '../api/http'
import type { AuthUser } from '../types/auth'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)
  const feishuDocumentAccess = ref('NOT_AVAILABLE')
  const initialized = ref(false)
  const isAuthenticated = computed(() =>
    Boolean(accessToken.value && user.value),
  )

  function setSession(
    nextAccessToken: string,
    nextUser: AuthUser,
  ) {
    accessToken.value = nextAccessToken
    setAccessToken(nextAccessToken)
    user.value = nextUser
  }

  async function refreshFeishuDocumentAccess() {
    if (!accessToken.value) { feishuDocumentAccess.value = 'NOT_AVAILABLE'; return }
    try { feishuDocumentAccess.value = (await getFeishuDocumentAccess()).status }
    catch { feishuDocumentAccess.value = 'NOT_AVAILABLE' }
  }

  function clearSession() {
    accessToken.value = null
    setAccessToken(null)
    user.value = null
    feishuDocumentAccess.value = 'NOT_AVAILABLE'
  }

  async function authenticateFeishu(code: string, state: string) {
    const result = await feishuCallback(code, state)
    setSession(result.accessToken, result.user)
    await refreshFeishuDocumentAccess()
  }

  async function initialize() {
    if (initialized.value) return
    initialized.value = true
    try {
      const result = await restoreBrowserSession()
      setSession(result.accessToken, result.user)
      await refreshFeishuDocumentAccess()
    } catch {
      clearSession()
    }
  }

  async function signOut() {
    clearSession()
    try {
      await logout()
    } catch {
      // 服务端登出失败不阻塞本地退出和路由跳转。
    }
  }

  return {
    accessToken,
    user,
    initialized,
    isAuthenticated,
    feishuDocumentAccess,
    authenticateFeishu,
    initialize,
    signOut,
    clearSession,
  }
})
