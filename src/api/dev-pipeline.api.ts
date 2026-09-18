import { apiUrl } from '../config/api'

export function getDevPipelineVideoUrl(skillKey: string) {
  return apiUrl(`/dev-pipeline/videos/${encodeURIComponent(skillKey)}`)
}
