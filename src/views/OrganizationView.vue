<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { getTeamHierarchy, getTeamMembersPage, getTeamTree, grantPlatformMaintainer, grantTeamRole, revokePlatformMaintainer, revokeTeamRole, syncFeishuDirectory, type TeamMember, type TeamView } from '../api/org.api'

const authStore = useAuthStore()
const teams = ref<TeamView[]>([])
const hierarchy = ref<TeamView[]>([])
const teamKeyword = ref('')
const selectedLevelIds = ref<number[]>([])
const selected = ref<TeamView | null>(null)
const members = ref<TeamMember[]>([])
const memberKeyword = ref('')
const activeMember = ref<TeamMember | null>(null)
const selectedRole = ref('')
const roleBusy = ref(false)
const teamLoading = ref(false)
const membersLoading = ref(false)
const loading = ref(false)
const message = ref('')
const teamPage = ref(0)
const teamPageSize = ref(25)
const serverTeamTotalPages = ref(0)
const serverTeamTotalElements = ref(0)
const membersPage = ref(0)
const membersPageSize = ref(25)
const membersTotalPages = ref(0)
const membersTotalElements = ref(0)

const isSuperAdmin = computed(() => authStore.user?.permissions.includes('admin:identity') ?? false)
const canManageTeam = computed(() => isSuperAdmin.value || authStore.user?.roles.includes('TEAM_ADMIN') === true)
const roleOptions = computed(() => isSuperAdmin.value
  ? [{ key: 'TEAM_ADMIN', label: '团队管理员' }, { key: 'TEAM_MAINTAINER', label: 'Skill 维护员' }, { key: 'PROJECT_MANAGER', label: '项目管理人' }, { key: 'PLATFORM_MAINTAINER', label: '平台级 Skill 维护员' }]
  : canManageTeam.value ? [{ key: 'TEAM_MAINTAINER', label: 'Skill 维护员' }, { key: 'PROJECT_MANAGER', label: '项目管理人' }] : [])
const hierarchyById = computed(() => new Map(hierarchy.value.map((team) => [team.id, team])))
const childrenByParentId = computed(() => {
  const groups = new Map<number | null, TeamView[]>()
  for (const team of hierarchy.value) {
    const parentId = team.parentId !== null && hierarchyById.value.has(team.parentId) ? team.parentId : null
    const children = groups.get(parentId) ?? []
    children.push(team)
    groups.set(parentId, children)
  }
  return groups
})
const teamLevels = computed(() => {
  const levels: { index: number; options: { label: string; value: number }[] }[] = []
  let parentId: number | null = null
  const visited = new Set<number>()
  for (let index = 0; index <= selectedLevelIds.value.length; index += 1) {
    const children = childrenByParentId.value.get(parentId) ?? []
    if (!children.length && index > 0) break
    levels.push({ index, options: children.map((team) => ({ label: team.name, value: team.id })) })
    const selectedId: number | undefined = selectedLevelIds.value[index]
    if (selectedId === undefined || visited.has(selectedId)) break
    visited.add(selectedId)
    parentId = selectedId
  }
  return levels
})
const filteredHierarchyTeams = computed(() => {
  if (!selectedLevelIds.value.length) return []
  const keyword = teamKeyword.value.trim().toLocaleLowerCase()
  return hierarchy.value.filter((team) => {
    const path = selectedTeamPath(team)
    return team.manageable !== false
      && selectedLevelIds.value.every((id, index) => path[index]?.id === id)
      && (!keyword || team.name.toLocaleLowerCase().includes(keyword))
  })
})
const teamTotalElements = computed(() => selectedLevelIds.value.length ? filteredHierarchyTeams.value.length : serverTeamTotalElements.value)
const teamTotalPages = computed(() => selectedLevelIds.value.length ? Math.ceil(filteredHierarchyTeams.value.length / teamPageSize.value) : serverTeamTotalPages.value)
const visibleTeams = computed(() => selectedLevelIds.value.length
  ? filteredHierarchyTeams.value.slice(teamPage.value * teamPageSize.value, (teamPage.value + 1) * teamPageSize.value)
  : teams.value)

function roleLabel(role: string) { return ({ TEAM_ADMIN: '团队管理员', TEAM_MAINTAINER: 'Skill 维护员', PROJECT_MANAGER: '项目管理人', PLATFORM_MAINTAINER: '平台级 Skill 维护员' } as Record<string, string>)[role] ?? role }
function roleText(role: TeamMember['roles'][number]) { return role.teamId ? `${roleLabel(role.roleKey)} · 本团队` : roleLabel(role.roleKey) }
let teamRequestVersion = 0
let memberRequestVersion = 0
async function loadTeams(page = 0, resetSelection = false) {
  const requestVersion = ++teamRequestVersion
  teamLoading.value = true
  try {
    const result = await getTeamTree(page, teamPageSize.value, teamKeyword.value.trim())
    if (requestVersion !== teamRequestVersion) return
    teams.value = result.items
    teamPage.value = result.page
    serverTeamTotalPages.value = result.totalPages
    serverTeamTotalElements.value = result.totalElements
    if (resetSelection || (!selected.value && teams.value.length)) {
      if (teams.value.length) { selected.value = teams.value[0]; await loadMembers(0) }
      else { selected.value = null; clearMembers() }
    }
  } catch (error) { if (requestVersion === teamRequestVersion) message.value = error instanceof Error ? error.message : '团队加载失败' }
  finally { if (requestVersion === teamRequestVersion) teamLoading.value = false }
}
function selectedTeamPath(team: TeamView) {
  const path: TeamView[] = [team]
  let parentId = team.parentId
  const visited = new Set([team.id])
  while (parentId != null && !visited.has(parentId)) {
    const parent = hierarchyById.value.get(parentId)
    if (!parent) break
    path.unshift(parent)
    visited.add(parent.id)
    parentId = parent.parentId
  }
  return path
}
function clearMembers() { memberRequestVersion += 1; membersLoading.value = false; members.value = []; membersPage.value = 0; membersTotalPages.value = 0; membersTotalElements.value = 0 }
function applyLevelSelection(index: number, value: number | null) {
  selectedLevelIds.value = value == null
    ? selectedLevelIds.value.slice(0, index)
    : [...selectedLevelIds.value.slice(0, index), value]
  teamPage.value = 0
  const id = selectedLevelIds.value.at(-1)
  if (id == null) { selected.value = null; clearMembers(); void loadTeams(0, true); return }
  const team = hierarchyById.value.get(id)
  if (team) {
    selected.value = team.manageable !== false ? team : null
    memberKeyword.value = ''
    if (team.manageable !== false) void loadMembers(0)
    else clearMembers()
  }
}
function changeTeamPage(page: number) {
  if (selectedLevelIds.value.length) teamPage.value = page
  else void loadTeams(page)
}
function changeTeamPageSize() { changeTeamPage(0) }
async function loadMembers(page = 0) {
  if (!selected.value) return
  const teamId = selected.value.id
  const requestVersion = ++memberRequestVersion
  message.value = ''
  membersLoading.value = true
  try {
    const result = await getTeamMembersPage(teamId, page, membersPageSize.value, memberKeyword.value.trim())
    if (requestVersion !== memberRequestVersion || selected.value?.id !== teamId) return
    members.value = result.items
    membersPage.value = result.page
    membersTotalPages.value = result.totalPages
    membersTotalElements.value = result.totalElements
  } catch (error) { if (requestVersion === memberRequestVersion) message.value = error instanceof Error ? error.message : '成员加载失败' }
  finally { if (requestVersion === memberRequestVersion) membersLoading.value = false }
}
async function select(team: TeamView) {
  selected.value = team.manageable !== false ? team : null
  selectedLevelIds.value = selectedTeamPath(team).map((part) => part.id)
  teamPage.value = 0
  memberKeyword.value = ''
  if (team.manageable !== false) await loadMembers(0)
  else clearMembers()
}
function openMember(member: TeamMember) { activeMember.value = member; selectedRole.value = '' }
async function grantRole() { if (!selected.value || !activeMember.value || !selectedRole.value) return; const userId = activeMember.value.userId; roleBusy.value = true; try { if (selectedRole.value === 'PLATFORM_MAINTAINER') await grantPlatformMaintainer(userId); else await grantTeamRole(selected.value.id, userId, selectedRole.value); message.value = '角色授予成功'; await loadMembers(membersPage.value); activeMember.value = members.value.find((member) => member.userId === userId) ?? null; selectedRole.value = '' } catch (error) { message.value = error instanceof Error ? error.message : '角色授予失败' } finally { roleBusy.value = false } }
async function revokeRole(role: TeamMember['roles'][number]) { if (!selected.value || !activeMember.value || !window.confirm(`确认撤销“${roleLabel(role.roleKey)}”吗？`)) return; const userId = activeMember.value.userId; roleBusy.value = true; try { if (role.roleKey === 'PLATFORM_MAINTAINER') await revokePlatformMaintainer(userId); else await revokeTeamRole(selected.value.id, userId, role.roleKey); message.value = '角色已撤销'; await loadMembers(membersPage.value); activeMember.value = members.value.find((member) => member.userId === userId) ?? null } catch (error) { message.value = error instanceof Error ? error.message : '角色撤销失败' } finally { roleBusy.value = false } }
async function sync() { loading.value = true; message.value = ''; try { const result = await syncFeishuDirectory(); message.value = result.message; } catch (error) { message.value = error instanceof Error ? error.message : '同步任务提交失败' } finally { loading.value = false } }
let teamSearchTimer: ReturnType<typeof setTimeout> | undefined
let memberSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(teamKeyword, () => { if (teamSearchTimer) clearTimeout(teamSearchTimer); teamSearchTimer = setTimeout(() => { if (selectedLevelIds.value.length) teamPage.value = 0; else void loadTeams(0, true) }, 300) })
watch(memberKeyword, () => { if (memberSearchTimer) clearTimeout(memberSearchTimer); memberSearchTimer = setTimeout(() => void loadMembers(0), 300) })
onMounted(async () => {
  try { hierarchy.value = await getTeamHierarchy() } catch { /* Paginated listing remains available if hierarchy loading fails. */ }
  await loadTeams(0, true)
})
</script>
<template>
  <main class="org-page">
    <header>
      <div><p class="eyebrow">ORGANIZATION</p><h1>组织与团队权限</h1><p>从飞书同步团队树和成员，为团队分配 Skill 管理角色。</p></div>
      <button class="primary" :disabled="loading" @click="sync">{{ loading ? '任务提交中…' : '同步飞书通讯录' }}</button>
    </header>
    <p v-if="message" class="notice" role="status">{{ message }}</p>
    <section class="org-grid">
      <aside class="panel">
        <div class="panel-heading"><h2>团队</h2><span>{{ teamTotalElements }} 个</span></div>
        <div class="team-level-filters">
          <label v-for="level in teamLevels" :key="level.index">
            {{ level.index + 1 }} 级部门
            <t-select :value="selectedLevelIds[level.index] ?? null" filterable clearable :options="level.options" :placeholder="`搜索${level.index + 1}级部门`" @change="applyLevelSelection(level.index, $event as number | null)" />
          </label>
        </div>
        <input v-model="teamKeyword" class="team-search" type="search" placeholder="搜索团队名称" aria-label="搜索团队名称" />
        <div class="paged-list" :aria-busy="teamLoading">
          <p v-if="teamLoading" class="muted">正在加载团队…</p>
          <template v-else>
            <button v-for="team in visibleTeams" :key="team.id" class="team-row" :class="{ active: selected?.id === team.id }" @click="select(team)">
              <span>{{ selectedTeamPath(team).map((part) => part.name).join(' / ') }}</span><small>{{ team.manageable === false ? '仅导航' : team.status }}</small>
            </button>
            <p v-if="!visibleTeams.length" class="muted">{{ teamKeyword ? '未找到匹配团队' : '该级别暂无团队' }}</p>
          </template>
        </div>
        <div v-if="teamTotalPages > 1" class="pagination">
          <button :disabled="teamLoading || teamPage === 0" @click="changeTeamPage(teamPage - 1)">上一页</button>
          <span>{{ teamPage + 1 }} / {{ teamTotalPages }}</span>
          <button :disabled="teamLoading || teamPage + 1 >= teamTotalPages" @click="changeTeamPage(teamPage + 1)">下一页</button>
        </div>
        <label class="page-size">每页显示<select v-model.number="teamPageSize" @change="changeTeamPageSize"><option :value="25">25</option><option :value="50">50</option></select>个团队</label>
      </aside>
      <section class="panel">
        <div class="panel-heading"><h2>{{ selected ? `${selectedTeamPath(selected).map((part) => part.name).join(' / ')} · 成员` : '选择团队查看成员' }}</h2><span>{{ membersTotalElements }} 人</span></div>
        <input v-if="selected" v-model="memberKeyword" class="team-search member-search" type="search" placeholder="搜索姓名或用户名" aria-label="搜索成员姓名或用户名" />
        <div class="paged-list member-list" :aria-busy="membersLoading">
          <p v-if="membersLoading" class="muted">正在加载成员…</p>
          <template v-else>
            <div v-for="member in members" :key="member.userId" class="member-row">
              <div><strong>{{ member.displayName }}</strong><small>{{ member.username }}</small><div class="role-tags"><span v-for="role in member.roles" :key="`${role.scopeType}-${role.roleKey}-${role.teamId}`" class="role-tag">{{ roleText(role) }}</span><span v-if="!member.roles.length" class="muted">暂无特殊角色</span></div></div>
              <div class="member-actions"><span>{{ member.membershipType }}</span><button v-if="canManageTeam" class="link-button" @click="openMember(member)">管理权限</button></div>
            </div>
            <p v-if="selected && !members.length" class="muted">{{ memberKeyword ? '没有匹配的成员' : '该团队暂无直属成员' }}</p>
            <p v-if="!selected" class="muted">{{ selectedLevelIds.length && hierarchyById.get(selectedLevelIds.at(-1)!)?.manageable === false ? '当前上级部门仅用于导航，请继续选择有管理权限的下级团队' : '选择团队查看成员' }}</p>
          </template>
        </div>
        <div v-if="membersTotalPages > 1" class="pagination">
          <button :disabled="membersLoading || membersPage === 0" @click="loadMembers(membersPage - 1)">上一页</button>
          <span>{{ membersPage + 1 }} / {{ membersTotalPages }}</span>
          <button :disabled="membersLoading || membersPage + 1 >= membersTotalPages" @click="loadMembers(membersPage + 1)">下一页</button>
        </div>
        <label class="page-size">每页显示<select v-model.number="membersPageSize" @change="loadMembers(0)"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select>人</label>
      </section>
    </section>
  </main>
  <div v-if="activeMember" class="modal-mask" @click.self="activeMember = null">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title">
      <button class="modal-close" aria-label="关闭" @click="activeMember = null">×</button>
      <p class="eyebrow">ROLE MANAGEMENT</p><h2 id="role-dialog-title">{{ activeMember.displayName }} 的权限</h2><p class="muted">{{ activeMember.username }}</p><h3>当前角色</h3>
      <div v-if="activeMember.roles.length" class="current-roles"><div v-for="role in activeMember.roles" :key="`${role.scopeType}-${role.roleKey}-${role.teamId}`" class="current-role"><span>{{ roleText(role) }}</span><button class="link-button danger" :disabled="roleBusy" @click="revokeRole(role)">撤销</button></div></div>
      <p v-else class="muted">暂无特殊角色</p>
      <div v-if="roleOptions.length" class="grant-row"><select v-model="selectedRole" aria-label="选择要授予的角色"><option value="">选择要授予的角色</option><option v-for="role in roleOptions" :key="role.key" :value="role.key">{{ role.label }}</option></select><button class="primary" :disabled="roleBusy || !selectedRole" @click="grantRole">{{ roleBusy ? '处理中…' : '授予角色' }}</button></div>
    </section>
  </div>
</template>
<style scoped>
.role-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.role-tag{background:var(--accent-softer);color:var(--accent-300);border-radius:999px;padding:3px 8px;font-size:12px}.member-actions{display:flex;align-items:center;gap:14px;white-space:nowrap}.link-button{border:0;background:transparent;color:var(--accent-300);cursor:pointer}.link-button.danger{color:var(--error)}.modal-mask{position:fixed;inset:0;background:var(--mask-bg);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px;z-index:20}.modal{position:relative;background:var(--surface-overlay);backdrop-filter:blur(20px) saturate(140%);border:1px solid var(--border-2);border-radius:18px;padding:28px;max-width:520px;width:100%;box-shadow:var(--shadow-lg),var(--inner-highlight)}.modal-close{position:absolute;right:18px;top:14px;border:0;background:transparent;font-size:26px;color:var(--text-2);cursor:pointer}.modal h2{margin:8px 0 4px}.modal h3{margin:24px 0 10px}.current-roles{display:grid;gap:8px}.current-role{display:flex;justify-content:space-between;align-items:center;background:var(--surface-2);border-radius:10px;padding:10px 12px}.grant-row{display:flex;gap:10px;margin-top:22px}.grant-row select{flex:1;border:1px solid var(--border-1);border-radius:8px;padding:10px;background:var(--surface-1)}
.org-page{padding:40px;max-width:1180px;margin:auto}.org-page header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.eyebrow{letter-spacing:.16em;font-size:12px;color:var(--text-3)}h1{margin:8px 0;font-size:34px}.org-grid{display:grid;grid-template-columns:270px minmax(0,1fr);gap:20px;margin-top:28px}.panel{background:var(--surface-1);backdrop-filter:blur(12px);border:1px solid var(--border-1);border-radius:18px;padding:22px;min-height:260px;min-width:0}.team-row{display:flex;width:100%;justify-content:space-between;gap:8px;border:0;background:transparent;padding:12px;border-radius:10px;text-align:left;cursor:pointer}.team-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.team-row.active{background:var(--accent-softer);color:var(--accent-300)}.team-row small,.member-row small{display:block;color:var(--text-3);font-size:12px}.member-row{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--border-1)}.member-row>div:first-child{min-width:0}.member-actions{flex-shrink:0}.primary{background:var(--accent-500);color:var(--text-on-accent);border:0;border-radius:10px;padding:11px 16px;cursor:pointer}.primary:disabled{opacity:.6}.notice{background:var(--success-soft);padding:12px;border-radius:10px}.muted{color:var(--text-3)}@media(max-width:760px){.org-page{padding:20px}.org-page header{display:block}.org-grid{grid-template-columns:1fr}}
.team-search{box-sizing:border-box;width:100%;margin:8px 0 10px;padding:9px 10px;border:1px solid var(--border-1);border-radius:8px;color:var(--text-1);background:var(--surface-1);font:inherit;font-size:13px;outline:none}.team-search:focus{border-color:var(--accent-500)}
.team-level-filters{display:grid;gap:8px;margin-top:12px}.team-level-filters label{display:grid;gap:4px;color:var(--text-3);font-size:11px}.team-level-filters :deep(.t-select){width:100%;min-width:0}.team-level-filters :deep(.t-input){font-size:12px}.team-row{font-size:12px}.pagination{display:flex;justify-content:space-between;align-items:center;gap:5px;font-size:12px}.pagination button{padding:5px 7px;font-size:11px}.page-size{font-size:11px;gap:5px}.page-size select{font-size:11px;padding:4px}
</style>
