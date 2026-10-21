<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getCollabGroup, type CollabGroup } from '../api/collab-groups.api'
import { getCollabProject, getCollabWorkflow, getRequirementRoles, getRequirementStageSyncPreview, syncRequirementStageMembers, updateCollabStageInclusion, updateRequirementStageActors, type CollabProject, type CollabStage, type RequirementRolesResponse, type RequirementStageActorsResponse } from '../api/collab-projects.api'
import CollabRequirementWorkflow from './CollabRequirementWorkflow.vue'

const props=defineProps<{embedded?:boolean;projectKey?:string}>();const emit=defineEmits<{updated:[]}>()
const route=useRoute();const router=useRouter();const auth=useAuthStore();const requirementKey=computed(()=>String(props.projectKey||route.params.requirementKey));const requirement=ref<CollabProject|null>(null);const roles=ref<RequirementRolesResponse|null>(null);const group=ref<CollabGroup|null>(null);const loading=ref(true);const busy=ref('');const error=ref('')
const groupMembers=computed(()=>group.value?.members||[]);const stages=computed(()=>roles.value?.stages||[])
let liveRefreshTimer:number|undefined
const canManage=computed(()=>auth.user?.id===requirement.value?.ownerUserId||auth.user?.id===group.value?.ownerUserId)
const canManageFlow=computed(()=>auth.user?.id===requirement.value?.ownerUserId)
const autoApproval=computed(()=>requirement.value?.approvalLevel==='L3')
function msg(e:unknown){const d=(e as{response?:{data?:{message?:string;code?:string}}})?.response?.data;return d?.message||d?.code||(e as Error)?.message||'请求失败'}
function ownerRole(stage:CollabStage){return roles.value?.roles.find(r=>r.roleKey===stage.ownerRoleKey)}
function reviewerRoleActors(stage:CollabStage){if(stage.reviewerRoleActors?.length)return stage.reviewerRoleActors;const keys=stage.reviewerRoleKeys?.length?stage.reviewerRoleKeys:(stage.reviewerRoleKey?[stage.reviewerRoleKey]:[]);return keys.map((roleKey,index)=>({roleKey,roleName:stage.reviewerRoleNames?.[index]||roles.value?.roles.find(r=>r.roleKey===roleKey)?.roleName,userIds:keys.length===1?stage.reviewerUserIds||[]:[]}))}
function hasReviewerAssignments(stage:CollabStage){return reviewerRoleActors(stage).some(binding=>binding.userIds.length>0)}
function ownerActorIds(stage:CollabStage){return stage.ownerUserIds||[]}
function roleActorIds(stage:CollabStage,roleKey:string){return reviewerRoleActors(stage).find(binding=>binding.roleKey===roleKey)?.userIds||[]}
function frozen(stage:CollabStage){const actorsFrozen=(stage as unknown as {actorsFrozen?:boolean}).actorsFrozen;if(actorsFrozen!==undefined)return actorsFrozen;return !['WAITING','READY','NOT_STARTED','READY_BLOCKED'].includes(stage.status)}
function canEditStage(stage:CollabStage){return ['WAITING','READY','NOT_STARTED','READY_BLOCKED'].includes(stage.status)&&!frozen(stage)}
function stageOrder(stage:CollabStage){return stage.stageOrder??stage.order??0}
function canChangeInclusion(stage:CollabStage){if(!canManageFlow.value||!requirement.value||!['L2','L3'].includes(requirement.value.approvalLevel)||stageOrder(stage)<(requirement.value.currentStageOrder||1))return false;return stage.status==='SKIPPED'||['WAITING','READY','NOT_STARTED'].includes(stage.status)}
function stageStatusText(stage:CollabStage){if(stage.status==='READY_BLOCKED')return'待补齐人员；补齐后阶段自动启动';if(stage.status==='SKIPPED')return'未纳入流程，暂不可调整';return canEditStage(stage)?'阶段未开始，可调整人员':'阶段已开始或结束，人员已锁定'}
function stageTone(stage:CollabStage){if(stage.status==='COMPLETED')return'complete';if(stage.status==='SKIPPED')return'skipped';if(['IN_PROGRESS','PENDING_APPROVAL','REJECTED','READY_BLOCKED'].includes(stage.status))return'running';return'upcoming'}
function stageStateLabel(stage:CollabStage){if(stage.status==='COMPLETED')return'已归档';if(stage.status==='SKIPPED')return'未纳入流程';if(['IN_PROGRESS','PENDING_APPROVAL','REJECTED','READY_BLOCKED'].includes(stage.status))return stage.status==='READY_BLOCKED'?'待补齐人员':'进行中 · 节点锁定';return'已纳入 · 待开始'}
function unavailableReason(stage:CollabStage){if(stage.status==='COMPLETED')return'已归档';if(['IN_PROGRESS','PENDING_APPROVAL','REJECTED'].includes(stage.status))return'阶段已开始';if(stageOrder(stage)<(requirement.value?.currentStageOrder||1))return'早于当前位置';if(!['L2','L3'].includes(requirement.value?.approvalLevel||''))return'当前策略锁定';return'不可调整'}
function applyStageActors(updated:RequirementStageActorsResponse){if(!roles.value)return;roles.value={...roles.value,stages:roles.value.stages.map(stage=>stage.stageKey===updated.stageKey?{...stage,...updated}:stage)}}
function displaySyncDiff(duties:Awaited<ReturnType<typeof getRequirementStageSyncPreview>>['duties']){return duties.map(duty=>{const added=duty.addedUserIds.map(id=>groupMembers.value.find(m=>m.userId===id)?.displayName||`用户 ${id}`);const removed=duty.removedUserIds.map(id=>groupMembers.value.find(m=>m.userId===id)?.displayName||`用户 ${id}`);return `${duty.roleName||duty.roleKey||duty.duty}：${added.length?`新增 ${added.join('、')}`:'无新增'}；${removed.length?`移除 ${removed.join('、')}`:'无移除'}`}).join('\n')||'人员配置没有变化。'}
function mergeRoleStages(roleData:RequirementRolesResponse,workflowStages:CollabStage[]):RequirementRolesResponse{const roleByKey=new Map(roleData.stages.map(stage=>[stage.stageKey,stage]));return{...roleData,stages:workflowStages.map(stage=>{const actors=roleByKey.get(stage.stageKey);return{...stage,...actors,status:stage.status,versionNo:stage.versionNo,stageOrder:stage.stageOrder,order:stage.order,attemptNo:stage.attemptNo,submissionId:stage.submissionId,submissionStatus:stage.submissionStatus,artifactVersionId:stage.artifactVersionId,approvalState:stage.approvalState}})}}
async function refreshRoles(){const [r,w]=await Promise.all([getRequirementRoles(requirementKey.value),getCollabWorkflow(requirementKey.value)]);roles.value=mergeRoleStages(r,w.stages)}
async function load(){loading.value=true;error.value='';try{const p=await getCollabProject(requirementKey.value);requirement.value=p;const [r,w,g]=await Promise.all([getRequirementRoles(requirementKey.value),getCollabWorkflow(requirementKey.value),p.groupKey?getCollabGroup(p.groupKey):Promise.resolve(null)]);roles.value=mergeRoleStages(r,w.stages);group.value=g}catch(e){error.value=msg(e)}finally{loading.value=false}}
async function refreshLiveState(){if(loading.value||busy.value||document.visibilityState!=='visible')return;try{const [p,r,w]=await Promise.all([getCollabProject(requirementKey.value),getRequirementRoles(requirementKey.value),getCollabWorkflow(requirementKey.value)]);const previous=new Map(stages.value.map(stage=>[stage.stageKey,stage.status]));requirement.value=p;roles.value=mergeRoleStages(r,w.stages);if(w.stages.some(stage=>previous.get(stage.stageKey)!==stage.status))emit('updated')}catch{/* Keep the last known state; the next poll will retry. */}}
async function saveActors(stage:CollabStage,duty:'OWNER'|'REVIEWER',ev:Event,reviewerRoleKey?:string){const input=ev.target as HTMLInputElement;const roleKey=duty==='OWNER'?ownerRole(stage)?.roleKey:reviewerRoleKey;if(!roleKey){error.value=`${duty==='OWNER'?'负责人':'审批人'}角色未配置`;return}const current=duty==='OWNER'?ownerActorIds(stage):roleActorIds(stage,roleKey);const next=new Set(current);input.checked?next.add(Number(input.value)):next.delete(Number(input.value));busy.value=`${stage.stageKey}-${duty}-${roleKey}`;error.value='';try{const updated=await updateRequirementStageActors(requirementKey.value,stage.stageKey,{duty,roleKey,userIds:[...next],expectedStageVersion:stage.versionNo});applyStageActors(updated)}catch(e){error.value=msg(e)}finally{busy.value=''}}
async function syncLatest(stage:CollabStage){busy.value=stage.stageKey;error.value='';try{const preview=await getRequirementStageSyncPreview(requirementKey.value,stage.stageKey);const diff=displaySyncDiff(preview.duties);if(!window.confirm(`从项目组同步“${stageTitle(stage)}”的人员配置？\n\n${diff}\n\n只更新此未开始阶段；进行中和已完成阶段不可修改。`))return;await syncRequirementStageMembers(requirementKey.value,stage.stageKey,{expectedStageVersion:preview.expectedStageVersion,expectedGroupTemplateVersion:preview.groupTemplateVersion,mode:'REPLACE',confirm:true});await refreshRoles()}catch(e){error.value=msg(e)}finally{busy.value=''}}
async function changeInclusion(stage:CollabStage){const included=stage.status==='SKIPPED';busy.value=`flow-${stage.stageKey}`;error.value='';try{await updateCollabStageInclusion(requirementKey.value,stage.stageKey,included);await refreshRoles();emit('updated')}catch(e){error.value=msg(e)}finally{busy.value=''}}
function stageTitle(stage:CollabStage){return stage.title||stage.stageKey}
function openStage(stageKey:string){router.push({name:'collab-requirement-stage',params:{requirementKey:requirementKey.value,stageKey}})}
onMounted(async()=>{await load();liveRefreshTimer=window.setInterval(()=>void refreshLiveState(),5000)})
onUnmounted(()=>{if(liveRefreshTimer!==undefined)window.clearInterval(liveRefreshTimer)})
</script>

<template>
  <main class="page" :class="{embedded:props.embedded}">
    <button v-if="!props.embedded" class="back" @click="router.push({name:'collab-requirement-detail',params:{requirementKey}})">← {{requirement?.name||'需求'}}</button>
    <div v-if="error" class="error" role="alert"><span>{{error}}</span><button aria-label="关闭错误" @click="error=''">×</button></div>
    <div v-if="loading" class="empty">正在加载需求流程…</div>
    <template v-else-if="requirement">
      <header v-if="!props.embedded" class="page-head">
        <div><h1>需求流程配置</h1><p>阶段人员来自项目组快照。未开始阶段可调整本需求的角色成员，或手动同步项目组配置。</p></div>
        <div class="head-meta"><span>{{requirement.approvalLevel}} · {{requirement.approvalLevel==='L1'?'每阶段审批':requirement.approvalLevel==='L2'?'继承审批人，按阶段可选':'自动流转'}}</span><span>{{stages.filter(s=>s.status!=='SKIPPED').length}} 个阶段已纳入</span></div>
      </header>

      <CollabRequirementWorkflow v-if="!props.embedded" :stages="stages" :approval-level="requirement.approvalLevel" @open-stage="openStage" />

      <section id="requirement-flow-config" class="stage-list">
        <header class="list-head">
          <div><h2>研发流程阶段清单</h2><p>已归档和进行中的阶段锁定；当前流程位置之后的未开始阶段可纳入或移出。</p></div>
          <span>{{stages.filter(s=>s.status==='COMPLETED').length}} / {{stages.filter(s=>s.status!=='SKIPPED').length}} 已归档</span>
        </header>

        <article v-for="stage in stages" :key="stage.stageKey" class="stage-row" :class="`tone-${stageTone(stage)}`">
          <div class="stage-identity">
            <span class="stage-order">{{String(stageOrder(stage)).padStart(2,'0')}}</span>
            <div class="identity-copy">
              <span class="state-chip"><i></i>{{stageStateLabel(stage)}}</span>
              <button class="stage-title" @click="openStage(stage.stageKey)">{{stageTitle(stage)}}</button>
              <small>{{stage.status==='SKIPPED'?'重新纳入后即可配置人员':stageStatusText(stage)}}</small>
            </div>
          </div>

          <div v-if="stage.status==='SKIPPED'" class="skipped-copy">此阶段已跳过，流程运行时会自动略过。</div>
          <div v-else class="duties">
            <fieldset class="duty-group">
              <legend>负责人 · {{stage.ownerRoleName||'未配置角色'}}</legend>
              <label v-for="member in groupMembers" :key="`owner-${stage.stageKey}-${member.userId}`" class="member-choice">
                <input type="checkbox" :value="member.userId" :checked="ownerActorIds(stage).includes(member.userId)" :disabled="!canManage||!canEditStage(stage)||busy!==''||!ownerRole(stage)" @change="saveActors(stage,'OWNER',$event)">
                <span>{{member.displayName}}</span>
              </label>
              <small v-if="!ownerRole(stage)" class="field-warning">项目组模板未绑定负责人角色</small>
            </fieldset>
            <fieldset v-for="binding in (autoApproval?[]:reviewerRoleActors(stage))" :key="`reviewer-${stage.stageKey}-${binding.roleKey}`" class="duty-group">
              <legend>审批 · {{binding.roleName||binding.roleKey}}</legend>
              <label v-for="member in groupMembers" :key="`reviewer-${stage.stageKey}-${binding.roleKey}-${member.userId}`" class="member-choice">
                <input type="checkbox" :value="member.userId" :checked="binding.userIds.includes(member.userId)" :disabled="!canManage||!canEditStage(stage)||busy!==''" @change="saveActors(stage,'REVIEWER',$event,binding.roleKey)">
                <span>{{member.displayName}}</span>
              </label>
              <small v-if="!binding.userIds.length&&(requirement.approvalLevel==='L1'||requirement.approvalLevel==='L2'&&hasReviewerAssignments(stage))" class="field-warning">此审批角色至少配置一名审批人</small>
            </fieldset>
            <p v-if="autoApproval" class="auto-approval">L3 自动流转，此需求无需配置审批人。</p>
            <p v-else-if="requirement.approvalLevel==='L2'&&!hasReviewerAssignments(stage)" class="auto-approval">本阶段未配置审批人，提交后将自动完成；可勾选项目组成员配置审批角色。</p>
            <p v-else-if="!reviewerRoleActors(stage).length" class="auto-approval">未配置审批角色，将按当前策略自动流转。</p>
          </div>

          <aside class="stage-actions">
            <t-button v-if="canChangeInclusion(stage)" :theme="stage.status==='SKIPPED'?'primary':'default'" variant="outline" :loading="busy===`flow-${stage.stageKey}`" :disabled="busy!==''" @click="changeInclusion(stage)">{{stage.status==='SKIPPED'?'＋ 纳入流程':'移出流程'}}</t-button>
            <span v-else-if="stage.status==='SKIPPED'" class="action-note">{{unavailableReason(stage)}}</span>
            <span v-else-if="!canChangeInclusion(stage)" class="action-note">{{stage.status==='COMPLETED'?'已锁定':stage.status==='IN_PROGRESS'||stage.status==='PENDING_APPROVAL'||stage.status==='REJECTED'?'推进中不可调整':!['L2','L3'].includes(requirement.approvalLevel)?'策略锁定':stageOrder(stage)<(requirement.currentStageOrder||1)?'早于当前位置':''}}</span>
            <t-button v-if="stage.status!=='SKIPPED'&&canEditStage(stage)" variant="text" :loading="busy===stage.stageKey" :disabled="!canManage||busy!==''" @click="syncLatest(stage)">同步项目组</t-button>
            <button class="open-link" @click="openStage(stage.stageKey)">阶段详情</button>
          </aside>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page{max-width:1540px;margin:0 auto;padding:26px 32px 72px;color:#263449}.page.embedded{max-width:none;margin:0;padding:0}.back{display:inline-flex;margin:0 0 20px;padding:0;border:0;background:none;color:#73839a;font-size:13px;cursor:pointer}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}.page-head h1{margin:0 0 7px;font-size:28px;letter-spacing:-.025em}.page-head p{max-width:760px;margin:0;color:#74849b;font-size:13px;line-height:1.55}.head-meta{display:flex;gap:9px;flex-wrap:wrap}.head-meta span{padding:7px 10px;border:1px solid #dfe6ef;border-radius:8px;background:#fff;color:#6c7d94;font-size:11px;white-space:nowrap}.stage-list{display:grid;gap:12px}.list-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:7px 0 2px}.list-head h2{margin:0;color:#263449;font-size:18px;letter-spacing:-.01em}.list-head p{margin:6px 0 0;color:#8291a6;font-size:12px}.list-head>span{padding:7px 10px;border:1px solid #e1e7ef;border-radius:8px;background:#fff;color:#74849a;font-size:11px;white-space:nowrap}.stage-row{display:grid;grid-template-columns:minmax(190px,1.05fr) minmax(0,3.1fr) minmax(142px,.7fr);align-items:center;gap:18px;padding:14px 16px;border:1px solid #dfe6ef;border-radius:13px;background:#fff;transition:background-color .15s,border-color .15s}.tone-complete{border-color:#b8e8d4;background:#f4fbf7}.tone-running{border-color:#ffdf8d;background:#fffdf6}.tone-upcoming{border-color:#d7e5f8;background:#fbfdff}.tone-skipped{border-style:dashed;border-color:#d6dfe9;background:#f7f9fc}.stage-identity{display:flex;align-items:flex-start;gap:12px;min-width:0}.stage-order{padding-top:1px;color:#8495ab;font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace}.tone-complete .stage-order{color:#13845f}.tone-running .stage-order{color:#cb7607}.tone-upcoming .stage-order{color:#145fd0}.identity-copy{display:grid;justify-items:start;gap:5px;min-width:0}.state-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #e0e6ee;border-radius:6px;background:#f0f3f7;color:#7c8ba0;font-size:10px;white-space:nowrap}.state-chip i{width:7px;height:7px;border-radius:50%;background:#b4c0cf}.tone-complete .state-chip{border-color:#b2e4ce;background:#e8f7ef;color:#13845f}.tone-complete .state-chip i{background:#16ad7c}.tone-running .state-chip{border-color:#ffda7a;background:#fff2d0;color:#ad6508}.tone-running .state-chip i{background:#eea00a}.tone-upcoming .state-chip{border-color:#c7d9fa;background:#eaf2ff;color:#1d5fc4}.tone-upcoming .state-chip i{background:#1764df}.stage-title{max-width:100%;padding:0;border:0;background:none;color:#263449;font-size:15px;font-weight:750;text-align:left;cursor:pointer}.stage-title:hover,.open-link:hover{text-decoration:underline}.tone-complete .stage-title{color:#187454}.tone-skipped .stage-title{color:#67788f}.identity-copy small{color:#8291a6;font-size:10px;line-height:1.4}.duties{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;min-width:0}.duty-group{display:flex;flex-wrap:wrap;align-content:flex-start;gap:6px 11px;min-width:0;min-height:58px;margin:0;padding:7px 9px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffffa8}.duty-group legend{padding:0 4px;color:#72829a;font-size:10px;font-weight:650}.member-choice{display:inline-flex;align-items:center;gap:5px;color:#43546b;font-size:11px;white-space:nowrap}.member-choice input{width:13px;height:13px;margin:0;accent-color:#1764df}.member-choice input:disabled{cursor:not-allowed}.tone-complete .member-choice{color:#718779}.tone-running .member-choice{color:#806a47}.field-warning{width:100%;color:#bb5747;font-size:10px}.auto-approval,.skipped-copy{margin:0;color:#8997a9;font-size:11px}.skipped-copy{padding:11px 12px;border:1px dashed #d7e0e9;border-radius:8px;background:#fafbfd}.stage-actions{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:7px;min-width:0}.stage-actions :deep(.t-button){width:100%;justify-content:center;white-space:nowrap}.action-note{min-height:30px;display:grid;place-items:center;color:#8a98aa;font-size:10px;text-align:center}.open-link{align-self:center;padding:4px 8px;border:0;background:none;color:#3974c6;font-size:10px;cursor:pointer}.error{display:flex;justify-content:space-between;gap:12px;margin:0 0 14px;padding:10px 13px;border:1px solid #ffd2c9;border-radius:8px;background:#fff4f1;color:#bb493b;font-size:12px}.error button{border:0;background:none;color:inherit;font-size:18px;line-height:1;cursor:pointer}.empty{display:grid;place-items:center;min-height:160px;color:#8291a6}.stage-row button:focus-visible,.back:focus-visible,.member-choice input:focus-visible{outline:3px solid #84aef7;outline-offset:2px}@media(max-width:1100px){.page{padding-right:20px;padding-left:20px}.page.embedded{padding:0}.stage-row{grid-template-columns:minmax(180px,.9fr) minmax(0,2fr) 138px;gap:12px}.duties{grid-template-columns:1fr}.duty-group{min-height:0}}@media(max-width:760px){.page{padding:22px 14px 50px}.page.embedded{padding:0}.page-head{align-items:flex-start;flex-direction:column;gap:12px}.page-head h1{font-size:24px}.head-meta{gap:6px}.list-head{align-items:flex-start;flex-direction:column;gap:8px}.stage-row{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;padding:13px}.stage-identity,.duties,.skipped-copy{grid-column:1/-1}.stage-actions{grid-column:2;grid-row:1;min-width:114px}.stage-actions :deep(.t-button){font-size:11px}.stage-actions .open-link{grid-column:auto}.auto-approval{grid-column:1/-1}}@media(prefers-reduced-motion:reduce){.stage-row{transition:none}}
</style>
