export type NotificationType =
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'PUBLISH_SUCCEEDED'
  | 'PUBLISH_FAILED'
  | 'SKILL_DEPRECATED'
  | 'SKILL_OFFLINE'
  | 'SKILL_VERSION_UPDATED'
  | 'DIRECTORY_SYNC_SUCCEEDED'
  | 'DIRECTORY_SYNC_FAILED'

export type NotificationTargetType = 'REVIEW' | 'SKILL_VERSION' | 'BUILD_TASK' | 'FEISHU_DIRECTORY'

export interface NotificationView {
  id: number
  type: NotificationType
  title: string
  content: string
  targetType: NotificationTargetType
  targetId: number | null
  skillKey: string | null
  versionId: number | null
  readAt: string | null
  createdAt: string
}
