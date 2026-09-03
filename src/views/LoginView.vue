<script setup lang="ts">
import { reactive, ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const form = reactive({ username: '', password: '' })
const submitting = ref(false)
const errorMessage = ref('')
const requestId = ref('')

async function submit() {
  errorMessage.value = ''
  requestId.value = ''
  if (!form.username.trim() || !form.password) {
    errorMessage.value = '请输入用户名和密码'
    return
  }
  submitting.value = true
  try {
    await authStore.authenticate(form.username.trim(), form.password)
    const redirect =
      typeof route.query.redirect === 'string'
        ? route.query.redirect
        : '/skills'
    await router.replace(redirect)
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      errorMessage.value = '用户名或密码错误'
    } else if (axios.isAxiosError(error)) {
      errorMessage.value = '登录请求失败，请稍后重试'
      requestId.value = String(error.response?.data?.requestId ?? '')
    } else {
      errorMessage.value = '登录请求失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

function showProviderNotice() {
  ElMessage.info('当前使用 Demo MOCK 身份提供方')
}
</script>

<template>
  <main class="login-page">
    <section class="login-intro" aria-label="产品介绍">
      <div class="login-mark">SM</div>
      <p class="eyebrow">SKILL MANAGEMENT SYSTEM</p>
      <h1>让每一个 Skill<br />都可维护、可审核、可发布。</h1>
      <p class="login-intro__copy">
        统一管理 Skill
        的源码、版本与生命周期，让团队协作始终建立在清晰的事实之上。
      </p>
      <div class="login-intro__line" aria-hidden="true"></div>
      <p class="login-intro__meta">内部平台 · Demo 环境</p>
    </section>
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-panel__header">
        <p class="eyebrow">WELCOME BACK</p>
        <h2 id="login-title">登录平台</h2>
        <p>使用你的平台账号继续工作</p>
      </div>
      <form class="login-form" novalidate @submit.prevent="submit">
        <div class="field-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="form.username"
            name="username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名"
            :disabled="submitting"
          />
        </div>
        <div class="field-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            :disabled="submitting"
          />
        </div>
        <div class="field-group">
          <label for="provider">身份提供方</label>
          <button
            id="provider"
            class="provider-field"
            type="button"
            @click="showProviderNotice"
          >
            <span>MOCK</span><span class="provider-badge">DEMO</span>
          </button>
        </div>
        <div v-if="errorMessage" class="login-error" role="alert">
          <span>{{ errorMessage }}</span>
          <small v-if="requestId">请求 ID：{{ requestId }}</small>
        </div>
        <button class="login-submit" type="submit" :disabled="submitting">
          <span v-if="submitting" class="loading-dot" aria-hidden="true"></span
          >{{ submitting ? '登录中…' : '登录' }}
        </button>
      </form>
      <p class="login-panel__footer">
        登录即表示你同意遵守平台的访问与使用规范。
      </p>
    </section>
  </main>
</template>
