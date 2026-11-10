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
            <t-button v-if="canChangeInclusion(stage)" :theme="stage.status==='SKIPPED'?'primary':'default'" variant="outline" :loading="busy===`flow-${stage.stageKey}`" :disabled="busy!==''" @click="changeInclusion(stage)">{{stage.status==='SKIPPED'?'+ 纳入流程':'移出流程'}}</t-button>
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
.page { width: 100%; max-width: var(--page-max-width); margin: 0 auto; color: var(--text-1); }
.page.embedded { max-width: none; margin: 0; padding: 0; }
.back { display: inline-flex; margin: 0 0 var(--space-4); padding: 0; border: 0; background: none; color: var(--text-3); font-size: var(--font-body); cursor: pointer; }
.back:hover { color: var(--text-1); }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-6); margin-bottom: var(--space-5); }
.page-head h1 { margin: 0 0 7px; font-size: var(--font-page-title); font-weight: 700; letter-spacing: -0.02em; }
.page-head p { max-width: 760px; margin: 0; color: var(--text-2); font-size: var(--font-body); line-height: 1.6; }
.head-meta { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.head-meta span { padding: 5px 9px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-1); color: var(--text-3); font-size: var(--font-meta); white-space: nowrap; }
.stage-list { display: grid; gap: var(--space-3); }
.list-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-5); margin: 4px 0 2px; }
.list-head h2 { margin: 0; color: var(--text-1); font-size: var(--font-section-title); font-weight: 650; letter-spacing: -0.01em; }
.list-head p { margin: 6px 0 0; color: var(--text-2); font-size: var(--font-meta); line-height: 1.6; }
.list-head > span { padding: 5px 9px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-1); color: var(--text-3); font-size: var(--font-meta); white-space: nowrap; }
.stage-row { display: grid; grid-template-columns: minmax(190px, 1.05fr) minmax(0, 3.1fr) minmax(142px, 0.7fr); align-items: center; gap: var(--space-4); padding: var(--space-4); border: 1px solid var(--border-1); border-radius: var(--card-radius); background: var(--surface-1); box-shadow: var(--inner-highlight); transition: background-color var(--duration-fast), border-color var(--duration-fast); }
.tone-complete { border-color: color-mix(in srgb, var(--success) 26%, transparent); background: color-mix(in srgb, var(--success) 6%, var(--surface-1)); }
.tone-running { border-color: color-mix(in srgb, var(--warning) 30%, transparent); background: color-mix(in srgb, var(--warning) 6%, var(--surface-1)); }
.tone-upcoming { border-color: color-mix(in srgb, var(--info) 24%, transparent); background: color-mix(in srgb, var(--info) 5%, var(--surface-1)); }
.tone-skipped { border-style: dashed; border-color: var(--border-2); background: var(--surface-2); }
.stage-identity { display: flex; align-items: flex-start; gap: var(--space-3); min-width: 0; }
.stage-order { padding-top: 1px; color: var(--text-3); font: 700 13px/1.4 var(--font-mono); }
.tone-complete .stage-order { color: var(--success); }
.tone-running .stage-order { color: var(--warning); }
.tone-upcoming .stage-order { color: var(--accent-400); }
.identity-copy { display: grid; justify-items: start; gap: 5px; min-width: 0; }
.state-chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border: 1px solid var(--border-2); border-radius: var(--radius-full); background: var(--surface-2); color: var(--text-3); font-size: var(--font-meta); white-space: nowrap; }
.state-chip i { width: 6px; height: 6px; border-radius: 50%; background: var(--text-4); }
.tone-complete .state-chip { border-color: color-mix(in srgb, var(--success) 32%, transparent); background: var(--success-soft); color: var(--success); }
.tone-complete .state-chip i { background: var(--success); }
.tone-running .state-chip { border-color: color-mix(in srgb, var(--warning) 32%, transparent); background: var(--warning-soft); color: var(--warning); }
.tone-running .state-chip i { background: var(--warning); }
.tone-upcoming .state-chip { border-color: color-mix(in srgb, var(--info) 32%, transparent); background: var(--info-soft); color: var(--info); }
.tone-upcoming .state-chip i { background: var(--info); }
.stage-title { max-width: 100%; padding: 0; border: 0; background: none; color: var(--text-1); font-size: var(--font-card-title); font-weight: 650; line-height: 1.4; text-align: left; cursor: pointer; }
.stage-title:hover, .open-link:hover { text-decoration: underline; }
.tone-complete .stage-title { color: var(--text-1); }
.tone-skipped .stage-title { color: var(--text-3); }
.identity-copy small { color: var(--text-3); font-size: var(--font-meta); line-height: 1.5; }
.duties { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--space-2); min-width: 0; }
.duty-group { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px 10px; min-width: 0; min-height: 58px; margin: 0; padding: 8px 10px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-2); }
.duty-group legend { padding: 0 4px; color: var(--text-3); font-size: var(--font-meta); font-weight: 650; }
.member-choice { display: inline-flex; align-items: center; gap: 5px; color: var(--text-2); font-size: var(--font-meta); white-space: nowrap; }
.member-choice input { width: 14px; height: 14px; margin: 0; accent-color: var(--accent-500); }
.member-choice input:disabled { cursor: not-allowed; opacity: 0.55; }
.tone-complete .member-choice { color: var(--text-2); }
.tone-running .member-choice { color: var(--text-2); }
.field-warning { width: 100%; color: var(--error); font-size: var(--font-meta); }
.auto-approval, .skipped-copy { margin: 0; color: var(--text-3); font-size: var(--font-meta); line-height: 1.6; }
.skipped-copy { padding: 10px 12px; border: 1px dashed var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); }
.stage-actions { display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 6px; min-width: 0; }
.stage-actions :deep(.t-button) { width: 100%; justify-content: center; white-space: nowrap; }
.action-note { min-height: 30px; display: grid; place-items: center; color: var(--text-3); font-size: var(--font-meta); text-align: center; }
.open-link { align-self: center; padding: 4px 8px; border: 0; background: none; color: var(--accent-400); font-size: var(--font-meta); cursor: pointer; }
.error { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin: 0 0 var(--space-4); padding: 10px 13px; border: 1px solid color-mix(in srgb, var(--error) 30%, transparent); border-radius: var(--radius-sm); background: var(--error-soft); color: var(--error); font-size: var(--font-body); }
.error button { border: 0; background: none; color: inherit; font-size: 18px; line-height: 1; cursor: pointer; }
.empty { display: grid; place-items: center; min-height: 160px; color: var(--text-3); }
.stage-row button:focus-visible, .back:focus-visible, .member-choice input:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
@media (max-width: 1100px) {
  .page { width: 100%; }
  .page.embedded { padding: 0; }
  .stage-row { grid-template-columns: minmax(180px, 0.9fr) minmax(0, 2fr) 138px; gap: var(--space-3); }
  .duties { grid-template-columns: 1fr; }
  .duty-group { min-height: 0; }
}
@media (max-width: 760px) {
  .page { width: 100%; }
  .page.embedded { padding: 0; }
  .page-head { align-items: flex-start; flex-direction: column; gap: var(--space-3); }
  .page-head h1 { font-size: var(--font-page-title); }
  .head-meta { gap: 6px; }
  .list-head { align-items: flex-start; flex-direction: column; gap: var(--space-2); }
  .stage-row { grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--space-3); padding: 13px; }
  .stage-identity, .duties, .skipped-copy { grid-column: 1 / -1; }
  .stage-actions { grid-column: 2; grid-row: 1; min-width: 114px; }
  .stage-actions :deep(.t-button) { font-size: var(--font-meta); }
  .stage-actions .open-link { grid-column: auto; }
  .auto-approval { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .stage-row { transition: none; }
}
</style>
