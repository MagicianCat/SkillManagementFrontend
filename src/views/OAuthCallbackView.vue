<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const route = useRoute(); const router = useRouter(); const authStore = useAuthStore()
const message = ref('正在完成飞书登录…'); const failed = ref(false)
const OAUTH_REDIRECT_KEY = 'skill-management.oauth-redirect'

onMounted(async () => {
  const error = typeof route.query.error === 'string' ? route.query.error : ''
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const state = typeof route.query.state === 'string' ? route.query.state : ''
  if (error === 'access_denied') { message.value = '你已取消飞书登录'; failed.value = true; return }
  if (!code || !state) { message.value = '飞书登录回调参数不完整'; failed.value = true; return }
  try {
    await authStore.authenticateFeishu(code, state)
    const storedRedirect = sessionStorage.getItem(OAUTH_REDIRECT_KEY)
    sessionStorage.removeItem(OAUTH_REDIRECT_KEY)
    const redirect = storedRedirect && storedRedirect.startsWith('/') ? storedRedirect : '/skills'
    await router.replace(redirect)
  } catch (err: unknown) {
    message.value = axios.isAxiosError(err) ? (err.response?.data?.message ?? '飞书登录失败，请重试') : '飞书登录失败，请重试'
    failed.value = true
  }
})
</script>
<template>
  <main class="login-page"><section class="login-panel oauth-callback" aria-live="polite">
    <div class="login-panel__header"><p class="eyebrow">FEISHU SSO</p><h2>{{ message }}</h2></div>
    <button v-if="failed" class="login-submit" type="button" @click="router.replace({ name: 'login' })">返回登录</button>
  </section></main>
</template>
