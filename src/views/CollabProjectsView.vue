<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createCollabGroup, getGroupCreationOptions, listCollabGroups, type CollabGroup } from '../api/collab-groups.api'
import type { CollabTeam } from '../api/collab-projects.api'

const router = useRouter()
const groups = ref<CollabGroup[]>([])
const teams = ref<CollabTeam[]>([])
const loading = ref(true)
const showCreate = ref(false)
const saving = ref(false)
const error = ref('')
const name = ref(''); const description = ref(''); const asdmRepositoryUrl = ref(''); const homeTeamId = ref<number | undefined>()
function msg(e: unknown) { return (e as {response?:{data?:{message?:string}}})?.response?.data?.message || (e as Error)?.message || '请求失败' }
async function load() { loading.value=true; error.value=''; try { const [list,opts]=await Promise.all([listCollabGroups(),getGroupCreationOptions()]); groups.value=list; teams.value=opts.teams } catch(e){error.value=msg(e)} finally{loading.value=false} }
function openCreate() { name.value=''; description.value=''; asdmRepositoryUrl.value=''; homeTeamId.value=teams.value[0]?.id; showCreate.value=true }
async function create() { if(!name.value.trim()||!homeTeamId.value){error.value='请填写项目组名称和归属团队';return} saving.value=true;error.value='';try{const g=await createCollabGroup({name:name.value.trim(),description:description.value.trim(),homeTeamId:homeTeamId.value,asdmRepositoryUrl:asdmRepositoryUrl.value.trim()||null});showCreate.value=false;await router.push({name:'collab-group-detail',params:{groupKey:g.groupKey}})}catch(e){error.value=msg(e)}finally{saving.value=false} }
function label(status:string){return ({DRAFT:'草稿 · 仅 Owner 可见',PUBLISHED:'已推送',ARCHIVED:'已归档'} as Record<string,string>)[status]||status}
onMounted(load)
</script>

<template>
  <main class="page">
    <header class="heading"><div><span class="eyebrow">COLLABORATION / GROUPS</span><h1>项目组</h1><p>配置协作成员与研发角色模板，再按项目组创建多条需求。</p></div><button class="primary" :disabled="!teams.length" @click="openCreate">＋ 新建项目组</button></header>
    <div v-if="error" class="error">{{error}} <button @click="error=''">关闭</button></div>
    <section class="panel"><header class="panel-head"><div><h2>我可访问的项目组</h2><span>{{groups.length}} 个</span></div><button class="quiet" @click="load">刷新</button></header>
      <div v-if="loading" class="empty">正在加载…</div>
      <div v-else-if="!groups.length" class="empty"><strong>还没有项目组</strong><span>新建草稿后配置成员、角色和研发流程，再推送给组内成员。</span><button class="primary" @click="openCreate">创建项目组</button></div>
      <div v-else class="grid"><button v-for="g in groups" :key="g.groupKey" class="group-card" @click="router.push({name:'collab-group-detail',params:{groupKey:g.groupKey}})"><div class="card-top"><span class="glyph">⌂</span><span class="status" :class="g.status.toLowerCase()">{{label(g.status)}}</span></div><h3>{{g.name}}</h3><p>{{g.description||'暂无项目组说明'}}</p><div class="meta"><span>{{g.homeTeamName||'归属团队'}}</span><span>{{g.requirementCount??0}} 条需求</span></div><div class="meta"><span>模板 v{{g.templateVersion}}</span><span>{{g.ownerName||'Owner'}}</span></div></button></div>
    </section>
    <div v-if="showCreate" class="backdrop" @click.self="showCreate=false"><section class="modal"><header><div><span class="eyebrow">NEW GROUP</span><h2>新建项目组</h2></div><button class="close" @click="showCreate=false">×</button></header><form id="group-create" @submit.prevent="create">
      <label>项目组名称 <b>*</b><input v-model="name" required maxlength="120" placeholder="例如：理赔平台研发组"></label>
      <label>归属团队 <b>*</b><t-select v-model="homeTeamId" filterable :options="teams.map(t=>({label:t.name,value:t.id}))" placeholder="搜索并选择有创建权限的团队" /></label>
      <label>ASDM GitLab 仓库地址（选填）<input v-model="asdmRepositoryUrl" type="url" maxlength="2048" placeholder="https://jihulab.com/tk4/pfss-asdm"></label><small>填写具体仓库地址。留空时项目组使用 Skill 提交模式；仓库凭证可在创建后配置。</small>
      <label>项目组说明<input v-model="description" maxlength="2000" placeholder="项目目标、范围等（选填）"></label>
    </form><footer><button class="quiet" @click="showCreate=false">取消</button><button class="primary" form="group-create" :disabled="saving">{{saving?'创建中…':'创建草稿'}}</button></footer></section></div>
  </main>
</template>

<style scoped>
.page{max-width:1240px;margin:auto;padding:38px 42px 70px;color:var(--text-1)}.heading,.panel-head{display:flex;align-items:center;justify-content:space-between}.heading{margin-bottom:30px}.eyebrow{font:700 10px var(--font-mono);letter-spacing:.16em;color:var(--accent-400)}h1{font-size:30px;margin:8px 0}.heading p{margin:0;color:var(--text-2)}.primary,.quiet{border:0;border-radius:var(--radius-sm);padding:11px 16px;cursor:pointer;font-weight:650}.primary{background:var(--accent-600);color:white}.primary:disabled{opacity:.5;cursor:not-allowed}.quiet{background:transparent;color:var(--text-2)}.panel{border:1px solid var(--border-1);background:var(--surface-1);border-radius:var(--radius-lg);padding:24px}.panel-head{margin-bottom:18px}.panel-head h2{margin:0 0 5px;font-size:17px}.panel-head span{font-size:12px;color:var(--text-3)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}.group-card{text-align:left;padding:19px;border-radius:var(--radius-md);border:1px solid var(--border-1);background:var(--surface-2);color:inherit;cursor:pointer}.group-card:hover{border-color:var(--border-accent);transform:translateY(-2px)}.card-top,.meta{display:flex;align-items:center;justify-content:space-between}.glyph{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--accent-soft);color:var(--accent-300);font-size:20px}.status{padding:5px 8px;border-radius:20px;background:var(--surface-3);font-size:10px;color:var(--text-2)}.status.published{color:var(--success)}.status.draft{color:var(--warning)}.group-card h3{font-size:18px;margin:18px 0 7px}.group-card p{height:36px;overflow:hidden;color:var(--text-2);font-size:13px;margin:0 0 18px}.meta{font-size:11px;color:var(--text-3);margin-top:9px}.empty{min-height:220px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--text-2)}.empty strong{color:var(--text-1);font-size:17px}.error{margin-bottom:14px;padding:11px;background:var(--error-soft);color:var(--error);border-radius:8px}.error button{float:right}.backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:var(--mask-bg);padding:20px}.modal{width:min(600px,100%);background:var(--surface-overlay-solid);border:1px solid var(--border-2);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl)}.modal>header,.modal>footer{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border-1)}.modal>footer{justify-content:flex-end;gap:8px;border:0;border-top:1px solid var(--border-1)}.modal h2{margin:5px 0;font-size:23px}.close{border:0;background:none;color:var(--text-2);font-size:24px;cursor:pointer}.modal form{padding:20px 22px;display:grid;gap:15px}.modal label{display:grid;gap:7px;color:var(--text-2);font-size:13px;font-weight:650}.modal b{color:var(--error)}.modal input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-2);border-radius:var(--radius-sm);background:var(--surface-2);color:var(--text-1)}.modal :deep(.t-select){width:100%}.modal small{color:var(--text-3);margin-top:-10px}@media(max-width:650px){.page{padding:25px 16px}.heading{align-items:flex-start;gap:12px}.heading h1{font-size:25px}}
</style>
