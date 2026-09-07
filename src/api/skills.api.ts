import { http } from './http'
import type {
  CreateSkillRequest,
  DevelopmentStage,
  PageResponse,
  SkillCategory,
  SkillStatus,
  SkillView,
  UploadDraftResponse,
  VersionView,
} from '../types/skill'

export interface SkillListParams {
  keyword?: string
  developmentStage?: DevelopmentStage
  categoryId?: number
  status?: SkillStatus
  page: number
  size: number
  sort?: string
}

export async function getSkillCategories() {
  const { data } = await http.get<SkillCategory[]>('/categories')
  return data
}

export async function getSkills(params: SkillListParams) {
  const { data } = await http.get<PageResponse<SkillView>>('/skills', {
    params,
  })
  return data
}

export async function getSkill(skillKey: string) {
  const { data } = await http.get<SkillView>(
    `/skills/${encodeURIComponent(skillKey)}`,
  )
  return data
}

export async function createSkill(request: CreateSkillRequest) {
  const { data } = await http.post<SkillView>('/skills', request)
  return data
}

export interface UpdateSkillMetaRequest {
  displayName: string
  description: string
  categoryId?: number | null
  tagIds?: number[]
  developmentStage?: DevelopmentStage
  versionNo: number
}

export async function updateSkillMeta(
  skillKey: string,
  request: UpdateSkillMetaRequest,
) {
  const { data } = await http.patch<SkillView>(
    `/skills/${encodeURIComponent(skillKey)}`,
    request,
  )
  return data
}

export async function getSkillVersions(skillKey: string) {
  const { data } = await http.get<VersionView[]>(
    `/skills/${encodeURIComponent(skillKey)}/versions`,
  )
  return data
}

export async function getActiveDraft(skillKey: string) {
  const { data } = await http.get<VersionView>(
    `/skills/${encodeURIComponent(skillKey)}/draft`,
  )
  return data
}

export async function openDraft(skillKey: string) {
  const { data } = await http.post<VersionView>(
    `/skills/${encodeURIComponent(skillKey)}/draft:open`,
  )
  return data
}

export async function uploadDraftZip(
  skillKey: string,
  file: File,
  changeLog?: string,
) {
  const form = new FormData()
  form.append('file', file)
  if (changeLog) form.append('changeLog', changeLog)
  const { data } = await http.post<UploadDraftResponse>(
    `/skills/${encodeURIComponent(skillKey)}/draft:upload`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function cancelDraft(skillKey: string, versionNo: number) {
  await http.delete(`/skills/${encodeURIComponent(skillKey)}/draft`, {
    params: { versionNo },
  })
}

export async function downloadSkillVersion(
  versionId: number,
  platform: string,
  osType: string,
) {
  const response = await http.get<Blob>(
    `/skill-versions/${versionId}/download`,
    {
      params: { platform, osType },
      responseType: 'blob',
    },
  )
  return response
}
