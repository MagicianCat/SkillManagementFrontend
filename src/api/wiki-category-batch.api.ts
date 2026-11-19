import { http } from './http'
import type { WikiKnowledgeCategory } from '../types/skill'

export interface WikiCategoryPreview { pendingCount: number; confirmedOtherCount: number; estimatedMaxCalls: number; activeBatchId: number }
export interface WikiCategoryBatch { id: number; status: string; prompt_version: string; candidate_count: number; succeeded_count: number; failed_count: number; skipped_count: number; reviewed_count: number; created_at: string }
export interface WikiCategoryItem {
  id: number; batch_id: number; wiki_document_id: number; title: string; team_id: number | null
  source_version_no: number; input_fingerprint: string; suggested_category: WikiKnowledgeCategory | null
  selected_probability: number | null; model_key: string | null; status: string; review_category: WikiKnowledgeCategory | null
  current_category: WikiKnowledgeCategory; platform_category: WikiKnowledgeCategory | null; error_code: string | null
}
export interface WikiCategoryItemsPage { items: WikiCategoryItem[]; totalElements: number; page: number; size: number; totalPages: number }
export interface ReviewCommand { itemId: number; expectedWikiVersionNo: number; inputFingerprint: string; reviewAction: 'ACCEPT' | 'OVERRIDE' | 'KEEP_OTHER'; finalCategory: WikiKnowledgeCategory }
const base = '/admin/wiki-category'
export async function previewWikiCategoryBatch() { return (await http.get<WikiCategoryPreview>(`${base}/preview`)).data }
export async function createWikiCategoryBatch(includeConfirmedOther: boolean) { return (await http.post<{batchId: number}>(`${base}/batches`, { scope: 'ALL_OTHER', includeConfirmedOther })).data }
export async function listWikiCategoryBatches() { return (await http.get<WikiCategoryBatch[]>(`${base}/batches`)).data }
export async function getWikiCategoryBatch(id: number) { return (await http.get<WikiCategoryBatch>(`${base}/batches/${id}`)).data }
export async function getWikiCategoryItems(id: number, params: { status?: string; page?: number; size?: number }) { return (await http.get<WikiCategoryItemsPage>(`${base}/batches/${id}/items`, { params })).data }
export async function getWikiCategoryMetrics(id: number) { return (await http.get<{reviewed: number; matched: number; accuracy: number; confusion: Array<{suggested_category: string; review_category: string; sample_count: number}>}>(`${base}/batches/${id}/metrics`)).data }
export async function reviewWikiCategory(item: ReviewCommand) { return (await http.post(`${base}/items/${item.itemId}:review`, item)).data }
export async function reviewWikiCategories(id: number, items: ReviewCommand[]) { return (await http.post<Array<{itemId: number; status: string; code?: string}>>(`${base}/batches/${id}/reviews:batch`, items)).data }
export async function retryWikiCategoryBatch(id: number) { return (await http.post(`${base}/batches/${id}:retry-failed`)).data }
export async function cancelWikiCategoryBatch(id: number) { return (await http.post(`${base}/batches/${id}:cancel`)).data }
