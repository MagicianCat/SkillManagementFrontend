import { http } from './http'
import type { SubmitReviewResponse } from '../types/skill'

export interface OfflineImpact {
  publishedDependents: number
  blocked: boolean
  dependents: Array<{
    skillKey: string
    displayName: string
    versionId: number
    version: string
    lifecycleStatus: string
    versionConstraint: string
  }>
}

export async function validateVersion(versionId: number) {
  const { data } = await http.post<string[]>(
    `/skill-versions/${versionId}:validate`,
  )
  return data
}

export async function submitReview(
  versionId: number,
  payload: { versionNo: number; comment: string },
) {
  const { data } = await http.post<SubmitReviewResponse>(
    `/skill-versions/${versionId}:submit-review`,
    payload,
  )
  return data
}

export async function getOfflineImpact(versionId: number) {
  const { data } = await http.post<OfflineImpact>(
    `/skill-versions/${versionId}:offline-impact`,
  )
  return data
}

export async function takeVersionOffline(
  versionId: number,
  payload: { force: boolean; reason: string },
) {
  const { data } = await http.post(
    `/skill-versions/${versionId}:offline`,
    payload,
  )
  return data
}
