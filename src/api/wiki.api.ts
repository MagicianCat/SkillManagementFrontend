import { http } from './http'
import type { PageResponse, WikiDocument, WikiDocumentType, WikiRevision, WikiTeam } from '../types/skill'
import type { WikiReview, WikiReviewSummary, WikiReviewStatus } from '../types/review'

export interface WikiDocumentQuery {
  teamId?: number
  skillKey?: string
  documentType?: WikiDocumentType
  keyword?: string
  page?: number
  size?: number
}

export async function getWikiTeams() {
  const { data } = await http.get<WikiTeam[]>('/wiki/teams')
  return data
}

export async function searchWikiTeams(keyword = '', page = 0, size = 20) {
  const { data } = await http.get<PageResponse<WikiTeam>>('/wiki/teams/search', { params: { keyword: keyword || undefined, page, size } })
  return data
}

export async function getWikiDocuments(params: WikiDocumentQuery = {}) {
  const { data } = await http.get<PageResponse<WikiDocument>>('/wiki/documents', { params })
  return data
}

export async function getWikiDocument(id: number) {
  const { data } = await http.get<WikiDocument>(`/wiki/documents/${id}`)
  return data
}

export async function createWikiDocument(request: { title: string; documentType: WikiDocumentType; teamId?: number | null; skillIds: number[]; markdownContent: string }) {
  const { data } = await http.post<WikiDocument>('/wiki/documents', request)
  return data
}

export async function updateWikiDocument(id: number, request: { title: string; markdownContent: string; versionNo: number }) {
  const { data } = await http.put<WikiDocument>(`/wiki/documents/${id}`, request)
  return data
}

export async function getWikiRevisions(id: number) {
  const { data } = await http.get<WikiRevision[]>(`/wiki/documents/${id}/revisions`)
  return data
}

export async function restoreWikiRevision(id: number, revisionId: number, versionNo: number) {
  const { data } = await http.post<WikiDocument>(`/wiki/documents/${id}:restore`, { revisionId, versionNo })
  return data
}

export async function archiveWikiDocument(id: number) {
  await http.delete(`/wiki/documents/${id}`)
}

export async function submitWikiPlatformReview(id: number, request: { versionNo: number; comment: string }) {
  const { data } = await http.post<WikiReview>(`/wiki/documents/${id}:submit-platform-review`, request)
  return data
}

export async function listWikiReviews(params: { status?: WikiReviewStatus; keyword?: string; teamId?: number; page: number; size: number; sort?: string }) {
  const { data } = await http.get<PageResponse<WikiReviewSummary>>('/wiki-reviews', { params })
  return data
}

export async function getWikiReview(id: number) {
  const { data } = await http.get<WikiReview>(`/wiki-reviews/${id}`)
  return data
}

export async function approveWikiReview(id: number, comment: string) {
  const { data } = await http.post<WikiReview>(`/wiki-reviews/${id}:approve`, { comment })
  return data
}

export async function rejectWikiReview(id: number, comment: string) {
  const { data } = await http.post<WikiReview>(`/wiki-reviews/${id}:reject`, { comment })
  return data
}

export async function batchApproveWikiReviews(reviewIds: number[], comment: string) {
  const { data } = await http.post('/wiki-reviews:batch-approve', { reviewIds, comment })
  return data
}

export async function batchRejectWikiReviews(reviewIds: number[], comment: string) {
  const { data } = await http.post('/wiki-reviews:batch-reject', { reviewIds, comment })
  return data
}
