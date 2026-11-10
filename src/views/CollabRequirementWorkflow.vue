<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Background } from '@vue-flow/background'
import { Handle, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { layoutGraph } from '../features/workbench/dagLayout'
import { COLLAB_STAGES, type ApprovalLevel, type CollabStage } from '../api/collab-projects.api'
import { asdmStatusLabel } from '../features/asdm/asdm-view-model.js'

const props=defineProps<{ stages:CollabStage[]; mode?:'requirement'|'template'; approvalLevel?:ApprovalLevel }>()
const emit=defineEmits<{openStage:[stageKey:string]}>()
const order=COLLAB_STAGES.map(s=>s.key);const links=[['REQUIREMENT','PRODUCT'],['PRODUCT','ARCHITECTURE_DESIGN'],['PRODUCT','UI_DESIGN'],['ARCHITECTURE_DESIGN','BACKEND_CODING'],['UI_DESIGN','FRONTEND_CODING'],['BACKEND_CODING','TESTING'],['FRONTEND_CODING','TESTING'],['TESTING','ACCEPTANCE']]
type Node={id:string;position:{x:number;y:number};data:Record<string,unknown>;class?:string};type Edge={id:string;source:string;target:string;type:string;sourceHandle:string;targetHandle:string;class:string}
const nodes=ref<Node[]>([]);const edges=ref<Edge[]>([]);const byKey=computed(()=>new Map(props.stages.map(s=>[s.stageKey,s])));const {fitView}=useVueFlow()
function tone(status:string){return status==='COMPLETED'?'success':['IN_PROGRESS','PENDING_APPROVAL','REJECTED','READY_BLOCKED'].includes(status)?'warning':status==='SKIPPED'?'muted':'info'}
function subtitle(s:CollabStage|undefined){if(!s)return '未纳入模板';if(s.status==='SKIPPED')return '未纳入流程';const reviewerAssigned=s.reviewerRoleActors?s.reviewerRoleActors.some(role=>role.userIds.length>0):Boolean(s.reviewerUserIds?.length||s.reviewerUserId||s.additionalReviewerUserIds?.length);const auto=props.mode!=='template'&&(props.approvalLevel==='L3'||props.approvalLevel==='L2'&&!reviewerAssigned);const roles=`负责人：${s.ownerRoleName||'未配置'} · ${auto?'无需审批 · 自动流转':`审批：${s.reviewerRoleNames?.join('、')||s.reviewerRoleName||'自动流转'}`}`;const flow=s.status==='READY_BLOCKED'?`待补齐人员 · 补齐后自动启动 · ${roles}`:roles;return s.asdmStatus?`${flow} · ${asdmStatusLabel(s.asdmStatus)}`:flow}
async function render(){try{const ns=order.map(id=>({id,width:232,height:92}));const es=links.map((l,i)=>({id:`e${i}`,source:l[0],target:l[1]}));const pos=await layoutGraph(ns,es,{layerGap:64,nodeGap:30,padding:20});nodes.value=order.map((key,i)=>{const s=byKey.value.get(key);return{id:key,position:pos[key]||{x:0,y:0},data:{title:`${String((s?.stageOrder||s?.order||i+1)).padStart(2,'0')} ${s?.title||COLLAB_STAGES[i]?.title||key}`,sub:subtitle(s),tone:tone(s?.status||'SKIPPED')},class:`flow-node flow-${tone(s?.status||'SKIPPED')}`}});edges.value=es.map(e=>({id:e.id,source:e.source,target:e.target,type:'default',sourceHandle:'out',targetHandle:'in',class:'flow-edge'}));await nextTick();await fitView({padding:.12,includeHiddenNodes:true})}catch{nodes.value=[];edges.value=[]}}
function open(e:{node:{id:string}}){emit('openStage',e.node.id)}
watch(()=>props.stages,render,{deep:true});onMounted(render)
</script>

<template><section class="workflow"><header><div><h2>{{mode==='template'?'研发流程模板':'需求研发流程'}}</h2><p>{{mode==='template'?'节点展示阶段关联的角色；点击节点可跳转到下方配置。':'点击阶段查看详情；人员和流程开关在下方阶段清单中调整。'}}</p></div><div class="legend"><template v-if="mode==='template'"><span><i class="blue"/>默认纳入</span><span><i class="gray"/>未纳入</span></template><template v-else><span><i class="green"/>已归档</span><span><i class="yellow"/>进行中</span><span><i class="blue"/>待开始</span><span><i class="gray"/>跳过</span></template></div></header><div class="canvas"><VueFlow :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false" :zoom-on-scroll="false" :pan-on-drag="false" fit-view-on-init @node-click="open"><Background :gap="22" pattern-color="var(--border-2)"/><template #node-default="{data}"><div class="card" :class="'tone-'+data.tone"><Handle id="in" type="target" :position="Position.Left"/><Handle id="out" type="source" :position="Position.Right"/><strong>{{data.title}}</strong><small>{{data.sub}}</small></div></template></VueFlow></div></section></template>

<style scoped>
.workflow { overflow: hidden; border: 1px solid var(--border-1); border-radius: var(--card-radius); background: var(--surface-1); box-shadow: var(--inner-highlight); margin: 0 0 var(--space-4); }
.workflow > header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border-1); }
.workflow h2 { margin: 0; font-size: var(--font-section-title); font-weight: 650; }
.workflow p { margin: 5px 0 0; color: var(--text-3); font-size: var(--font-meta); }
.legend { display: flex; gap: var(--space-3); flex-wrap: wrap; color: var(--text-3); font-size: var(--font-meta); }
.legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
.green { background: var(--success); }
.yellow { background: var(--warning); }
.blue { background: var(--info); }
.gray { background: var(--text-4); }
.canvas { height: 360px; background-color: var(--bg-2); background-image: radial-gradient(var(--border-2) 1.2px, transparent 1.2px); background-size: 22px 22px; }
.canvas :deep(.vue-flow) { background: transparent; }
.canvas :deep(.vue-flow__background) { display: none; }
.canvas :deep(.vue-flow__edge-path) { stroke: var(--border-3); stroke-width: 2; }
.canvas :deep(.vue-flow__node-default) { border: 0; background: none; padding: 0; box-shadow: none; }
.card { box-sizing: border-box; width: 232px; height: 92px; display: grid; align-content: center; gap: 7px; padding: var(--space-3) 14px; border: 1px solid var(--border-2); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--shadow-sm); cursor: pointer; }
.card strong { font-size: var(--font-body); color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card small { font-size: var(--font-meta); color: var(--text-3); line-height: 1.45; }
.tone-success { border-color: color-mix(in srgb, var(--success) 38%, transparent); background: color-mix(in srgb, var(--success) 6%, var(--surface-1)); }
.tone-warning { border-color: var(--warning); background: color-mix(in srgb, var(--warning) 8%, var(--surface-1)); }
.tone-info { border-color: var(--info); }
.tone-muted { border-style: dashed; background: var(--surface-2); opacity: 0.7; }
.card :deep(.vue-flow__handle) { opacity: 0; }
@media (max-width: 700px) {
  .workflow > header { align-items: flex-start; flex-direction: column; }
  .canvas { height: 330px; }
}
</style>
