<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { approveIdeAuthorization, getIdeAuthorization } from '../api/auth.api'
import type { IdeAuthorizationDetails } from '../types/auth'

type AuthorizationState =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'not-found'
  | 'expired'
  | 'unavailable'
  | 'error'

const route = useRoute()
const state = ref<AuthorizationState>('loading')
const errorMessage = ref('')
const authorization = ref<IdeAuthorizationDetails | null>(null)

function readUserCode(): string {
  const value = route.query.user_code
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    return first?.trim() ?? ''
  }
  return ''
}

const userCode = computed(readUserCode)
const clientName = computed(() => authorization.value?.clientName ?? '')
const hasUserCode = computed(() => Boolean(userCode.value))
const formattedExpiry = computed(() => {
  if (!authorization.value?.expiresAt) return ''
  const expiresAt = new Date(authorization.value.expiresAt)
  return Number.isNaN(expiresAt.getTime()) ? '' : expiresAt.toLocaleString()
})

function isExpired(details: IdeAuthorizationDetails): boolean {
  if (details.status === 'EXPIRED') return true
  const expiresAt = Date.parse(details.expiresAt)
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}

async function loadAuthorization() {
  authorization.value = null
  errorMessage.value = ''
  if (!hasUserCode.value) {
    state.value = 'not-found'
    return
  }
  state.value = 'loading'
  try {
    const details = await getIdeAuthorization(userCode.value)
    authorization.value = details
    if (isExpired(details)) {
      state.value = 'expired'
    } else if (details.status === 'PENDING') {
      state.value = 'ready'
    } else {
      state.value = 'unavailable'
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      state.value = 'not-found'
      return
    }
    if (axios.isAxiosError(error) && error.response?.status === 410) {
      state.value = 'expired'
      return
    }
    state.value = 'error'
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '无法加载授权请求，请稍后重试')
      : '无法加载授权请求，请稍后重试'
  }
}

async function approve() {
  if (!authorization.value || state.value !== 'ready') return
  state.value = 'submitting'
  errorMessage.value = ''
  try {
    await approveIdeAuthorization({ userCode: userCode.value })
    state.value = 'success'
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 410) {
      state.value = 'expired'
      return
    }
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      state.value = 'not-found'
      return
    }
    state.value = 'error'
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '授权失败，请稍后重试')
      : '授权失败，请稍后重试'
  }
}

onMounted(loadAuthorization)
</script>

<template>
  <main class="ide-authorize-page">
    <section class="ide-authorize-card" aria-labelledby="authorize-title">
      <div class="brand-mark" aria-hidden="true">研</div>

      <template v-if="state === 'loading'">
        <t-loading size="large" text="正在验证授权请求…" />
        <h1 id="authorize-title" class="loading-title">验证配对信息</h1>
        <p class="state-copy" role="status">正在从平台安全地读取客户端信息和授权状态。</p>
      </template>

      <template v-else-if="state === 'success'">
        <div class="state-icon state-icon--success" aria-hidden="true">✓</div>
        <p class="eyebrow">AUTHORIZATION COMPLETE</p>
        <h1 id="authorize-title">已授权 {{ clientName }}</h1>
        <p class="state-copy" role="status">
          登录授权已完成。你可以关闭此页面，返回 CodeBuddy 继续使用研途助手。
        </p>
      </template>

      <template v-else-if="state === 'not-found'">
        <div class="state-icon state-icon--expired" aria-hidden="true">!</div>
        <p class="eyebrow">AUTHORIZATION NOT FOUND</p>
        <h1 id="authorize-title">找不到授权请求</h1>
        <p class="state-copy" role="alert">
          授权链接无效或配对请求已不存在。请返回 CodeBuddy 重新发起登录。
        </p>
      </template>

      <template v-else-if="state === 'expired'">
        <div class="state-icon state-icon--expired" aria-hidden="true">!</div>
        <p class="eyebrow">AUTHORIZATION EXPIRED</p>
        <h1 id="authorize-title">授权请求已过期</h1>
        <p class="state-copy" role="alert">
          请返回 CodeBuddy 重新发起登录，再打开新的授权链接。
        </p>
      </template>

      <template v-else-if="state === 'unavailable'">
        <div class="state-icon state-icon--expired" aria-hidden="true">!</div>
        <p class="eyebrow">AUTHORIZATION UNAVAILABLE</p>
        <h1 id="authorize-title">授权请求不可用</h1>
        <p class="state-copy" role="alert">
          这项请求已被处理或取消。请返回 CodeBuddy 查看结果或重新发起登录。
        </p>
      </template>

      <template v-else-if="state === 'error'">
        <div class="state-icon state-icon--expired" aria-hidden="true">!</div>
        <p class="eyebrow">AUTHORIZATION ERROR</p>
        <h1 id="authorize-title">无法验证授权请求</h1>
        <p class="state-copy" role="alert">{{ errorMessage }}</p>
        <t-button variant="outline" theme="primary" @click="loadAuthorization">重新加载</t-button>
      </template>

      <template v-else>
        <p class="eyebrow">CODEBUDDY CONNECTION</p>
        <h1 id="authorize-title">连接研途助手</h1>
        <p class="authorize-intro">
          <strong>{{ clientName }}</strong> 正在请求使用你的平台身份。确认后，请返回 CodeBuddy 继续操作。
        </p>

        <div v-if="hasUserCode" class="code-panel">
          <span>配对码</span>
          <strong>{{ userCode }}</strong>
          <small>请确认它与 CodeBuddy 中显示的配对码一致</small>
          <small v-if="formattedExpiry">有效期至 {{ formattedExpiry }}</small>
        </div>

        <t-button
          block
          size="large"
          theme="primary"
          :loading="state === 'submitting'"
          :disabled="state !== 'ready'"
          @click="approve"
        >
          确认授权
        </t-button>
        <p class="security-note">仅授权当前 IDE 登录，不会向页面或 IDE 展示你的访问令牌。</p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.ide-authorize-page {
  display: grid;
  min-height: 100vh;
  padding: 32px 20px;
  place-items: center;
  color: var(--color-text);
  background:
    radial-gradient(circle at 18% 12%, rgb(38 198 255 / 10%), transparent 30%),
    var(--color-background);
}

.ide-authorize-card {
  width: min(100%, 480px);
  padding: 38px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
  text-align: center;
}

.brand-mark,
.state-icon {
  display: grid;
  width: 48px;
  height: 48px;
  margin: 0 auto 24px;
  place-items: center;
  border-radius: 14px;
  color: var(--text-on-accent);
  background: var(--color-primary);
  font-size: 22px;
  font-weight: 800;
}

.state-icon--success { background: var(--color-success); }
.state-icon--expired { background: var(--warning); }

.loading-title { margin-top: 24px; }

.eyebrow {
  margin: 0 0 10px;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
}

h1 {
  margin: 0;
  color: var(--text-1);
  font-size: 26px;
}

.authorize-intro,
.state-copy {
  margin: 16px 0 24px;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.authorize-intro strong { color: var(--color-text); }

.code-panel {
  display: grid;
  gap: 7px;
  margin: 0 0 20px;
  padding: 20px;
  border: 1px solid var(--color-primary-border);
  border-radius: 12px;
  background: var(--color-primary-soft);
}

.code-panel span,
.code-panel small { color: var(--color-text-muted); font-size: 12px; }
.code-panel strong { color: var(--color-brand-deep); font: 700 28px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; }

.authorize-alert {
  margin: 0 0 18px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  color: var(--warning);
  background: var(--warning-soft);
  font-size: 13px;
  line-height: 1.5;
}

.security-note {
  margin: 14px 0 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.5;
}

@media (max-width: 520px) {
  .ide-authorize-page { padding: 16px; }
  .ide-authorize-card { padding: 28px 20px; }
  .code-panel strong { font-size: 23px; }
}
</style>
