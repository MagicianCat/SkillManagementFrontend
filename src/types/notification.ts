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
  | 'FEISHU_PUBLICATION_SUCCEEDED'
  | 'FEISHU_PUBLICATION_FAILED'
  | 'CODE_GRAPH_READY'
  | 'CODE_GRAPH_FAILED'

export type NotificationTargetType = 'REVIEW' | 'WIKI_REVIEW' | 'WIKI_DOCUMENT' | 'SKILL_VERSION' | 'BUILD_TASK' | 'FEISHU_DIRECTORY' | 'WORKFLOW_STAGE' | 'CODE_GRAPH'

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
  targetData?: { projectKey?: string; runId?: string | number; stageRunId?: string | number; codeGraphJobId?: string | number; publishTaskId?: string | number; documentUrl?: string | null } | string | null
}

export function notificationContent(
  item: Pick<NotificationView, 'type' | 'content'>,
) {
  if (item.type === 'DIRECTORY_SYNC_FAILED') return '飞书通讯录同步失败，请稍后重试。'
  if (item.type === 'FEISHU_PUBLICATION_FAILED') return item.content || '飞书文档发布失败，请重试。'
  return item.content
}
