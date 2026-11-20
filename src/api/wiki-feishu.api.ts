import { http } from './http'
import type { WikiKnowledgeCategory } from '../types/skill'

export interface FeishuAccess { authorized: boolean; canBrowse: boolean; canReadDocx: boolean; canCreateDocx: boolean; canUploadFile: boolean; canDownloadFile: boolean }
export interface DriveFile { token: string; type: string; name: string; modifiedAt: string }
export interface DrivePage { items: DriveFile[]; pageToken: string; hasMore: boolean }
export interface FeishuSource { fileType: string; fileToken: string }
export interface FeishuResolved { token: string; type: string; title: string }
export interface TransferJob { id: number; direction: string; status: string; wikiDocumentId?: number; feishuOutputUrl?: string; errorCode?: string; errorMessage?: string }
export const getFeishuAccess = async () => (await http.get<FeishuAccess>('/wiki/feishu/access')).data
export const getDriveRoot = async () => (await http.get<{ folderToken: string }>('/wiki/feishu/drive/root')).data.folderToken
export const getDriveFiles = async (folderToken?: string, pageToken?: string) => (await http.get<DrivePage>('/wiki/feishu/drive/files', { params: { folderToken, pageToken } })).data
export const searchDrive = async (keyword: string) => (await http.get<unknown>('/wiki/feishu/drive/search', { params: { keyword } })).data
export const resolveFeishuUrl = async (url: string) => (await http.post<FeishuResolved>('/wiki/feishu/documents:resolve', { url })).data
export const previewFeishuSource = async (source: FeishuSource) => (await http.post<{ title: string; excerpt: string; warnings: string[] }>('/wiki/feishu/documents:preview', source)).data
export const getFeishuEditableContent = async (source: FeishuSource) => (await http.post<{ title: string; type: string; markdownContent: string; warnings: string[] }>('/wiki/feishu/documents:content', source)).data
export const startFeishuImport = async (source: FeishuSource, target: { operation: 'CREATE' | 'UPDATE'; teamId?: number | null; parentWikiId?: number | null; knowledgeCategory?: WikiKnowledgeCategory; skillIds?: number[]; wikiDocumentId?: number; expectedWikiVersionNo?: number; contentMode?: 'REPLACE' | 'APPEND' }) => (await http.post<{ jobId: number; status: string }>('/wiki/feishu/import-jobs', { source, target, idempotencyKey: crypto.randomUUID() })).data
export const startFeishuExport = async (wikiId: number, request: { format: 'DOCX' | 'MARKDOWN_FILE'; folderToken?: string; sourceRevisionNo: number; sourceAudience: 'CURRENT' | 'PLATFORM_APPROVED' }) => (await http.post<{ jobId: number; status: string }>(`/wiki/documents/${wikiId}/feishu-export-jobs`, { ...request, idempotencyKey: crypto.randomUUID() })).data
export const getFeishuJob = async (id: number) => (await http.get<TransferJob>(`/wiki/feishu/jobs/${id}`)).data
export const retryFeishuJob = async (id: number) => (await http.post<{ jobId: number; status: string }>(`/wiki/feishu/jobs/${id}:retry`)).data
