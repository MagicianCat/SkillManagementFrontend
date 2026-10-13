<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCollabArtifacts, getCollabEvents, getCollabProject, type CollabArtifact, type CollabEvent, type CollabProject } from '../api/collab-projects.api'
const route=useRoute();const router=useRouter();const projectKey=computed(()=>String(route.params.projectKey));const project=ref<CollabProject|null>(null);const events=ref<CollabEvent[]>([]);const artifacts=ref<CollabArtifact[]>([]);const loading=ref(true);const error=ref('');const filter=ref('ALL')
function msg(e:unknown){return(e as {response?:{data?:{message?:string}}})?.response?.data?.message||(e as Error)?.message||'加载失败'}
const rows=computed(()=>{const merged=[...events.value.map(e=>({kind:'event' as const,time:e.createdAt,title:e.eventType,description:[e.stageKey,e.actorName,e.fromStatus&&e.toStatus?`${e.fromStatus} → ${e.toStatus}`:null,e.detail].filter(Boolean).join(' · '),id:`e-${e.id}`})),...artifacts.value.map(a=>({kind:'artifact' as const,time:a.createdAt || '',title:a.title,description:`${a.stageKey} · v${a.versionNo} · 第 ${a.attemptNo} 轮 · ${a.status}`,id:`a-${a.artifactVersionId}`}))].filter(r=>filter.value==='ALL'||(filter.value==='APPROVAL'&&r.kind==='event'&&/APPROV|REJECT|SUBMIT|DECISION/i.test(r.title))||(filter.value==='ARTIFACT'&&r.kind==='artifact'));return merged.sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime())})
async function load(){loading.value=true;error.value='';try{const[p,e,a]=await Promise.all([getCollabProject(projectKey.value),getCollabEvents(projectKey.value),getCollabArtifacts(projectKey.value)]);project.value=p;events.value=e;artifacts.value=a}catch(err){error.value=msg(err)}finally{loading.value=false}}
function fmt(value:string){return value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '时间不可用'}onMounted(load)
</script>
<template><main class="collab-page"><button class="back-link" @click="router.push({name:'collab-project-detail',params:{projectKey}})">← {{project?.name||'项目概览'}}</button><header class="history-head"><div><span class="kicker">AUDIT TRAIL</span><h1>项目历史</h1><p>项目阶段事件、产物版本和审批决策记录。</p></div><button class="secondary" @click="load">刷新</button></header><div v-if="error" class="notice">{{error}}</div><section class="history-panel"><nav class="filters"><button v-for="item in [{key:'ALL',label:'全部记录'},{key:'APPROVAL',label:'审批与提交'},{key:'ARTIFACT',label:'产物版本'}]" :key="item.key" :class="{active:filter===item.key}" @click="filter=item.key">{{item.label}}</button><span>{{rows.length}} 条</span></nav><div v-if="loading" class="empty">正在加载历史…</div><div v-else-if="!rows.length" class="empty">还没有项目事件或产物记录。</div><div v-else class="timeline"><article v-for="row in rows" :key="row.id" class="timeline-row"><span class="timeline-dot" :class="row.kind"></span><div class="timeline-copy"><strong>{{row.title}}</strong><p>{{row.description||'—'}}</p></div><time>{{fmt(row.time)}}</time></article></div></section></main></template>
<style scoped>
.collab-page{max-width:1000px;margin:auto;padding:30px 42px 70px;color:var(--text-1)}
.back-link{border:0;background:none;color:var(--text-2);padding:0 0 22px;cursor:pointer}
.back-link:hover{color:var(--accent-300)}
.history-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:22px}
.kicker{font:700 10px var(--font-mono);letter-spacing:.16em;color:var(--accent-400)}
.history-head h1{font-size:29px;letter-spacing:-.04em;margin:8px 0}
.history-head p{margin:0;color:var(--text-2);font-size:13px}
.secondary{border:0;border-radius:var(--radius-sm);background:var(--surface-3);color:var(--text-1);padding:10px 15px;cursor:pointer}
.history-panel{border:1px solid var(--border-1);background:var(--surface-1);border-radius:var(--radius-md);padding:17px;box-shadow:var(--inner-highlight)}
.filters{display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--border-1);padding-bottom:13px}
.filters button{border:0;background:transparent;color:var(--text-3);padding:8px 10px;border-radius:var(--radius-xs);cursor:pointer;font-size:12px}
.filters button.active{color:var(--accent-300);background:var(--accent-soft)}
.filters span{margin-left:auto;color:var(--text-3);font-size:11px}
.timeline{padding:8px 4px}
.timeline-row{display:grid;grid-template-columns:17px 1fr auto;gap:12px;align-items:start;padding:14px 6px;border-bottom:1px solid var(--border-1)}
.timeline-dot{width:9px;height:9px;margin-top:5px;border-radius:50%;background:var(--accent-400);box-shadow:0 0 0 4px var(--accent-glow)}
.timeline-dot.artifact{background:var(--success);box-shadow:0 0 0 4px var(--success-soft)}
.timeline-copy strong{font-size:13px;color:var(--text-1)}
.timeline-copy p{margin:5px 0 0;color:var(--text-2);font-size:11px;line-height:1.5}
.timeline-row time{color:var(--text-3);font-size:10px;white-space:nowrap}
.empty{text-align:center;color:var(--text-3);padding:55px 10px}
.notice{background:var(--error-soft);color:var(--error);border:1px solid rgb(248 113 113 / 35%);padding:11px;border-radius:var(--radius-sm);margin-bottom:12px}
@media(max-width:700px){.collab-page{padding:24px 14px}.timeline-row{grid-template-columns:14px 1fr}.timeline-row time{grid-column:2}.filters{overflow:auto}.filters button{white-space:nowrap}}
</style>
