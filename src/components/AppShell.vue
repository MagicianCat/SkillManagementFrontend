<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { LifecycleStatus } from '../types/skill'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const statuses: Array<{ value: LifecycleStatus; label: string }> = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'REVIEWING', label: '审核中' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'DEPRECATED', label: '已废弃' },
  { value: 'OFFLINE', label: '已下线' },
]
const userInitial = computed(
  () => authStore.user?.displayName?.slice(0, 1) || 'U',
)
const activeStatus = computed(() => route.query.lifecycleStatus)
function filterStatus(value?: LifecycleStatus) {
  void router.push({
    name: 'skills',
    query: value ? { lifecycleStatus: value } : {},
  })
}
async function signOut() {
  await authStore.signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="workspace-shell">
    <aside class="workspace-sidebar">
      <RouterLink class="workspace-brand" :to="{ name: 'skills' }"
        ><span class="workspace-brand__mark">SP</span
        ><span>Skill 平台</span></RouterLink
      >
      <nav class="workspace-nav" aria-label="主导航">
        <RouterLink
          class="workspace-nav__item"
          :class="{
            'is-active':
              route.name === 'skills' || route.name === 'skill-detail',
          }"
          :to="{ name: 'skills' }"
          ><span>□</span>Skill 市场</RouterLink
        >
        <RouterLink class="workspace-nav__item" :to="{ name: 'workflows' }"
          ><span>✓</span>审核中心</RouterLink
        >
        <RouterLink class="workspace-nav__item" :to="{ name: 'home' }"
          ><span>◈</span>Agent 助手</RouterLink
        >
        <p class="workspace-nav__label">生命周期</p>
        <button
          v-for="status in statuses"
          :key="status.value"
          class="workspace-nav__item workspace-nav__filter"
          :class="{ 'is-active': activeStatus === status.value }"
          @click="filterStatus(status.value)"
        >
          <span>·</span>{{ status.label }}
        </button>
      </nav>
      <div class="workspace-user">
        <div class="workspace-user__avatar">{{ userInitial }}</div>
        <div class="workspace-user__info">
          <strong>{{ authStore.user?.displayName || '当前用户' }}</strong
          ><small>{{
            authStore.user?.permissions?.[0] || 'skill:browse'
          }}</small>
        </div>
        <button aria-label="退出登录" title="退出登录" @click="signOut">
          ↪
        </button>
      </div>
    </aside>
    <div class="workspace-main">
      <header class="workspace-header">
        <label class="header-search"
          ><span>⌕</span
          ><input
            type="search"
            placeholder="搜索 skill 名称..."
            @keydown.enter="
              (event) =>
                router.push({
                  name: 'skills',
                  query: { keyword: (event.target as HTMLInputElement).value },
                })
            "
        /></label>
        <div class="header-actions">
          <button aria-label="帮助">?</button
          ><button aria-label="通知">♧</button>
        </div>
      </header>
      <main class="workspace-content"><RouterView /></main>
    </div>
  </div>
</template>
