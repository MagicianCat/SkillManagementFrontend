import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unreadNotificationCount } from '../api/notifications.api'

export const useNotificationStore = defineStore('notifications', () => {
  const unreadCount = ref(0)

  async function refresh() {
    try {
      unreadCount.value = await unreadNotificationCount()
    } catch {
      // 通知计数失败不影响当前页面操作
    }
  }

  function decrement(count = 1) {
    unreadCount.value = Math.max(0, unreadCount.value - count)
  }

  return { unreadCount, refresh, decrement }
})
