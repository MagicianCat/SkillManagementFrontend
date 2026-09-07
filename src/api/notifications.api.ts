import { http } from './http'
import type { PageResponse } from '../types/skill'
import type { NotificationView } from '../types/notification'

export interface NotificationListParams {
  unreadOnly?: boolean
  page: number
  size: number
  sort?: string
}

export async function listNotifications(params: NotificationListParams) {
  const { data } = await http.get<PageResponse<NotificationView>>(
    '/notifications',
    { params },
  )
  return data
}

export async function unreadNotificationCount() {
  const { data } = await http.get<{ count: number }>(
    '/notifications/unread-count',
  )
  return data.count
}

export async function markNotificationRead(id: number) {
  const { data } = await http.patch<NotificationView>(
    `/notifications/${id}/read`,
  )
  return data
}

/**
 * 批量已读。后端暂无批量接口，前端并发调用单条已读；
 * 单条失败不阻塞其余，返回实际成功的数量。
 */
export async function markNotificationsRead(ids: number[]) {
  const results = await Promise.allSettled(ids.map((id) => markNotificationRead(id)))
  return results.filter((r) => r.status === 'fulfilled').length
}

/** 未读永远排在已读前面（优先级高于时间倒序），组内按创建时间倒序 */
export function sortNotifications<T extends { readAt: string | null; createdAt: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const aUnread = a.readAt ? 0 : 1
    const bUnread = b.readAt ? 0 : 1
    if (aUnread !== bUnread) return bUnread - aUnread
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
