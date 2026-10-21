import type { AsdmCandidateFile } from '../../api/collab-groups.api'

export const ASDM_STATUS_LABELS: Readonly<Record<string, string>>
export function asdmStatusLabel(status?: string | null): string
export function groupCandidateFiles(files?: AsdmCandidateFile[]): {
  confirmed: AsdmCandidateFile[]
  likely: AsdmCandidateFile[]
  uncertain: AsdmCandidateFile[]
  external: AsdmCandidateFile[]
  excluded: AsdmCandidateFile[]
}
export function isRetryableFile(status?: string | null): boolean
