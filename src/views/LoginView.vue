<script setup lang="ts">
import { ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useRoute } from 'vue-router'
import { getFeishuAuthorizeUrl } from '../api/auth.api'

const route = useRoute()
const feishuLoading = ref(false)
const OAUTH_REDIRECT_KEY = 'skill-management.oauth-redirect'

async function loginWithFeishu() {
  feishuLoading.value = true
  try {
    const redirectPath = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/agent'
    sessionStorage.setItem(OAUTH_REDIRECT_KEY, redirectPath)
    const authorizeUrl = await getFeishuAuthorizeUrl(redirectPath)
    window.location.assign(authorizeUrl)
  } catch { MessagePlugin.error('飞书登录暂不可用，请稍后重试') } finally { feishuLoading.value = false }
}

</script>

<template>
  <main class="login-page">
    <section class="login-intro" aria-label="产品介绍">
      <div class="login-mark">研</div>
      <p class="eyebrow">研发全流程助手</p>
      <h1>让研发工作<br />始终有迹可循。</h1>
      <p class="login-intro__copy">
        从需求分析、Skill 推荐到公司资料问答，帮助团队更高效地完成研发全流程。
      </p>
      <div class="login-intro__line" aria-hidden="true"></div>
      <p class="login-intro__meta">内部平台 · 研途助手</p>
    </section>
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-panel__header">
        <p class="eyebrow">WELCOME BACK</p>
        <h2 id="login-title">登录平台</h2>
        <p>使用你的飞书账号继续工作</p>
      </div>
      <button class="feishu-login" type="button" :disabled="feishuLoading" @click="loginWithFeishu">
        {{ feishuLoading ? '正在跳转…' : '使用飞书登录 / 扫码登录' }}
      </button>
      <p class="login-panel__footer">
        登录即表示你同意遵守平台的访问与使用规范。
      </p>
    </section>
  </main>
</template>
