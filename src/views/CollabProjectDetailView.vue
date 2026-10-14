<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addCollabMember, configureCollabWikiRoot, getCollabArtifacts, getCollabFeishuBinding, getCollabProject, getCollabTaskPrompt, getCollabWorkflow, removeCollabMember, retryCollabFeishu, searchCollabUsers, transferCollabProjectOwnership, type CollabArtifact, type CollabFeishuBinding, type CollabMember, type CollabProject, type CollabStage, type CollabUser } from '../api/collab-projects.api'
import { useAuthStore } from '../stores/auth'
import CollabWorkflowManagement from './CollabWorkflowManagement.vue'
const route = useRoute(); const router = useRouter(); const auth = useAuthStore(); const projectKey = computed(() => String(route.params.projectKey))
const project = ref<CollabProject | null>(null); const binding = ref<CollabFeishuBinding | null>(null); const bindingStatus = ref(''); const wikiUrl = ref(''); const bindingBusy = ref(false); const wikiProgress = ref(''); const stages = ref<CollabStage[]>([]); const members = ref<CollabMember[]>([]); const artifacts = ref<CollabArtifact[]>([]); const loading = ref(true); const error = ref(''); const promptBusy = ref(false); const userQuery = ref(''); const userHits = ref<CollabUser[]>([]); const actionBusy = ref(false)
const newOwnerUserId = ref<number | null>(null)
function msg(e: unknown) { return (e as {response?:{data?:{message?:string}}})?.response?.data?.message || (e as Error)?.message || '请求失败' }
async function load() { loading.value=true; error.value=''; try { const [p,w,a,b]=await Promise.all([getCollabProject(projectKey.value),getCollabWorkflow(projectKey.value),getCollabArtifacts(projectKey.value),getCollabFeishuBinding(projectKey.value)]); project.value=p; binding.value=b; bindingStatus.value=b.status; stages.value=[...w.stages].sort((x,y)=>(x.stageOrder||x.order||0)-(y.stageOrder||y.order||0)); members.value=p.members || []; newOwnerUserId.value=null; artifacts.value=a } catch(e){error.value=msg(e)} finally{loading.value=false} }
const isProjectOwner = computed(() => project.value?.ownerUserId === auth.user?.id)
function openStage(stageKey: string) { router.push({name:'collab-stage',params:{projectKey:projectKey.value,stageKey}}) }
async function configureWiki() {
  if(!wikiUrl.value.trim()) { error.value='请填写 Wiki 根节点 URL'; return }
  bindingBusy.value=true; wikiProgress.value='正在创建项目 Wiki…'
  try {
    binding.value=await configureCollabWikiRoot(projectKey.value,wikiUrl.value.trim())
    bindingStatus.value=binding.value.status
    wikiUrl.value=''
    for(let attempt=0; attempt<45; attempt++) {
      if(binding.value.wikiParentNodeToken || binding.value.lastError || binding.value.status==='RECONCILE_REQUIRED') break
      await new Promise(resolve=>window.setTimeout(resolve,2000))
      binding.value=await getCollabFeishuBinding(projectKey.value)
      bindingStatus.value=binding.value.status
    }
    if(binding.value.wikiParentNodeToken) wikiProgress.value='项目 Wiki 已创建并绑定。'
    else if(binding.value.lastError || binding.value.status==='RECONCILE_REQUIRED') wikiProgress.value='项目 Wiki 创建未完成，请查看下方错误信息。'
    else wikiProgress.value='项目 Wiki 仍在处理中；页面可稍后刷新查看结果。'
    await load()
  } catch(e){error.value=msg(e); wikiProgress.value=''} finally{bindingBusy.value=false}
}
async function retryFeishu() { bindingBusy.value=true; try { binding.value=await retryCollabFeishu(projectKey.value); await load() } catch(e){error.value=msg(e)} finally{bindingBusy.value=false} }
function bindingLabel(status: string) { return ({ACTIVE:'已连接',PENDING:'创建中',PARTIAL:'部分成员待同步',FAILED:'创建失败',RECONCILE_REQUIRED:'需要重新核对'} as Record<string,string>)[status] || status || '状态未知' }
const includedStages = computed(() => stages.value.filter(s => s.status !== 'SKIPPED'))
const progress = computed(() => project.value?.progress ?? (includedStages.value.length ? Math.round(includedStages.value.filter(s => s.status === 'COMPLETED').length / includedStages.value.length * 100) : 0))
async function copyPrompt(stage: CollabStage) { promptBusy.value=true; try { const result=await getCollabTaskPrompt(projectKey.value,stage.stageKey); await navigator.clipboard.writeText(result.prompt); window.alert('阶段任务提示词已复制') } catch(e){error.value=msg(e)} finally{promptBusy.value=false} }
async function searchUsers() { try { userHits.value=await searchCollabUsers(userQuery.value.trim()) } catch(e){error.value=msg(e)} }
async function addUser(user: CollabUser) { actionBusy.value=true; try { await addCollabMember(projectKey.value,user.id ?? user.userId); userHits.value=[]; userQuery.value=''; await load() } catch(e){error.value=msg(e)} finally{actionBusy.value=false} }
async function removeUser(user: CollabMember) { if(!window.confirm(`从项目移除 ${user.displayName}？`)) return; actionBusy.value=true; try { await removeCollabMember(projectKey.value,user.userId); await load() } catch(e){error.value=msg(e)} finally{actionBusy.value=false} }
async function transferOwnership() { if(!newOwnerUserId.value) return; const next=members.value.find(m=>m.userId===newOwnerUserId.value); if(!window.confirm(`将项目 Owner 转让给 ${next?.displayName || '所选成员'}？转让后你的 Owner 管理权限将变化。`)) return; actionBusy.value=true; error.value=''; try { project.value=await transferCollabProjectOwnership(projectKey.value,newOwnerUserId.value); await load() } catch(e){error.value=msg(e)} finally{actionBusy.value=false} }
onMounted(load)
</script>

<template><main class="collab-page"><button class="back-link" @click="router.push({name:'collab-projects'})">← 所有项目组</button><div v-if="error" class="notice">{{error}} <button @click="error=''">关闭</button></div><div v-if="loading" class="empty-state">正在加载项目…</div><template v-else-if="project"><header class="hero"><div><span class="collab-kicker">PROJECT SPACE / {{project.homeTeamName || 'COLLAB'}}</span><h1>{{project.name}}</h1><p>{{project.description || '这个项目还没有填写说明。'}}</p></div><div class="hero-actions"><button class="secondary" @click="router.push({name:'collab-project-history',params:{projectKey}})">项目历史</button><button class="primary" :disabled="promptBusy || !stages.length || project.status==='COMPLETED'" @click="copyPrompt(stages.find(s=>(s.order ?? s.stageOrder)===project?.currentStageOrder) || stages[0])">复制当前阶段提示词</button></div></header>
  <section class="overview-strip"><div><span>审批策略</span><strong>{{project.approvalLevel}} · {{project.approvalLevel==='L1'?'每阶段审批':project.approvalLevel==='L2'?'关键阶段审批':'自动流转'}}</strong></div><div><span>阶段进度</span><strong>{{progress}}% <small>{{includedStages.filter(s=>s.status==='COMPLETED').length}} / {{includedStages.length}}</small></strong></div><div><span>飞书项目群</span><strong><i :class="bindingStatus==='ACTIVE'?'online':'pending'"></i>{{bindingLabel(bindingStatus)}}</strong></div><div class="overview-progress"><div class="progress-line"><i :style="{width:`${progress}%`}"/></div><span>项目 Owner：{{project.ownerName || '我'}}</span></div></section>
  <CollabWorkflowManagement :project="project" :stages="stages" :members="members" :can-manage="isProjectOwner" @updated="load" @open-stage="openStage" />
  <section class="panel wiki-binding"><header class="panel-head"><div><h2>飞书 Wiki 发布</h2><p>项目群与文档发布配置分别管理。待处理任务：{{binding?.pendingTasks ?? 0}}</p></div><span class="count">{{binding?.wikiSpaceId ? `Space ${binding.wikiSpaceId}` : '尚未配置 Wiki'}}</span></header><p v-if="binding?.wikiParentNodeToken" class="wiki-ready">已绑定项目 Wiki 目录 {{binding.wikiParentNodeToken}}</p><p v-else-if="binding?.wikiSpaceId" class="wiki-progress">根节点已校验，项目 Wiki 目录正在创建；目录就绪后即可发布阶段产物。</p><p v-else class="wiki-empty">尚未设置 Wiki 根节点，阶段产物无法发布。请由 Owner 完成配置。</p><p v-if="wikiProgress" class="wiki-progress">{{wikiProgress}}</p><p v-if="binding?.lastError" class="wiki-error">{{binding.lastError}}</p><div v-if="isProjectOwner" class="wiki-actions"><template v-if="!binding?.wikiSpaceId"><input v-model="wikiUrl" aria-label="Wiki 根节点 URL" placeholder="粘贴飞书 Wiki 根节点链接"><button class="quiet" :disabled="bindingBusy" @click="configureWiki">{{bindingBusy?'创建中…':'绑定 Wiki 根节点'}}</button></template><button v-if="binding?.pendingTasks || ['PARTIAL','FAILED','RECONCILE_REQUIRED'].includes(bindingStatus)" class="quiet" :disabled="bindingBusy" @click="retryFeishu">重试待处理任务</button></div></section>

  <section v-if="isProjectOwner" class="owner-transfer"><div><strong>危险操作区 · 转让 Owner 管理权限</strong><p>转让后你将永久失去当前项目的 Owner 管理权限，新 Owner 将全权接管审批策略、阶段配置及权限治理。</p></div><label><span class="sr-only">选择新的项目成员接管</span><select v-model.number="newOwnerUserId"><option :value="null">选择新的项目成员接管</option><option v-for="m in members.filter(x=>x.userId!==project?.ownerUserId)" :key="'transfer-'+m.userId" :value="m.userId">{{m.displayName}}</option></select></label><button class="transfer-button" :disabled="actionBusy || !newOwnerUserId" @click="transferOwnership">转让管理权</button></section>
  <div class="content-grid">
    <aside class="side-column"><section class="panel"><header class="panel-head"><div><h2>项目成员</h2><p>{{members.length}} 位协作者</p></div></header><div class="member-list"><div v-for="m in members" :key="m.userId" class="member-row"><span class="avatar">{{m.displayName.slice(0,1)}}</span><span class="member-name">{{m.displayName}}<small>{{m.username || ''}}</small></span><span class="role-chip">{{m.projectRole==='OWNER'||m.role==='OWNER'?'Owner':'成员'}}</span><button v-if="isProjectOwner&&m.projectRole!=='OWNER'&&m.role!=='OWNER'" class="remove" :disabled="actionBusy" aria-label="移除成员" @click="removeUser(m)">×</button></div></div><div v-if="isProjectOwner" class="add-member"><input v-model="userQuery" placeholder="搜索成员账号" @keydown.enter.prevent="searchUsers"><button class="quiet" @click="searchUsers">查找</button></div><div v-if="isProjectOwner&&userHits.length" class="user-hits"><button v-for="u in userHits" :key="u.id ?? u.userId" @click="addUser(u)">＋ {{u.displayName}} <small>{{u.username}}</small></button></div></section>
      <section class="panel"><header class="panel-head"><div><h2>最近产物</h2><p>可查看已批准文档和当前待审内容</p></div></header><div v-if="!artifacts.length" class="small-empty">产物提交后会显示在这里</div><button v-for="a in artifacts.slice(0,5)" :key="a.artifactVersionId" class="artifact-row" @click="router.push({name:'collab-stage',params:{projectKey,stageKey:a.stageKey}})"><span class="doc-icon">MD</span><span><strong>{{a.title}}</strong><small>{{a.stageKey}} · v{{a.versionNo}} · 第{{a.attemptNo}}轮</small></span><em>{{a.status}}</em></button></section></aside></div></template></main></template>

<style scoped>
.collab-page{max-width:1720px;margin:0 auto;padding:30px 32px 70px;color:var(--text-1)}
.back-link{border:0;background:none;color:var(--text-2);padding:0 0 22px;cursor:pointer}
.back-link:hover{color:var(--accent-300)}
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:25px}
.collab-kicker{font:700 10px var(--font-mono);letter-spacing:.16em;color:var(--accent-400)}
.hero h1{font-size:30px;letter-spacing:-.04em;margin:9px 0}
.hero p,.panel-head p{color:var(--text-2);margin:0;font-size:13px}
.hero-actions{display:flex;gap:9px}
.primary,.secondary,.quiet{border:0;border-radius:var(--radius-sm);padding:10px 14px;cursor:pointer;font-weight:650;transition:box-shadow var(--duration-fast)}
.primary{background:linear-gradient(135deg,var(--accent-500),var(--accent-600));color:var(--text-on-accent);box-shadow:var(--shadow-accent)}
.secondary{background:var(--surface-3);color:var(--text-1)}
.quiet{background:none;color:var(--text-2)}
.quiet:hover{color:var(--text-1)}
.overview-strip{display:grid;grid-template-columns:1fr 1fr 1fr 1.5fr;align-items:center;gap:18px;border:1px solid var(--border-1);background:var(--surface-1);border-radius:var(--radius-md);padding:17px 20px;margin-bottom:18px;box-shadow:var(--inner-highlight)}
.overview-strip>div:not(.overview-progress){display:grid;gap:7px;border-right:1px solid var(--border-1)}
.overview-strip span{font-size:11px;color:var(--text-3)}
.overview-strip strong{font-size:13px}
.overview-strip small{font-size:11px;color:var(--text-3);font-weight:400}
.overview-strip i{width:7px;height:7px;display:inline-block;border-radius:50%;background:var(--warning);margin-right:7px}
.overview-strip i.online{background:var(--success)}
.progress-line{height:5px;border-radius:8px;background:var(--surface-3);overflow:hidden;margin-bottom:7px}
.progress-line i{display:block;height:100%;background:linear-gradient(90deg,var(--accent-500),var(--accent-300))}
.content-grid{display:block}.side-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;align-items:start}.side-column>.panel{height:100%;box-sizing:border-box}
.panel{border:1px solid var(--border-1);border-radius:var(--radius-md);background:var(--surface-1);padding:17px;margin-bottom:16px;box-shadow:var(--inner-highlight)}
.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
.panel-head h2{font-size:16px;margin:0 0 5px}
.count{color:var(--text-3);font:10px var(--font-mono);letter-spacing:.1em}
.member-name small,.artifact-row small{font-size:11px;color:var(--text-3)}
.member-list{display:grid}
.member-row{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--border-1)}
.avatar{width:31px;height:31px;display:grid;place-items:center;border-radius:50%;background:var(--surface-3);color:var(--text-1)}
.member-name{flex:1;font-size:12px;color:var(--text-1)}
.member-name small{display:block;margin-top:3px}
.role-chip{font-size:10px;color:var(--accent-300);background:var(--accent-soft);border-radius:var(--radius-xs);padding:4px 6px}
.remove{border:0;background:none;color:var(--text-3);cursor:pointer}
.remove:hover{color:var(--error)}
.add-member{display:flex;gap:5px;margin-top:11px}
.add-member input{min-width:0;flex:1;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius-sm);color:var(--text-1);padding:8px}
.user-hits{display:grid;max-height:140px;overflow:auto}
.user-hits button{padding:7px;border:0;border-bottom:1px solid var(--border-1);background:transparent;color:var(--text-1);text-align:left;cursor:pointer}
.user-hits button:hover{background:var(--surface-2)}
.user-hits small{color:var(--text-3);margin-left:8px}
.small-empty{color:var(--text-3);font-size:12px;padding:12px 0}
.artifact-row{display:flex;gap:9px;align-items:center;width:100%;padding:9px 0;border:0;border-top:1px solid var(--border-1);background:none;color:var(--text-1);text-align:left;cursor:pointer}
.artifact-row>span:nth-child(2){flex:1;display:grid;gap:4px}
.artifact-row strong{font-size:12px;color:var(--text-1)}
.artifact-row em{font-style:normal;font-size:9px;color:var(--text-3)}
.doc-icon{display:grid;place-items:center;width:30px;height:32px;border-radius:var(--radius-xs);background:var(--accent-soft);color:var(--accent-300);font:9px var(--font-mono)}
.notice{padding:10px;background:var(--error-soft);color:var(--error);border:1px solid rgb(248 113 113 / 35%);border-radius:var(--radius-sm);margin-bottom:12px}
.notice button{float:right;background:none;border:0;color:inherit}
.wiki-binding{margin-bottom:18px}
.wiki-ready,.wiki-empty,.wiki-progress,.wiki-error{margin:0 0 10px;font-size:12px;color:var(--text-2)}
.wiki-ready{color:var(--success)}
.wiki-progress{color:var(--accent)}
.wiki-error{color:var(--error)}
.wiki-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wiki-actions input{min-width:min(420px,100%);flex:1;background:var(--surface-2);border:1px solid var(--border-2);border-radius:var(--radius-sm);padding:9px 11px;color:var(--text-1)}
.wiki-actions input:focus{outline:none;border-color:var(--border-accent);box-shadow:0 0 0 3px var(--accent-glow)}
.owner-transfer{display:grid;grid-template-columns:minmax(300px,1fr) minmax(220px,320px) auto;align-items:center;gap:18px;margin:0 0 20px;padding:18px 22px;border:1px solid rgb(248 113 113 / 35%);border-radius:var(--radius-md);background:linear-gradient(90deg,#fff9f7 0%,#fff 85%)}
.owner-transfer strong{color:#9f3f39;font-size:14px}.owner-transfer p{max-width:820px;margin:6px 0 0;color:var(--text-3);font-size:12px;line-height:1.6}.owner-transfer select{width:100%;box-sizing:border-box;border:1px solid var(--border-2);border-radius:var(--radius-sm);padding:10px;background:var(--surface-2);color:var(--text-1)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.transfer-button{border:0;border-radius:var(--radius-sm);background:var(--error-soft);color:var(--error);border:1px solid rgb(248 113 113 / 40%);padding:9px 12px;cursor:pointer}
.transfer-button:disabled,.quiet:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:900px){.collab-page{padding:24px 18px}.hero{align-items:flex-start;flex-direction:column}.overview-strip{grid-template-columns:1fr 1fr}.overview-strip>div:nth-child(2){border:0}.side-column{grid-template-columns:1fr}.hero-actions{flex-wrap:wrap}.owner-transfer{grid-template-columns:1fr}.owner-transfer>.transfer-button{justify-self:start}}
</style>
