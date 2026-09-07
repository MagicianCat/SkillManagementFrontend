import { http } from './http'

export interface TeamView { id: number; name: string; parentId: number | null; status: string; lastSyncedAt: string | null }
export interface TeamMember { userId: number; username: string; displayName: string; membershipType: string; roles: ScopedAssignment[] }
export interface ScopedAssignment { userId: number; username: string; roleKey: string; scopeType: string; teamId: number | null; versionNo: number }
export async function getTeamTree() { const { data } = await http.get<TeamView[]>('/admin/teams/tree'); return data }
export async function getTeamMembers(teamId: number) { const { data } = await http.get<TeamMember[]>(`/admin/teams/${teamId}/members`); return data }
export async function grantTeamRole(teamId: number, userId: number, roleKey: string) { const { data } = await http.post<ScopedAssignment>(`/admin/teams/${teamId}/members/${userId}/roles`, null, { params: { roleKey } }); return data }
export async function revokeTeamRole(teamId: number, userId: number, roleKey: string) { await http.delete(`/admin/teams/${teamId}/members/${userId}/roles/${roleKey}`) }
export async function grantPlatformMaintainer(userId: number) { const { data } = await http.post<ScopedAssignment>(`/admin/platform-maintainers/${userId}`); return data }
export async function revokePlatformMaintainer(userId: number) { await http.delete(`/admin/platform-maintainers/${userId}`) }
export async function syncFeishuDirectory() { const { data } = await http.post<{ status: string; message: string }>('/admin/feishu/sync'); return data }
