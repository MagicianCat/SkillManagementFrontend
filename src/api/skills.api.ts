import { http } from './http'
import type {
  LifecycleStatus,
  PageResponse,
  SkillView,
  VersionView,
} from '../types/skill'

export interface SkillListParams {
  keyword?: string
  lifecycleStatus?: LifecycleStatus
  page: number
  size: number
  sort?: string
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

export async function getSkillVersions(skillKey: string) {
  const { data } = await http.get<VersionView[]>(
    `/skills/${encodeURIComponent(skillKey)}/versions`,
  )
  return data
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
