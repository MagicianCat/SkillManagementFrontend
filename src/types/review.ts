/** 审核任务状态，与后端 ReviewStatus 枚举一致 */
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
}

export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status] ?? status
}

/** 与后端 WorkflowService.ReviewView record 字段一一对应 */
export interface ReviewView {
  reviewId: number
  versionId: number
  skillKey: string
  skillName: string
  reviewNo: number
  status: ReviewStatus
  candidateVersion: string | null
  submitterId: number
  submitterName: string
  submittedAt: string
  reviewerId: number | null
  reviewerName: string | null
  reviewedAt: string | null
  submitComment: string
  reviewComment: string | null
  reviewScope?: 'TEAM' | 'PLATFORM'
}

export interface BatchReviewItem {
  reviewId: number
  success: boolean
  review: ReviewView | null
  errorCode: string | null
  errorMessage: string | null
}

export interface BatchReviewResult {
  total: number
  successCount: number
  failureCount: number
  items: BatchReviewItem[]
}
