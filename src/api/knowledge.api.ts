import { http } from './http'

export interface KnowledgeReconcileSubmission { status: 'ACCEPTED' | 'ALREADY_RUNNING' | 'QUEUE_FULL'; message: string }

export interface KnowledgeIndexStatus {
  activeDocuments: number
  indexedDocuments: number
  missingDocuments: number
  orphanedDocuments: number
}

export async function rebuildWikiVectors(): Promise<KnowledgeReconcileSubmission> {
  const { data } = await http.post<KnowledgeReconcileSubmission>('/admin/knowledge/reconcile')
  return data
}

export async function getKnowledgeIndexStatus(): Promise<KnowledgeIndexStatus> {
  const { data } = await http.get<KnowledgeIndexStatus>('/admin/knowledge/status')
  return data
}
