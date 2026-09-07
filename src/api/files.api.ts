import { http } from './http'
import type { FileDiffView, FileView } from '../types/skill'

export async function getFiles(versionId: number) {
  const { data } = await http.get<FileView[]>(
    `/skill-versions/${versionId}/files`,
  )
  return data
}

export async function getFileContent(versionId: number, path: string) {
  const { data } = await http.get<string>(
    `/skill-versions/${versionId}/files/content`,
    { params: { path } },
  )
  return data
}

export async function saveFileContent(
  versionId: number,
  payload: { path: string; content: string; versionNo: number },
) {
  const { data } = await http.put<FileView[]>(
    `/skill-versions/${versionId}/files/content`,
    payload,
  )
  return data
}

export async function getDiff(versionId: number) {
  const { data } = await http.get<FileDiffView[]>(
    `/skill-versions/${versionId}/diff`,
  )
  return data
}
