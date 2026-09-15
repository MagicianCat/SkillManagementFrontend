<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { hasPermission } from '../types/permissions'
import {
  listNotifications,
  markNotificationRead,
  sortNotifications,
} from '../api/notifications.api'
import type { NotificationView } from '../types/notification'
import { notificationContent } from '../types/notification'
import { useNotificationStore } from '../stores/notifications'
import AgentFloatingWindow from '../features/agent/AgentFloatingWindow.vue'
import { getSkillUsageAccessScope } from '../api/skill-usage.api'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const route = useRoute()
const router = useRouter()

const agentEnabled = import.meta.env.VITE_FEATURE_AGENT === 'true'
const telemetryAccessible = ref(false)

interface NavEntry {
  label: string
  routeName: string
  icon: string
  visible: boolean
}

const navEntries = computed<NavEntry[]>(() => [
  {
    label: '全流程助手',
    routeName: 'agent',
    icon: 'robot',
    visible: agentEnabled,
  },
  {
    label: 'Skill 市场',
    routeName: 'skills',
    icon: 'box',
    visible: hasPermission(authStore.user?.permissions, 'skill:browse'),
  },
  {
    label: '团队 Wiki',
    routeName: 'wiki',
    icon: 'book',
    visible: hasPermission(authStore.user?.permissions, 'skill:browse'),
  },
  {
    label: '审核中心',
    routeName: 'reviews',
    icon: 'review',
    visible:
      hasPermission(authStore.user?.permissions, 'skill:review') ||
      hasPermission(authStore.user?.permissions, 'wiki:review'),
  },
  {
    label: 'Agent 审计',
    routeName: 'agent-mcp-audits',
    icon: 'review',
    visible: hasPermission(authStore.user?.permissions, 'admin:audit'),
  },
  {
    label: 'Skill 使用看板',
    routeName: 'skill-usage-dashboard',
    icon: 'chart',
    visible:
      hasPermission(authStore.user?.permissions, 'admin:telemetry') ||
      hasPermission(authStore.user?.permissions, 'skill:review') ||
      telemetryAccessible.value,
  },
  {
    label: '组织与权限',
    routeName: 'organization',
    icon: 'users',
    visible: hasPermission(authStore.user?.permissions, 'admin:identity'),
  },
  {
    label: '通知中心',
    routeName: 'notifications',
    icon: 'bell',
    visible: true,
  },
  {
    label: '流程最佳实践',
    routeName: 'dev-pipeline',
    icon: 'pipeline',
    visible: true,
  },
])
const visibleNav = computed(() => navEntries.value.filter((e) => e.visible))

const userInitial = computed(
  () => authStore.user?.displayName?.slice(0, 1) || 'U',
)

// 通知中心
const showNotifications = ref(false)
const notifications = ref<NotificationView[]>([])
const notificationsLoading = ref(false)
const notificationWrap = ref<HTMLDivElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | undefined

async function refreshUnread() {
  await notificationStore.refresh()
}

async function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    notificationsLoading.value = true
    try {
      // 下拉只展示未读，按时间倒序，最多 10 条
      const page = await listNotifications({
        page: 0,
        size: 10,
        unreadOnly: true,
        sort: 'timeCreated,desc',
      })
      notifications.value = sortNotifications(page.items)
    } finally {
      notificationsLoading.value = false
    }
  }
}

async function openNotification(item: NotificationView) {
  if (!item.readAt) {
    try {
      await markNotificationRead(item.id)
      item.readAt = new Date().toISOString()
      notificationStore.decrement()
    } catch {
      // 忽略标记失败，仍允许跳转
    }
  }
  showNotifications.value = false
  if (item.targetType === 'SKILL_VERSION' && item.skillKey) {
    // 审核驳回后草稿回到 DRAFT，可继续编辑；通过则看详情
    if (item.type === 'REVIEW_REJECTED') {
      void router.push({
        name: 'skill-draft',
        params: { skillKey: item.skillKey },
      })
    } else {
      void router.push({
        name: 'skill-detail',
        params: { skillKey: item.skillKey },
      })
    }
  } else if (item.targetType === 'REVIEW') {
    // REVIEW_SUBMITTED 通知携带 reviewId，直达审核详情
    if (item.targetId) {
      void router.push({
        name: 'review-detail',
        params: { reviewId: item.targetId },
      })
    } else {
      void router.push({ name: 'reviews' })
    }
  } else if (item.targetType === 'WIKI_REVIEW') {
    if (item.targetId) void router.push({ name: 'wiki-review-detail', params: { reviewId: item.targetId } })
    else void router.push({ name: 'wiki-reviews' })
  } else if (item.targetType === 'WIKI_DOCUMENT' && item.targetId) {
    void router.push({ name: 'wiki', query: { documentId: String(item.targetId) } })
  } else if (item.skillKey) {
    void router.push({
      name: 'skill-detail',
      params: { skillKey: item.skillKey },
    })
  }
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return value
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!showNotifications.value) return
  const target = event.target as Node | null
  if (target && notificationWrap.value && !notificationWrap.value.contains(target)) {
    showNotifications.value = false
  }
}

onMounted(() => {
  void refreshUnread()
  void getSkillUsageAccessScope().then(() => { telemetryAccessible.value = true }).catch(() => { /* 非管理员忽略 */ })
  pollTimer = setInterval(() => void refreshUnread(), 30_000)
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('click', onDocumentClick)
})

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
        ><span>研途助手</span></RouterLink
      >
      <nav class="workspace-nav" aria-label="主导航">
        <RouterLink
          v-for="entry in visibleNav"
          :key="entry.routeName"
          class="workspace-nav__item"
          :class="{
            'is-active':
              route.name === entry.routeName ||
              (entry.routeName === 'skills' &&
                (route.name === 'skill-detail' ||
                  route.name === 'skill-draft' ||
                  route.name === 'skill-create')),
          }"
          :to="{ name: entry.routeName }"
          ><span class="workspace-nav__icon" aria-hidden="true"
            ><svg
              v-if="entry.icon === 'book'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 5.5v16" /><path d="M8 7h8M8 11h8" /></svg
            ><svg
              v-else-if="entry.icon === 'box'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path
                d="M3.27 6.96 12 12.01l8.73-5.05" /><path d="M12 22.08V12" /></svg
            ><svg
              v-else-if="entry.icon === 'review'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect
                x="8"
                y="2"
                width="8"
                height="4"
                rx="1" /><path d="m9 14 2 2 4-4" /></svg
            ><svg
              v-else-if="entry.icon === 'bell'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path
                d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg
            ><svg
              v-else-if="entry.icon === 'robot'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="4" y="8" width="16" height="12" rx="2" /><path
                d="M12 8V4" /><circle cx="12" cy="3" r="1" /><path
                d="M2 14h2" /><path d="M20 14h2" /><path d="M9 13v2" /><path
                d="M15 13v2" /></svg
            ><svg
              v-else-if="entry.icon === 'pipeline'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle
                cx="12"
                cy="18"
                r="2" /><path d="M7 6h10" /><path
                d="M5 8v5a2 2 0 0 0 2 2h2.5" /><path d="M19 8v2.5" /><path
                d="M16.5 15 12 18l-4.5-3" /></svg
            ><svg
              v-else-if="entry.icon === 'chart'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /><path d="M18 6h2v2" /></svg
            ><svg
              v-else-if="entry.icon === 'users'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle
                cx="10"
                cy="7"
                r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path
                d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></span
          >{{ entry.label
          }}<em
            v-if="entry.routeName === 'notifications' && notificationStore.unreadCount > 0"
            class="workspace-nav__badge"
            >{{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}</em
          ></RouterLink
        >
      </nav>
      <div class="workspace-sidebar__spacer"></div>
      <div class="workspace-user">
        <div class="workspace-user__avatar">{{ userInitial }}</div>
        <div class="workspace-user__info">
          <strong>{{ authStore.user?.displayName || '当前用户' }}</strong>
        </div>
        <button aria-label="退出登录" title="退出登录" @click="signOut">
          ↪
        </button>
      </div>
    </aside>
    <div class="workspace-main">
      <header class="workspace-header">
        <div class="header-actions">
          <button aria-label="帮助">?</button>
          <div class="notification-wrap" ref="notificationWrap">
            <button
              aria-label="通知"
              class="notification-bell"
              @click="toggleNotifications"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path
                  d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg
              ><span
                v-if="notificationStore.unreadCount > 0"
                class="notification-badge"
                >{{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}</span
              >
            </button>
            <div v-if="showNotifications" class="notification-panel">
              <p class="notification-panel__title">未读通知</p>
              <div v-if="notificationsLoading" class="notification-empty">
                加载中…
              </div>
              <div
                v-else-if="!notifications.length"
                class="notification-empty"
              >
                暂无未读通知
              </div>
              <button
                v-for="item in notifications"
                v-else
                :key="item.id"
                class="notification-item"
                :class="{ 'is-unread': !item.readAt }"
                @click="openNotification(item)"
              >
                <strong>{{ item.title }}</strong>
                <span>{{ notificationContent(item) }}</span>
                <small>{{ formatTime(item.createdAt) }}</small>
              </button>
              <RouterLink
                v-if="!notificationsLoading"
                class="notification-panel__more"
                :to="{ name: 'notifications' }"
                @click="showNotifications = false"
                >查看全部通知 →</RouterLink
              >
            </div>
          </div>
        </div>
      </header>
      <main class="workspace-content"><RouterView /></main>
    </div>
    <AgentFloatingWindow
      v-if="
        agentEnabled &&
        route.name !== 'agent' &&
        hasPermission(authStore.user?.permissions, 'skill:browse')
      "
    />
  </div>
</template>
