export type NotificationType =
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'PUBLISH_SUCCEEDED'
  | 'PUBLISH_FAILED'
  | 'SKILL_DEPRECATED'
  | 'SKILL_OFFLINE'
  | 'SKILL_VERSION_UPDATED'

export type NotificationTargetType = 'REVIEW' | 'SKILL_VERSION' | 'BUILD_TASK'

export interface NotificationView {
  id: number
  type: NotificationType
  title: string
  content: string
  targetType: NotificationTargetType
  targetId: number
  skillKey: string
  versionId: number
  readAt: string | null
  createdAt: string
}
