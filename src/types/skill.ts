export type SkillStatus = 'ACTIVE' | 'ARCHIVED'
export type LifecycleStatus =
  'DRAFT' | 'REVIEWING' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'OFFLINE'

/** Skill 本体开发阶段（与版本 lifecycleStatus 无关），取值与后端 DevelopmentStage 枚举一致 */
export type DevelopmentStage =
  | 'REQUIREMENT'
  | 'DESIGN'
  | 'FRONTEND_CODING'
  | 'BACKEND_CODING'
  | 'TESTING'
  | 'RELEASED'
  | 'OTHER'

export interface SkillTag {
  id: number
  key: string
  name: string
}

export interface SkillCategory {
  id: number
  key: string
  name: string
  parentId: number | null
  sortOrder: number
}

/** 开发阶段唯一文案映射（列表筛选、卡片、详情共用） */
export const DEVELOPMENT_STAGES: Array<{
  value: DevelopmentStage
  label: string
}> = [
  { value: 'REQUIREMENT', label: '需求' },
  { value: 'DESIGN', label: '设计' },
  { value: 'FRONTEND_CODING', label: '前端编码' },
  { value: 'BACKEND_CODING', label: '后端编码' },
  { value: 'TESTING', label: '测试' },
  { value: 'RELEASED', label: '已发布' },
  { value: 'OTHER', label: '其他' },
]

export function developmentStageLabel(
  stage: DevelopmentStage | null | undefined,
): string {
  return (
    DEVELOPMENT_STAGES.find((item) => item.value === stage)?.label ?? '未标记'
  )
}

export interface SkillView {
  id: number
  skillKey: string
  displayName: string
  description: string
  categoryId: number | null
  category?: SkillCategory | null
  tags: SkillTag[]
  owners: Array<{
    userId: number
    username: string
    displayName: string
    ownerType: string
  }>
  status: SkillStatus
  developmentStage: DevelopmentStage | null
  versionNo: number
  latestPublishedVersion: string | null
  activeDraftVersionId: number | null
  scopeType?: 'PLATFORM' | 'TEAM'
  teamId?: number | null
}

export interface SkillFeedback {
  id: number
  userId: number
  userName: string
  rating: number
  comment: string | null
  createdAt: string
  versionNo: number
}

export interface SkillFeedbackPage {
  averageRating: number
  ratingCount: number
  downloadCount: number
  mine: SkillFeedback | null
  items: { content: SkillFeedback[]; totalElements: number; totalPages: number }
}

export interface VersionView {
  id: number
  skillKey: string
  changeType: string
  lifecycleStatus: LifecycleStatus
  candidateVersion: string | null
  version: string | null
  sourceRevision: number
  versionNo: number
  baseVersion: string | null
  replacementVersionId: number | null
  replacementVersion: string | null
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export type FileSource = 'UPLOADED' | 'GENERATED'

export interface FileView {
  path: string
  source: FileSource
  editable: boolean
  sizeBytes: number
}

export type FileChangeType = 'ADDED' | 'MODIFIED' | 'DELETED'

/** 与后端 SkillFileService.FileDiffView record 对应；文本文件才有前后内容 */
export interface FileDiffView {
  path: string
  changeType: FileChangeType
  baseContent: string | null
  currentContent: string | null
  baseSizeBytes: number | null
  currentSizeBytes: number | null
}

export type ChangeType = 'INITIAL' | 'ONLINE_EDIT' | 'ZIP_REUPLOAD'

export interface UploadDraftResponse {
  versionId: number
  sourceRevision: number
  status: LifecycleStatus
  changeType: ChangeType
  baseVersion: string | null
  suggestedVersion: string | null
  files: FileView[]
  warnings: string[]
}

export interface SubmitReviewResponse {
  versionId: number
  candidateVersion: string | null
  changeType: ChangeType
  baseVersion: string | null
  lifecycleStatus: LifecycleStatus
  reviewId: number
}

export interface CreateSkillRequest {
  skillKey: string
  displayName: string
  description: string
  categoryId?: number | null
  ownerUserIds?: number[]
  tagIds?: number[]
  developmentStage?: DevelopmentStage
  teamId?: number | null
}
