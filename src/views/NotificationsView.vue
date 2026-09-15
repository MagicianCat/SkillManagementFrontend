<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
  sortNotifications,
} from '../api/notifications.api'
import type { NotificationView } from '../types/notification'
import { notificationContent } from '../types/notification'
import type { PageResponse } from '../types/skill'
import { useNotificationStore } from '../stores/notifications'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()

const response = ref<PageResponse<NotificationView> | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const selectedIds = ref<Set<number>>(new Set())
const marking = ref(false)

const unreadOnly = computed(() => route.query.unreadOnly === 'true')
const page = computed(() => Number(route.query.page || 0))

const unreadItems = computed(
  () => response.value?.items.filter((item) => !item.readAt) ?? [],
)
// 未读永远排在已读前面（优先级高于时间倒序），组内时间倒序
const sortedItems = computed(() =>
  sortNotifications(response.value?.items ?? []),
)
const allUnreadSelected = computed(
  () =>
    unreadItems.value.length > 0 &&
    unreadItems.value.every((item) => selectedIds.value.has(item.id)),
)

async function fetchNotifications() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await listNotifications({
      page: page.value,
      size: 20,
      unreadOnly: unreadOnly.value || undefined,
      sort: 'timeCreated,desc',
    })
    selectedIds.value = new Set()
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '通知加载失败，请稍后重试')
      : '通知加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function setFilter(unread: boolean) {
  void router.push({
    query: { ...route.query, unreadOnly: unread ? 'true' : undefined, page: '0' },
  })
}

function goToPage(nextPage: number) {
  if (!response.value || nextPage < 0 || nextPage >= response.value.totalPages)
    return
  void router.push({ query: { ...route.query, page: String(nextPage) } })
}

function toggleSelect(item: NotificationView) {
  if (item.readAt) return
  const next = new Set(selectedIds.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allUnreadSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(unreadItems.value.map((item) => item.id))
  }
}

async function markSelected() {
  if (!selectedIds.value.size) return
  marking.value = true
  errorMessage.value = ''
  try {
    const succeeded = await markNotificationsRead([...selectedIds.value])
    if (succeeded < selectedIds.value.size) {
      errorMessage.value = `部分通知标记失败（成功 ${succeeded}/${selectedIds.value.size}），请重试`
    }
    await notificationStore.refresh()
    await fetchNotifications()
  } finally {
    marking.value = false
  }
}

async function markAll() {
  marking.value = true
  errorMessage.value = ''
  try {
    // 后端暂无"全部已读"接口：逐页拉取未读并批量标记
    for (;;) {
      const unreadPage = await listNotifications({
        page: 0,
        size: 50,
        unreadOnly: true,
        sort: 'timeCreated,desc',
      })
      if (!unreadPage.items.length) break
      await markNotificationsRead(unreadPage.items.map((item) => item.id))
      if (unreadPage.items.length < 50) break
    }
    await notificationStore.refresh()
    await fetchNotifications()
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '全部已读失败，请重试')
      : '全部已读失败，请重试'
    await fetchNotifications()
  } finally {
    marking.value = false
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
  if (item.targetType === 'SKILL_VERSION' && item.skillKey) {
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
    if (item.targetId) {
      void router.push({
        name: 'review-detail',
        params: { reviewId: item.targetId },
      })
    } else {
      void router.push({ name: 'reviews' })
    }
  } else if (item.targetType === 'WIKI_REVIEW') {
    if (item.targetId) {
      void router.push({
        name: 'wiki-review-detail',
        params: { reviewId: item.targetId },
      })
    } else {
      void router.push({ name: 'wiki-reviews' })
    }
  } else if (item.targetType === 'WIKI_DOCUMENT' && item.targetId) {
    void router.push({
      name: 'wiki',
      query: { documentId: String(item.targetId) },
    })
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

watch(
  () => route.query,
  () => void fetchNotifications(),
  { deep: true },
)
onMounted(fetchNotifications)
</script>

<template>
  <div class="market-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">NOTIFICATIONS</p>
        <h1>通知中心</h1>
        <p class="page-subtitle">审核结果与发布动态</p>
      </div>
      <div class="page-actions">
        <button
          class="btn-secondary"
          :disabled="marking || !selectedIds.size"
          @click="markSelected"
        >
          标记已读（{{ selectedIds.size }}）
        </button>
        <button
          class="btn-primary"
          :disabled="marking || !unreadItems.length"
          @click="markAll"
        >
          {{ marking ? '处理中…' : '全部已读' }}
        </button>
      </div>
    </div>

    <section class="market-toolbar" aria-label="通知筛选">
      <div class="status-tabs" role="tablist" aria-label="已读状态">
        <button
          class="status-tab"
          :class="{ 'is-selected': !unreadOnly }"
          @click="setFilter(false)"
        >
          全部
        </button>
        <button
          class="status-tab"
          :class="{ 'is-selected': unreadOnly }"
          @click="setFilter(true)"
        >
          仅未读
        </button>
      </div>
      <label v-if="unreadItems.length" class="select-all">
        <input
          type="checkbox"
          :checked="allUnreadSelected"
          @change="toggleSelectAll"
        />
        全选本页未读
      </label>
      <span v-if="response" class="result-count"
        >共 {{ response.totalElements }} 条</span
      >
    </section>

    <section class="notification-results" aria-live="polite">
      <div v-if="loading" class="result-state">正在加载通知…</div>
      <div v-else-if="errorMessage" class="result-state result-state--error">
        {{ errorMessage }}
      </div>
      <div v-else-if="!sortedItems.length" class="result-state">
        {{ unreadOnly ? '没有未读通知' : '暂无通知' }}
      </div>
      <template v-else>
        <article
          v-for="item in sortedItems"
          :key="item.id"
          class="notification-row"
          :class="{ 'is-unread': !item.readAt }"
        >
          <input
            v-if="!item.readAt"
            type="checkbox"
            class="notification-row__check"
            :checked="selectedIds.has(item.id)"
            @change="toggleSelect(item)"
          />
          <button class="notification-row__main" @click="openNotification(item)">
            <strong>{{ item.title }}</strong>
            <span>{{ notificationContent(item) }}</span>
            <small>{{ formatTime(item.createdAt) }}</small>
          </button>
          <span v-if="!item.readAt" class="unread-dot" title="未读"></span>
        </article>
      </template>

      <div v-if="response && response.totalPages > 1" class="pagination">
        <button :disabled="page === 0" @click="goToPage(page - 1)">
          上一页</button
        ><span>{{ page + 1 }} / {{ response.totalPages }}</span
        ><button
          :disabled="page + 1 >= response.totalPages"
          @click="goToPage(page + 1)"
        >
          下一页
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  gap: 10px;
}
.btn-primary,
.btn-secondary {
  height: 38px;
  padding: 0 16px;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.btn-primary {
  border: 0;
  color: #fff;
  background: #e86600;
}
.btn-primary:hover:not(:disabled) {
  background: #c25400;
}
.btn-primary:disabled,
.btn-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid #dfcfb8;
  color: #475569;
  background: #fff;
}
.btn-secondary:hover:not(:disabled) {
  background: #fbf6f0;
}
.status-tabs {
  display: flex;
  gap: 4px;
}
.status-tab {
  padding: 7px 12px;
  border: 0;
  border-radius: 6px;
  color: #64748b;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.status-tab:hover,
.status-tab.is-selected {
  color: #e86600;
  background: #fff1e0;
}
.select-all {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.notification-results {
  display: grid;
  gap: 8px;
}
.notification-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border: 1px solid #ece1d2;
  border-radius: 10px;
  background: #fff;
}
.notification-row.is-unread {
  border-left: 3px solid #e86600;
  background: #fff6ec;
}
.notification-row__check {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  accent-color: #e86600;
  cursor: pointer;
}
.notification-row__main {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.notification-row__main strong {
  color: #334155;
  font-size: 13px;
}
.is-unread .notification-row__main strong {
  color: #e86600;
}
.notification-row__main span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notification-row__main small {
  color: #94a3b8;
  font-size: 10px;
}
.unread-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: #e86600;
}
</style>
