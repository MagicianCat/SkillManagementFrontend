<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { COLLAB_STAGES, createCollabProject, getCollabCreationOptions, listCollabProjects, searchCollabUsers, type ApprovalLevel, type CollabProject, type CollabTeam, type CollabUser } from '../api/collab-projects.api'

const router = useRouter()
const auth = useAuthStore()
const rows = ref<CollabProject[]>([])
const teams = ref<CollabTeam[]>([])
const loading = ref(true)
const error = ref('')
const showCreate = ref(false)
const saving = ref(false)
const name = ref('')
const description = ref('')
const wikiRootUrl = ref('')
const homeTeamId = ref<number | undefined>()
const approvalLevel = ref<ApprovalLevel>('L1')
const query = ref('')
const users = ref<CollabUser[]>([])
const selected = ref<CollabUser[]>([])
const ownerIds = ref<Record<string, number>>({})
const reviewerIds = ref<Record<string, number | null>>({})
const includedStages = ref<Record<string, boolean>>(Object.fromEntries(COLLAB_STAGES.map(stage => [stage.key, true])))

const currentUserId = computed(() => auth.user?.id ?? 0)
const memberOptions = computed(() => {
  const all = [...selected.value]
  if (auth.user && !all.some(u => (u.id ?? u.userId) === auth.user?.id)) all.unshift({ id: auth.user.id, userId: auth.user.id, username: auth.user.username, displayName: auth.user.displayName })
  return all
})
const teamOptions = computed(() => teams.value.map(team => ({ label: team.name, value: team.id })))
const manualStages = computed(() => COLLAB_STAGES.filter(s => approvalLevel.value === 'L1' || (approvalLevel.value === 'L2' && ['PRODUCT', 'FRONTEND_CODING', 'BACKEND_CODING'].includes(s.key))))

async function load() {
  loading.value = true; error.value = ''
  try {
    const [projects, options] = await Promise.all([listCollabProjects(), getCollabCreationOptions()])
    rows.value = projects; teams.value = options.teams
  } catch (e) { error.value = message(e) } finally { loading.value = false }
}
function message(e: unknown) { return (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as Error)?.message || '请求失败，请稍后重试' }
async function findUsers() {
  if (query.value.trim().length < 1) { users.value = []; return }
  try { users.value = await searchCollabUsers(query.value.trim()) } catch (e) { error.value = message(e) }
}
function userId(user: CollabUser) { return user.id ?? user.userId }
function toggleUser(user: CollabUser) {
  const id = userId(user)
  selected.value = selected.value.some(u => userId(u) === id) ? selected.value.filter(u => userId(u) !== id) : [...selected.value, user]
}
function prepareCreate() {
  name.value = ''; description.value = ''; wikiRootUrl.value = ''; selected.value = []; ownerIds.value = {}; includedStages.value = Object.fromEntries(COLLAB_STAGES.map(stage => [stage.key, true])); reviewerIds.value = Object.fromEntries(COLLAB_STAGES.map(stage => [stage.key, currentUserId.value]))
  homeTeamId.value = teams.value[0]?.id; approvalLevel.value = 'L1'; showCreate.value = true
}
function onApprovalChange(level: ApprovalLevel) { approvalLevel.value = level; if (level === 'L1') includedStages.value = Object.fromEntries(COLLAB_STAGES.map(stage => [stage.key, true])) }
async function create() {
  if (!homeTeamId.value || !name.value.trim()) { error.value = '请选择归属团队并填写项目名称'; return }
  if (!wikiRootUrl.value.trim()) { error.value = '请配置飞书 Wiki 根节点后再创建项目'; return }
  const members = memberOptions.value
  const included = COLLAB_STAGES.filter(s => includedStages.value[s.key])
  if (!included.length) { error.value = '请至少保留一个项目阶段'; return }
  const assignments = included.map((s, i) => ({ stageKey: s.key, ownerUserId: ownerIds.value[s.key] || (i === 0 ? currentUserId.value : members[0] ? userId(members[0]) : currentUserId.value), reviewerUserId: manualStages.value.some(x => x.key === s.key) ? reviewerIds.value[s.key] ?? null : null }))
  if (members.length < 1 || assignments.some(a => !a.ownerUserId)) { error.value = '请至少选择一名成员并为每个阶段指定负责人'; return }
  if (assignments.some(a => manualStages.value.some(s => s.key === a.stageKey) && !a.reviewerUserId)) { error.value = '请为每个人工审批阶段指定项目成员作为审批人'; return }
  saving.value = true; error.value = ''
  try {
    const project = await createCollabProject({ homeTeamId: homeTeamId.value, name: name.value.trim(), description: description.value.trim(), approvalLevel: approvalLevel.value, wikiRootUrl: wikiRootUrl.value.trim(), stageAssignments: assignments, memberUserIds: members.map(userId), includedStageKeys: included.map(stage => stage.key) })
    showCreate.value = false; await router.push({ name: 'collab-project-detail', params: { projectKey: project.projectKey } })
  } catch (e) { error.value = message(e) } finally { saving.value = false }
}
function approvalLabel(level: string) { return ({ L1: '每阶段审批', L2: '关键阶段审批', L3: '自动流转' } as Record<string, string>)[level] || level }
function statusLabel(status: string) { return ({ ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档', PENDING: '待同步', FAILED: '同步异常' } as Record<string, string>)[status] || status }
onMounted(load)
</script>

<template>
  <main class="collab-page">
    <header class="collab-heading"><div><span class="collab-kicker">COLLABORATION / 01</span><h1>项目组</h1><p>以阶段交付和人工协作为核心的轻量项目空间。</p></div><button class="primary" :disabled="!teams.length" @click="prepareCreate">＋ 新建项目组</button></header>
    <div v-if="error" class="notice error">{{ error }} <button @click="error = ''">关闭</button></div>
    <section class="collab-list-card"><div class="card-title"><div><h2>我参与的项目</h2><span>{{ rows.length }} 个项目</span></div><button class="quiet" @click="load">刷新</button></div>
      <div v-if="loading" class="empty-state">正在加载项目…</div>
      <div v-else-if="!rows.length" class="empty-state"><span class="empty-mark">＋</span><strong>还没有项目组</strong><span>创建一个项目，邀请协作者并设置八个阶段的负责人。</span><button class="primary" :disabled="!teams.length" @click="prepareCreate">创建第一个项目</button></div>
      <div v-else class="project-grid"><button v-for="p in rows" :key="p.projectKey" class="project-card" @click="router.push({ name: 'collab-project-detail', params: { projectKey: p.projectKey } })"><div class="project-top"><span class="project-icon">↗</span><span class="pill">{{ statusLabel(p.status) }}</span></div><h3>{{ p.name }}</h3><p>{{ p.description || '暂无项目说明' }}</p><div class="project-meta"><span>{{ approvalLabel(p.approvalLevel) }}</span><span>{{ p.homeTeamName || '归属团队' }}</span></div><div class="progress-line"><i :style="{ width: `${p.progress ?? 0}%` }" /></div><div class="project-bottom"><span>{{ p.currentStage?.title || p.currentStage?.stageKey || '尚未开始' }}</span><span>{{ p.progress ?? 0 }}% →</span></div></button></div>
    </section>

    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false"><section class="create-modal"><header><div><span class="collab-kicker">NEW SPACE</span><h2>创建项目组</h2></div><button class="icon-button" aria-label="关闭" @click="showCreate = false">×</button></header><div class="form-scroll">
      <label>项目名称<input v-model="name" maxlength="120" placeholder="例如：知识库智能检索" /></label>
      <label>归属团队<t-select class="team-select" v-model="homeTeamId" filterable :options="teamOptions" placeholder="搜索并选择有项目创建权限的团队" /></label>
      <label>项目说明<textarea v-model="description" rows="3" placeholder="项目目标、背景和范围" /></label>
      <label>飞书 Wiki 发布根节点 <span class="required-mark">必填</span><input v-model="wikiRootUrl" required type="url" maxlength="2048" placeholder="粘贴可创建项目子目录的飞书 Wiki 链接" /><small class="field-help">创建前会校验链接权限，并在该 Wiki 下创建项目目录；后续阶段产物将发布到此处。</small></label>
      <fieldset><legend>审批策略</legend><div class="level-options"><label v-for="level in (['L1','L2','L3'] as ApprovalLevel[])" :key="level" class="level-option" :class="{ selected: approvalLevel === level }"><input :checked="approvalLevel === level" type="radio" :value="level" @change="onApprovalChange(level)" /><strong>{{ level }}</strong><span>{{ level === 'L1' ? '每阶段由指定审批人确认' : level === 'L2' ? '产品、前端和后端阶段人工审批' : '有效提交后自动推进' }}</span></label></div></fieldset>
      <label>添加成员 <div class="search-row"><input v-model="query" placeholder="按姓名或账号搜索 IAM 用户" @keydown.enter.prevent="findUsers" /><button class="secondary" @click="findUsers">搜索</button></div></label>
      <div v-if="users.length" class="user-results"><button v-for="u in users" :key="userId(u)" :class="{ picked: selected.some(s => userId(s) === userId(u)) }" @click="toggleUser(u)"><span class="avatar">{{ u.displayName.slice(0,1) }}</span><span>{{ u.displayName }}<small>{{ u.username }}</small></span><b>{{ selected.some(s => userId(s) === userId(u)) ? '已添加' : '＋' }}</b></button></div>
      <div class="selected-members"><strong>项目成员 · {{ memberOptions.length }}</strong><span v-for="u in memberOptions" :key="userId(u)" class="member-chip">{{ u.displayName }}<em v-if="userId(u) === currentUserId">Owner</em><button v-else aria-label="移除成员" @click="toggleUser(u)">×</button></span></div>
      <fieldset><legend>项目阶段及负责人</legend><p class="stage-selection-hint">L2、L3 项目可以省略不需要的阶段。阶段按原顺序推进，架构与 UI、前端与后端仍可并行。</p><div v-for="(stage, i) in COLLAB_STAGES" :key="stage.key" class="assignment-row" :class="{ omitted: !includedStages[stage.key] }"><span class="stage-index">{{ String(i+1).padStart(2,'0') }}</span><strong>{{ stage.title }}</strong><label class="stage-include"><input v-model="includedStages[stage.key]" type="checkbox" :disabled="approvalLevel === 'L1'" />纳入流程</label><template v-if="includedStages[stage.key]"><select v-model.number="ownerIds[stage.key]" :aria-label="`${stage.title}负责人`"><option :value="undefined">选择负责人（默认第一位成员）</option><option v-for="u in memberOptions" :key="userId(u)" :value="userId(u)">{{ u.displayName }}</option></select><select v-if="manualStages.some(s => s.key === stage.key)" v-model.number="reviewerIds[stage.key]" :aria-label="`${stage.title}审批人`"><option :value="null">选择审批人</option><option v-for="u in memberOptions" :key="userId(u)" :value="userId(u)">{{ u.displayName }}{{ userId(u) === currentUserId ? '（Owner）' : '' }}</option></select><span v-else class="auto-label">自动流转</span></template><span v-else class="omitted-label">创建时跳过</span></div></fieldset>
    </div><footer><button class="quiet" @click="showCreate = false">取消</button><button class="primary" :disabled="saving" @click="create">{{ saving ? '创建中…' : '创建项目组' }}</button></footer></section></div>
  </main>
</template>

<style scoped>
.collab-page{max-width:1240px;margin:0 auto;padding:38px 42px 70px;color:var(--text-1)}
.collab-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:30px}
.collab-kicker{font:700 10px/1.4 var(--font-mono);letter-spacing:.18em;color:var(--accent-400)}
.collab-heading h1,.create-modal h2{font-size:30px;letter-spacing:-.04em;margin:8px 0}
.collab-heading p{color:var(--text-2);margin:0}
.primary,.secondary,.quiet,.icon-button{border:0;border-radius:var(--radius-sm);padding:11px 16px;cursor:pointer;font-weight:650;transition:box-shadow var(--duration-fast),background var(--duration-fast)}
.primary{background:linear-gradient(135deg,var(--accent-500),var(--accent-600));color:var(--text-on-accent);box-shadow:var(--shadow-accent)}
.primary:disabled{opacity:.45;cursor:not-allowed}
.secondary{background:var(--surface-3);color:var(--text-1)}
.quiet{background:transparent;color:var(--text-2)}
.collab-list-card{border:1px solid var(--border-1);background:var(--surface-1);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--inner-highlight)}
.card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.card-title h2{font-size:17px;margin:0 0 5px}
.card-title span{font-size:12px;color:var(--text-3)}
.project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.project-card{text-align:left;padding:19px;border-radius:var(--radius-md);border:1px solid var(--border-1);background:var(--surface-2);color:inherit;cursor:pointer;transition:border-color var(--duration-fast),transform var(--duration-fast),box-shadow var(--duration-fast)}
.project-card:hover{border-color:var(--border-accent);transform:translateY(-2px);box-shadow:var(--shadow-md)}
.project-top,.project-bottom,.project-meta{display:flex;align-items:center;justify-content:space-between}
.project-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent-300);font-size:18px}
.pill{border-radius:var(--radius-full);background:var(--surface-3);color:var(--text-2);padding:5px 9px;font-size:11px}
.project-card h3{font-size:18px;margin:18px 0 7px}
.project-card>p{height:36px;overflow:hidden;color:var(--text-2);font-size:13px;margin:0 0 18px}
.project-meta,.project-bottom{font-size:11px;color:var(--text-3)}
.progress-line{height:4px;background:var(--surface-3);border-radius:9px;margin:14px 0 10px;overflow:hidden}
.progress-line i{display:block;height:100%;background:linear-gradient(90deg,var(--accent-500),var(--accent-300))}
.empty-state{min-height:220px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--text-2)}
.empty-state strong{color:var(--text-1);font-size:17px}
.empty-state button{margin-top:9px}
.empty-mark{display:grid;place-items:center;border:1px dashed var(--border-3);width:46px;height:46px;border-radius:var(--radius-md);color:var(--accent-400);font-size:25px}
.notice{margin:0 0 14px;border-radius:var(--radius-md);padding:12px 14px}
.notice.error{background:var(--error-soft);color:var(--error);border:1px solid rgb(248 113 113 / 35%)}
.notice button{float:right;background:none;border:0;color:inherit;cursor:pointer}
.modal-backdrop{position:fixed;inset:0;background:var(--mask-bg);z-index:100;display:grid;place-items:center;padding:24px}
.create-modal{width:min(820px,100%);max-height:min(92vh,950px);display:flex;flex-direction:column;background:var(--surface-overlay-solid);border:1px solid var(--border-2);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl)}
.create-modal>header,.create-modal>footer{display:flex;align-items:center;justify-content:space-between;padding:19px 24px;border-bottom:1px solid var(--border-1)}
.create-modal>footer{border-top:1px solid var(--border-1);border-bottom:0;justify-content:flex-end;gap:10px}
.create-modal h2{font-size:23px;margin:5px 0 0}
.icon-button{font-size:22px;padding:4px 10px;background:transparent;color:var(--text-2)}
.form-scroll{overflow:auto;padding:21px 24px;display:grid;gap:17px}
.form-scroll>label{display:grid;gap:8px;font-size:13px;font-weight:650;color:var(--text-2)}
.required-mark{display:inline;color:var(--error);font-size:11px;font-weight:600}.field-help{color:var(--text-3);font-size:11px;font-weight:400;line-height:1.5}
.form-scroll input:not([type=radio]),.form-scroll select,.form-scroll textarea{width:100%;box-sizing:border-box;border:1px solid var(--border-2);border-radius:var(--radius-sm);padding:10px 12px;background:var(--surface-2);color:var(--text-1);font:inherit}
.form-scroll input::placeholder,.form-scroll textarea::placeholder{color:var(--text-4)}
.form-scroll input:focus,.form-scroll select:focus,.form-scroll textarea:focus{outline:none;border-color:var(--border-accent);box-shadow:0 0 0 3px var(--accent-glow)}
.form-scroll :deep(.team-select){width:100%;font-weight:400}
.form-scroll fieldset{border:1px solid var(--border-1);border-radius:var(--radius-md);padding:12px}
.form-scroll legend{padding:0 7px;color:var(--text-2);font-size:13px;font-weight:700}
.level-options{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.level-option{padding:11px;border:1px solid var(--border-1);border-radius:var(--radius-sm);display:grid;grid-template-columns:auto 1fr;gap:5px 8px;cursor:pointer;background:var(--surface-2)}
.level-option input{accent-color:var(--accent-500)}
.level-option strong{color:var(--accent-300)}
.level-option span{grid-column:2;color:var(--text-3);font-size:11px;line-height:1.5}
.level-option.selected{border-color:var(--accent-500);background:var(--accent-softer)}
.search-row{display:flex;gap:8px}
.user-results{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:-9px}
.user-results button{display:flex;align-items:center;gap:9px;padding:8px;border:1px solid var(--border-1);background:var(--surface-2);color:var(--text-1);border-radius:var(--radius-sm);text-align:left;cursor:pointer}
.user-results button.picked{border-color:var(--accent-500)}
.user-results button>span:nth-child(2){flex:1}
.user-results small{display:block;color:var(--text-3);font-weight:400;margin-top:3px}
.user-results b{font-size:11px;color:var(--accent-300)}
.avatar{width:28px;height:28px;display:grid;place-items:center;background:var(--surface-3);border-radius:50%;color:var(--text-1)}
.selected-members{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--text-2);font-size:12px}
.selected-members strong{width:100%;color:var(--text-2)}
.member-chip{background:var(--surface-3);border-radius:var(--radius-xs);padding:5px 8px;color:var(--text-1)}
.member-chip em{font-style:normal;color:var(--accent-300);font-size:10px;margin-left:5px}
.member-chip button{border:0;background:none;color:var(--text-2);cursor:pointer}
.assignment-row{display:grid;grid-template-columns:32px 95px 100px minmax(130px,1fr) minmax(130px,1fr);gap:9px;align-items:center;margin:7px 0}
.stage-selection-hint{margin:0 0 12px;color:var(--text-3);font-size:12px;line-height:1.6}
.stage-include{display:flex;align-items:center;gap:6px;color:var(--text-3);font-size:11px;white-space:nowrap}
.stage-include input{accent-color:var(--accent-500)}
.assignment-row.omitted{opacity:.58}
.omitted-label{grid-column:4/6;color:var(--text-3);font-size:12px}
.stage-index{font:11px var(--font-mono);color:var(--accent-400)}
.assignment-row strong{font-size:12px;color:var(--text-1)}
.assignment-row select{font-size:12px!important;padding:8px!important}
.auto-label{color:var(--text-3);font-size:12px}
.assignment-row .auto-label{grid-column:4}
.create-modal fieldset:last-child{margin-bottom:2px}
@media(max-width:700px){.collab-page{padding:26px 16px}.collab-heading{align-items:flex-start;gap:15px}.collab-heading h1{font-size:25px}.collab-heading>.primary{padding:10px}.level-options{grid-template-columns:1fr}.user-results{grid-template-columns:1fr}.assignment-row{grid-template-columns:28px 78px 1fr}.assignment-row select:nth-of-type(2){grid-column:3}.assignment-row .auto-label{grid-column:3}.stage-include{grid-column:3}.omitted-label{grid-column:3}.create-modal{max-height:96vh}}
</style>
