<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useRoute, useRouter } from 'vue-router'
import MarkdownView from '../components/MarkdownView.vue'
import { createDocumentAgentSession, getDocumentAgentJob, getDocumentAgentMessages, getDocumentAgentWikiContexts, replaceDocumentAgentWikiContexts, resolveDocumentAgentFeishu, retryDocumentAgentJob, searchDocumentAgentFeishu, sendDocumentAgentTurn, type DocumentAgentJob, type DocumentAgentMessage, type DocumentAgentSession, type FeishuDocument, type TurnMode, type WikiContext } from '../api/document-agent.api'
import { getProject, getProjectWorkflow, type Project, type ProjectStage } from '../api/projects.api'
import { getWikiDocuments } from '../api/wiki.api'
import type { WikiDocument } from '../types/skill'

const route=useRoute(),router=useRouter(),projectKey=String(route.params.projectKey||''),stageKey=String(route.params.stageKey||'').toUpperCase()
const project=ref<Project>(),stage=ref<ProjectStage>(),session=ref<DocumentAgentSession>(),messages=ref<DocumentAgentMessage[]>([]),input=ref(''),busy=ref(false),currentJob=ref<DocumentAgentJob>(),scroll=ref<HTMLElement>()
const feishuQuery=ref(''),feishuResults=ref<FeishuDocument[]>([]),selectedFeishu=ref<FeishuDocument[]>([]),feishuBusy=ref(false)
const wikiQuery=ref(''),wikiResults=ref<WikiDocument[]>([]),selectedWiki=ref<WikiContext[]>([]),wikiBusy=ref(false),wikiSaving=ref(false)
let timer:ReturnType<typeof setTimeout>|undefined
const writable=computed(()=>['IN_PROGRESS','REWORK'].includes(stage.value?.status||''))
const active=computed(()=>currentJob.value&&!['COMPLETED','FAILED','CANCELLED'].includes(currentJob.value.status))

async function load(){
  if(!projectKey||!stageKey){await router.replace({name:'not-found'});return}
  try{
    const [p,w]=await Promise.all([getProject(projectKey),getProjectWorkflow(projectKey)]);project.value=p;stage.value=w.stages.find(s=>s.stageKey===stageKey)
    if(!stage.value||!['IN_PROGRESS','REWORK','IN_REVIEW'].includes(stage.value.status)){await router.replace({name:'projects'});return}
    session.value=await createDocumentAgentSession({projectKey,stageKey,mode:'NEW',title:`${p.name}-${stageKey}`})
    selectedWiki.value=(await getDocumentAgentWikiContexts(session.value.sessionKey)).items
    await refreshMessages()
    const running=[...messages.value].reverse().find(m=>!['COMPLETED','FAILED','CANCELLED'].includes(m.status));if(running)void poll(running.jobKey)
  }catch(error:any){if([403,404].includes(error?.response?.status))await router.replace({name:'forbidden'});else MessagePlugin.error(error?.response?.data?.message||String(error))}
}
async function refreshMessages(){if(!session.value)return;messages.value=await getDocumentAgentMessages(session.value.sessionKey);await nextTick();scroll.value?.scrollTo({top:scroll.value.scrollHeight})}
async function send(mode:TurnMode='DISCUSS',documentId?:number){
  if(!session.value||!input.value.trim()||!writable.value||active.value||busy.value)return
  let title:string|undefined
  if(mode==='CREATE_ARTIFACT'){title=window.prompt('新文档标题')?.trim();if(!title)return}
  busy.value=true
  try{currentJob.value=await sendDocumentAgentTurn(session.value.sessionKey,input.value.trim(),{turnMode:mode,targetDocumentId:documentId,targetTitle:title,feishuDocuments:selectedFeishu.value.map(doc=>({docId:doc.docId,docType:doc.docType,title:doc.title}))});input.value='';await refreshMessages();void poll(currentJob.value.jobKey)}
  catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{busy.value=false}
}
async function poll(jobKey:string){
  try{currentJob.value=await getDocumentAgentJob(jobKey);await refreshMessages();if(!['COMPLETED','FAILED','CANCELLED'].includes(currentJob.value.status))timer=setTimeout(()=>void poll(jobKey),1000);else{const w=await getProjectWorkflow(projectKey);stage.value=w.stages.find(s=>s.stageKey===stageKey)}}
  catch{timer=setTimeout(()=>void poll(jobKey),2500)}
}
function update(documentId:number){void send('UPDATE_ARTIFACT',documentId)}
async function retry(jobKey:string){if(busy.value||active.value||!writable.value)return;busy.value=true;try{currentJob.value=await retryDocumentAgentJob(jobKey);await refreshMessages();void poll(jobKey)}catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{busy.value=false}}
async function searchFeishu(){
  if(!feishuQuery.value.trim())return
  if(/(?:^|\/)(?:docx|docs|sheets|wiki)\/[A-Za-z0-9_-]+/i.test(feishuQuery.value.trim())){await resolveFeishuLink();return}
  feishuBusy.value=true
  try{
    const data=await searchDocumentAgentFeishu(feishuQuery.value.trim());const result=data.result??data
    // SMS normalizes Feishu's response to `files`; accept the legacy `items`
    // shape as well so older gateway instances remain usable during rollout.
    feishuResults.value=Array.isArray(result)?result:(result.items??result.files??result.docs??[])
  }catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{feishuBusy.value=false}
}
async function resolveFeishuLink(){
  const match=feishuQuery.value.match(/(?:^|\/)(docx|docs|sheets|wiki)\/([A-Za-z0-9_-]+)/i)
  if(!match){MessagePlugin.warning('请粘贴飞书文档链接，或先输入关键词搜索');return}
  const routeType=match[1].toLowerCase()
  const docType=routeType==='wiki'?'WIKI':routeType==='docs'?'DOC':routeType==='docx'?'DOCX':'SHEET'
  feishuBusy.value=true
  try{const doc=await resolveDocumentAgentFeishu(match[2],docType);if(doc?.readable!==false)feishuResults.value=[doc,...feishuResults.value.filter(item=>item.docId!==doc.docId)]}
  catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{feishuBusy.value=false}
}
function toggleFeishu(doc:FeishuDocument){selectedFeishu.value=selectedFeishu.value.some(item=>item.docId===doc.docId)?selectedFeishu.value.filter(item=>item.docId!==doc.docId):[...selectedFeishu.value,doc]}
async function searchWiki(){wikiBusy.value=true;try{wikiResults.value=(await getWikiDocuments({keyword:wikiQuery.value.trim()||undefined,page:0,size:10})).items}catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{wikiBusy.value=false}}
function toggleWiki(doc:WikiDocument|WikiContext){const id='id' in doc?doc.id:doc.documentId;if(selectedWiki.value.some(item=>item.documentId===id))selectedWiki.value=selectedWiki.value.filter(item=>item.documentId!==id);else if(selectedWiki.value.length<10)selectedWiki.value=[...selectedWiki.value,{documentId:id,title:doc.title,documentType:doc.documentType,latestRevisionNo:'revisionNo' in doc?doc.revisionNo:doc.latestRevisionNo}];else MessagePlugin.warning('最多选择 10 份平台 Wiki')}
async function saveWiki(){if(!session.value||!writable.value)return;wikiSaving.value=true;try{selectedWiki.value=(await replaceDocumentAgentWikiContexts(session.value.sessionKey,selectedWiki.value.map(item=>item.documentId))).items;MessagePlugin.success('阶段 Wiki 上下文已保存')}catch(error:any){MessagePlugin.error(error?.response?.data?.message||String(error))}finally{wikiSaving.value=false}}
onMounted(()=>void load());onUnmounted(()=>{if(timer)clearTimeout(timer)})
</script>

<template>
  <div class="page-shell agent-page">
    <header><button @click="router.push({name:'projects'})">← 返回项目阶段</button><div><small>{{project?.name}} / {{stageKey}}</small><h1>文档 Agent 会话</h1><p>共享阶段会话 · 本阶段 Skill 白名单 · {{stage?.status}}</p></div></header>
    <div class="layout">
      <main class="chat card">
        <div ref="scroll" class="timeline">
          <div v-if="!messages.length" class="empty">先和 Agent 讨论需求。它可以反问澄清；只有点击“生成新文档”或“更新文档”才会写入产物。</div>
          <template v-for="m in messages" :key="m.jobKey">
            <article class="bubble user"><small>{{m.requestedByName}} · {{m.turnMode}}</small><p>{{m.instruction}}</p></article>
            <article class="bubble assistant"><small>OpenHands · {{m.status}}</small><MarkdownView v-if="m.assistantContent" :content="m.assistantContent"/><p v-if="m.status==='FAILED'" class="error-text">{{m.errorMessage||'本轮执行失败'}}</p><p v-else-if="!m.assistantContent" class="muted">{{m.status==='CANCELLED'?(m.errorMessage||m.status):'正在思考…'}}</p><div class="message-actions"><router-link v-if="m.artifactId" :to="{name:'project-document',params:{projectKey,documentId:m.artifactId}}">查看本轮文档产物</router-link><button v-if="m.status==='FAILED'" :disabled="busy||active||!writable" @click="retry(m.jobKey)">重试本轮</button></div></article>
          </template>
        </div>
        <div class="composer">
          <textarea v-model="input" :disabled="!writable||active" placeholder="继续讨论、回答 Agent 的问题，或描述希望生成/更新的内容" @keydown.ctrl.enter="send('DISCUSS')"/>
          <div><button :disabled="!input.trim()||!writable||active||busy" @click="send('DISCUSS')">发送消息</button><button class="primary" :disabled="!input.trim()||!writable||active||busy" @click="send('CREATE_ARTIFACT')">生成新文档</button></div>
          <p v-if="!writable" class="muted">阶段处于评审中，会话历史只读；退回重做后可继续对话。</p>
        </div>
      </main>
      <aside>
        <section class="card context-card"><h3>平台 Wiki 上下文</h3><p class="muted">保存后将授权本项目阶段成员让 Agent 按需读取。正文不会预先放入对话；每轮任务启动时固定白名单，读取时使用 Wiki 最新版本。</p><div class="context-search wiki-search"><input v-model="wikiQuery" placeholder="按标题搜索平台 Wiki" @keyup.enter="searchWiki"><button :disabled="wikiBusy" @click="searchWiki">搜索</button></div><div v-if="wikiResults.length" class="feishu-results"><button v-for="doc in wikiResults" :key="doc.id" class="feishu-option" :class="{selected:selectedWiki.some(item=>item.documentId===doc.id)}" @click="toggleWiki(doc)"><span>{{doc.title}}</span><small>{{doc.documentType}} · v{{doc.revisionNo}}</small></button></div><div v-if="selectedWiki.length" class="selected-context"><span v-for="doc in selectedWiki" :key="doc.documentId" class="tag">{{doc.title}} <button aria-label="移除平台 Wiki" :disabled="!writable" @click="toggleWiki(doc)">×</button></span></div><div class="context-actions"><span class="muted">已选择 {{selectedWiki.length}} / 10 份</span><button class="primary" :disabled="!writable||wikiSaving" @click="saveWiki">保存阶段 Wiki</button></div><p v-if="!writable" class="muted">评审中只能查看已授权的 Wiki，退回重做后才可修改。</p></section>
        <section class="card context-card"><h3>选择飞书上下文</h3><p class="muted">仅将选中的文档标识交给 SMS，OpenHands 通过 MCP 读取正文。</p><div class="context-search"><input v-model="feishuQuery" placeholder="搜索或粘贴飞书文档链接" @keyup.enter="searchFeishu"><button :disabled="feishuBusy" @click="searchFeishu">搜索</button><button :disabled="feishuBusy" @click="resolveFeishuLink">解析链接</button></div><div v-if="feishuResults.length" class="feishu-results"><button v-for="doc in feishuResults" :key="doc.docId" class="feishu-option" :class="{selected:selectedFeishu.some(item=>item.docId===doc.docId)}" :disabled="doc.readable===false" @click="toggleFeishu(doc)"><span>{{doc.title||doc.docId}}</span><small>{{doc.docType}}</small></button></div><div v-if="selectedFeishu.length" class="selected-context"><span v-for="doc in selectedFeishu" :key="doc.docId" class="tag">{{doc.title||doc.docId}} <button aria-label="移除上下文" @click="toggleFeishu(doc)">×</button></span></div><p class="muted">已选择 {{selectedFeishu.length}} 份（最多 10 份）</p></section>
        <section class="card"><h3>本阶段 Skill</h3><span v-for="s in stage?.skills" :key="s.skillKey" class="tag">{{s.displayName}} {{s.lockedVersion}}</span><p v-if="!stage?.skills.length" class="muted">未配置 Skill</p></section>
        <section class="card"><h3>阶段文档（{{stage?.artifacts.length||0}}）</h3><div v-for="a in stage?.artifacts" :key="a.documentId" class="artifact"><router-link :to="{name:'project-document',params:{projectKey,documentId:a.documentId}}">{{a.title}}</router-link><small>草稿 v{{a.revisionNo||'-'}}</small><button :disabled="!input.trim()||!writable||active" @click="update(a.documentId)">用当前消息更新</button></div><p v-if="!stage?.artifacts.length" class="muted">尚无产物，可在对话后生成。</p></section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.agent-page{display:grid;gap:16px}.agent-page header{display:flex;gap:18px;align-items:flex-start}.agent-page header h1{margin:4px 0}.agent-page header p,.agent-page header small,.muted{color:var(--text-2)}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}.card{background:var(--surface-1);backdrop-filter:blur(12px);border:1px solid var(--border-1);border-radius:14px;padding:16px}.chat{padding:0;overflow:hidden}.timeline{height:58vh;overflow:auto;padding:20px;display:grid;align-content:start;gap:10px;background:var(--surface-2)}.bubble{max-width:82%;padding:12px 14px;border-radius:13px}.bubble small{color:var(--text-2)}.bubble p{white-space:pre-wrap;margin:6px 0}.user{justify-self:end;background:var(--accent-softer)}.assistant{justify-self:start;background:var(--surface-1);border:1px solid var(--border-1)}.error-text{color:var(--error)}.message-actions{display:flex;align-items:center;gap:8px;margin-top:8px}.composer{padding:14px;border-top:1px solid var(--border-1)}.composer textarea{width:100%;min-height:88px;box-sizing:border-box;border:1px solid var(--border-1);border-radius:10px;padding:10px;resize:vertical}.composer>div{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}button{border:1px solid var(--border-1);background:var(--surface-1);border-radius:8px;padding:8px 12px;cursor:pointer}.primary{background:var(--accent-500);color:var(--text-on-accent);border-color:var(--accent-500)}.tag{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;margin:3px;background:var(--accent-softer);color:var(--accent-400);border-radius:6px}.tag button{border:0;background:transparent;padding:0;color:inherit}.context-card{display:grid;gap:8px}.context-search{display:grid;grid-template-columns:1fr auto auto;gap:6px}.context-search.wiki-search{grid-template-columns:1fr auto}.context-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.context-search input{min-width:0;border:1px solid var(--border-1);border-radius:8px;padding:8px}.feishu-results{display:grid;gap:5px;max-height:180px;overflow:auto}.feishu-option{display:flex;justify-content:space-between;text-align:left;gap:6px;width:100%;font-size:12px}.feishu-option small{color:var(--text-2)}.feishu-option.selected{border-color:var(--accent-500);background:var(--accent-softer)}.selected-context{display:flex;flex-wrap:wrap;gap:3px}.artifact{display:grid;gap:5px;padding:10px 0;border-top:1px solid var(--border-1)}.artifact small{color:var(--text-2)}.empty{text-align:center;color:var(--text-2);padding:60px 20px}@media(max-width:900px){.layout{grid-template-columns:1fr}.timeline{height:50vh}}
</style>
