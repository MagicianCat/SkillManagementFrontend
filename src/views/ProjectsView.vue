<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useRouter } from 'vue-router'
import { createProject, listProjectMembers, listProjects, putProjectMember, searchProjectUsers, type Project, type ProjectMember, type ProjectUser } from '../api/projects.api'

const router = useRouter()
const projects = ref<Project[]>([])
const selected = ref<Project | null>(null)
const members = ref<ProjectMember[]>([])
const busy = ref(false)
const loading = ref(true)

const newName = ref('')
const creating = ref(false)
const userQuery = ref('')
const users = ref<ProjectUser[]>([])
const selectedUser = ref<number | null>(null)

const memberCount = computed(() => members.value.length)
const canManage = computed(() => ['OWNER', 'MAINTAINER', 'ADMIN'].includes(selected.value?.role || ''))

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await listProjects()
    if (!selected.value && projects.value.length) await choose(projects.value[0])
  } finally { loading.value = false }
}
async function choose(project: Project) {
  selected.value = project
  members.value = await listProjectMembers(project.projectKey)
}
async function addProject() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  try {
    const project = await createProject(name, 'Agent 驱动研发项目组')
    newName.value = ''
    projects.value = await listProjects()
    await choose(project)
    MessagePlugin.success('项目组已创建')
  } catch (e) { MessagePlugin.error((e as any)?.response?.data?.message || String(e)) } finally { creating.value = false }
}
async function searchUsers() { users.value = await searchProjectUsers(userQuery.value.trim()) }
async function addMember() {
  if (!selected.value || !selectedUser.value) return
  busy.value = true
  try {
    if (!members.value.some((m) => m.userId === selectedUser.value)) await putProjectMember(selected.value!.projectKey, selectedUser.value!)
    members.value = await listProjectMembers(selected.value!.projectKey)
    selectedUser.value = null
    userQuery.value = ''
    users.value = []
    MessagePlugin.success('成员已加入')
  } catch (e) { MessagePlugin.error((e as any)?.response?.data?.message || String(e)) } finally { busy.value = false }
}
/** 进入项目组的 Agent 工作流（无需先填需求，需求在工作台内输入）。 */
function enterWorkspace(project: Project) { void router.push({ name: 'project-workspace', params: { projectId: project.projectKey } }) }

onMounted(() => void loadProjects())
</script>

<template>
  <main class="projects-console">
    <header class="console-head">
      <div>
        <p class="eyebrow">VIRTUAL R&amp;D TEAM</p>
        <h1>虚拟研发项目组</h1>
        <p class="sub">由 Agent 团队驱动研发；选择一个项目组进入其工作流，或新建一个项目组。</p>
      </div>
      <form class="create-box" @submit.prevent="addProject">
        <input v-model="newName" placeholder="新项目组名称" :disabled="creating" data-testid="new-project-name" />
        <button type="submit" class="primary" :disabled="creating || !newName.trim()" data-testid="create-project">{{ creating ? '创建中…' : '+ 新建项目组' }}</button>
      </form>
    </header>

    <p v-if="!loading && !projects.length" class="empty">当前没有可见项目组，可在上方新建。</p>

    <div v-else class="console-grid">
      <section class="project-list">
        <button
          v-for="project in projects"
          :key="project.projectKey"
          type="button"
          class="project-card"
          :class="{ active: selected?.projectKey === project.projectKey }"
          @click="choose(project)"
        >
          <span class="status-dot" :class="project.status === 'ACTIVE' ? 'on' : ''" />
          <span class="card-main">
            <b>{{ project.name }}</b>
            <small class="mono">{{ project.projectKey.slice(0, 8) }} · {{ project.status }}</small>
          </span>
          <span class="role-tag" v-if="project.role">{{ project.role }}</span>
        </button>
      </section>

      <section v-if="selected" class="project-detail panel">
        <header class="detail-head">
          <div>
            <h2>{{ selected.name }}</h2>
            <p class="muted mono">{{ selected.projectKey }}</p>
          </div>
          <span class="pill" :class="selected.status === 'ACTIVE' ? 'tone-success' : 'tone-info'">{{ selected.status }}</span>
        </header>

        <div class="members-block">
          <h3>项目成员 <span class="count mono">{{ memberCount }}</span></h3>
          <ul v-if="members.length" class="member-list">
            <li v-for="m in members" :key="m.userId">
              <span class="avatar">{{ m.displayName.slice(0, 1) }}</span>
              <span class="m-name">{{ m.displayName }}</span>
              <span class="m-role mono">{{ m.role }}</span>
            </li>
          </ul>
          <p v-else class="muted">暂无成员。</p>

          <div v-if="canManage" class="member-add">
            <div class="search-row">
              <input v-model="userQuery" placeholder="搜索同事姓名…" @keyup.enter="searchUsers" />
              <button type="button" class="ghost" @click="searchUsers">搜索</button>
            </div>
            <div v-if="users.length" class="pick-row">
              <select v-model="selectedUser">
                <option :value="null" disabled>选择要加入的成员</option>
                <option v-for="u in users" :key="u.userId" :value="u.userId">{{ u.displayName }}<template v-if="u.teamName"> · {{ u.teamName }}</template></option>
              </select>
              <button type="button" class="primary" :disabled="busy || !selectedUser" @click="addMember">加入</button>
            </div>
          </div>
        </div>

        <footer class="detail-foot">
          <button type="button" class="enter" data-testid="enter-workspace" @click="enterWorkspace(selected)">进入 Agent 工作流 →</button>
        </footer>
      </section>
      <section v-else class="panel placeholder">选择一个项目组查看成员与进入工作流。</section>
    </div>
  </main>
</template>

<style scoped>
.projects-console { max-width: 1120px; margin: 0 auto; padding: 20px 18px 32px; }
.console-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; flex-wrap: wrap; margin-bottom: 20px; }
.eyebrow { margin: 0; font-size: 11px; letter-spacing: 0.14em; color: var(--accent-500); font-weight: 700; }
h1 { margin: 4px 0 6px; font-size: 26px; color: var(--text-1); font-weight: 680; }
.sub { margin: 0; font-size: 13px; color: var(--text-2); }
.create-box { display: flex; gap: 8px; }
.create-box input { width: 220px; padding: 10px 12px; font-size: 13px; color: var(--text-1); background: var(--surface-2); border: 1px solid var(--border-2); border-radius: var(--radius-sm); }
.create-box input::placeholder { color: var(--text-4); }
.primary { padding: 10px 16px; font-size: 13px; color: #fff; background: var(--accent-600); border: 1px solid var(--accent-600); border-radius: var(--radius-sm); cursor: pointer; white-space: nowrap; }
.primary:hover:not(:disabled) { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.primary:disabled { opacity: 0.45; cursor: not-allowed; }
.empty { padding: 60px 0; text-align: center; color: var(--text-3); }

.console-grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
.project-list { display: grid; gap: 8px; }
.project-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-align: left; background: var(--surface-1); border: 1px solid var(--border-1); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--duration-fast), background var(--duration-fast); }
.project-card:hover { border-color: var(--border-3); background: var(--surface-2); }
.project-card.active { border-color: var(--accent-500); box-shadow: 0 0 0 1px var(--border-accent), 0 0 18px var(--accent-glow); }
.status-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--text-4); }
.status-dot.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.card-main { display: grid; gap: 3px; flex: 1; min-width: 0; }
.card-main b { font-size: 14px; color: var(--text-1); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-main small { font-size: 11px; color: var(--text-3); }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.role-tag { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-full); background: var(--accent-softer); color: var(--accent-300); border: 1px solid var(--border-accent); }

.panel { padding: 18px 20px; background: var(--surface-1); border: 1px solid var(--border-1); border-radius: var(--radius-md); box-shadow: var(--inner-highlight); }
.detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--border-1); }
.detail-head h2 { margin: 0 0 4px; font-size: 18px; color: var(--text-1); font-weight: 650; }
.muted { color: var(--text-3); font-size: 12px; margin: 0; }
.pill { font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); border: 1px solid var(--border-2); color: var(--text-2); }
.pill.tone-success { color: var(--success); border-color: rgb(52 211 153 / 40%); background: var(--success-soft); }
.pill.tone-info { color: var(--info); border-color: rgb(96 165 250 / 40%); background: var(--info-soft); }

.members-block { padding: 14px 0; }
.members-block h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 13px; letter-spacing: 0.05em; color: var(--text-2); font-weight: 600; }
.count { font-size: 11px; padding: 1px 8px; border-radius: var(--radius-full); background: var(--surface-3); color: var(--text-2); }
.member-list { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
.member-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--border-1); border-radius: var(--radius-sm); }
.avatar { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; flex: none; background: var(--accent-softer); border: 1px solid var(--border-accent); color: var(--accent-300); font-size: 12px; font-weight: 600; }
.m-name { flex: 1; font-size: 13px; color: var(--text-1); }
.m-role { font-size: 11px; color: var(--text-3); }
.member-add { display: grid; gap: 8px; padding-top: 12px; border-top: 1px dashed var(--border-1); }
.search-row, .pick-row { display: flex; gap: 8px; }
.member-add input, .member-add select { flex: 1; padding: 9px 11px; font-size: 13px; color: var(--text-1); background: var(--surface-2); border: 1px solid var(--border-2); border-radius: var(--radius-sm); }
.ghost { padding: 9px 14px; font-size: 13px; color: var(--text-1); background: var(--surface-2); border: 1px solid var(--border-2); border-radius: var(--radius-sm); cursor: pointer; }
.ghost:hover { border-color: var(--border-accent); color: var(--accent-300); }

.detail-foot { padding-top: 14px; border-top: 1px solid var(--border-1); }
.enter { width: 100%; padding: 13px; font-size: 14px; font-weight: 600; color: #fff; background: var(--accent-600); border: none; border-radius: var(--radius-sm); cursor: pointer; }
.enter:hover { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.placeholder { display: grid; place-items: center; min-height: 240px; color: var(--text-3); font-size: 13px; }
@media (max-width: 860px) { .console-grid { grid-template-columns: 1fr; } .console-head { flex-direction: column; align-items: stretch; } .create-box input { flex: 1; width: auto; } }
</style>
