export type SkillStatus = 'ACTIVE' | 'ARCHIVED'
export type LifecycleStatus =
  'DRAFT' | 'REVIEWING' | 'APPROVED' | 'PUBLISHED' | 'DEPRECATED' | 'OFFLINE'

export interface SkillTag {
  id: number
  key: string
  name: string
}

export interface SkillView {
  id: number
  skillKey: string
  displayName: string
  description: string
  categoryId: number | null
  category?: {
    id: number
    key: string
    name: string
    parentId: number | null
    sortOrder: number
  } | null
  tags: SkillTag[]
  owners: Array<{
    userId: number
    username: string
    displayName: string
    ownerType: string
  }>
  status: SkillStatus
  versionNo: number
  latestPublishedVersion: string | null
  activeDraftVersionId: number | null
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
