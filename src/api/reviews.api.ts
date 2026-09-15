import { http } from './http'
import type { PageResponse } from '../types/skill'
import type {
  BatchReviewResult,
  ReviewStatus,
  ReviewView,
} from '../types/review'

export interface ReviewListParams {
  status?: ReviewStatus
  keyword?: string
  page: number
  size: number
  sort?: string
  scope?: 'ALL' | 'PLATFORM' | 'TEAM'
  teamId?: number
}

export async function listReviews(params: ReviewListParams) {
  const { data } = await http.get<PageResponse<ReviewView>>('/reviews', {
    params,
  })
  return data
}

export async function getReview(reviewId: number) {
  const { data } = await http.get<ReviewView>(`/reviews/${reviewId}`)
  return data
}

export async function approveReview(reviewId: number, comment: string) {
  const { data } = await http.post<ReviewView>(`/reviews/${reviewId}:approve`, {
    comment,
  })
  return data
}

export async function rejectReview(reviewId: number, comment: string) {
  const { data } = await http.post<ReviewView>(`/reviews/${reviewId}:reject`, {
    comment,
  })
  return data
}

export async function batchApproveReviews(reviewIds: number[], comment?: string) {
  const { data } = await http.post<BatchReviewResult>(
    '/reviews:batch-approve',
    { reviewIds, comment: comment || undefined },
  )
  return data
}

export async function batchRejectReviews(reviewIds: number[], comment?: string) {
  const { data } = await http.post<BatchReviewResult>(
    '/reviews:batch-reject',
    { reviewIds, comment: comment || undefined },
  )
  return data
}
