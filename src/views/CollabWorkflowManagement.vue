<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Handle, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { layoutGraph } from '../features/workbench/dagLayout'
import { updateCollabProject, updateCollabStageAssignment, updateCollabStageInclusion, type ApprovalLevel, type CollabMember, type CollabProject, type CollabStage } from '../api/collab-projects.api'

const props = defineProps<{ project: CollabProject; stages: CollabStage[]; members: CollabMember[]; canManage: boolean }>()
const emit = defineEmits<{ updated: []; openStage: [stageKey: string] }>()
type Draft = { ownerUserId: number; reviewerUserId: number | null; additionalReviewerUserIds: number[] }
type Node = { id: string; position: { x: number; y: number }; data: Record<string, unknown>; class?: string }
type Edge = { id: string; source: string; target: string; type: string; sourceHandle: string; targetHandle: string; class: string }
const order = ['REQUIREMENT','PRODUCT','ARCHITECTURE_DESIGN','UI_DESIGN','FRONTEND_CODING','BACKEND_CODING','TESTING','ACCEPTANCE']
const titles: Record<string,string> = { REQUIREMENT:'需求分析',PRODUCT:'产品设计',ARCHITECTURE_DESIGN:'架构设计',UI_DESIGN:'UI 设计',FRONTEND_CODING:'前端开发',BACKEND_CODING:'后端开发',TESTING:'测试',ACCEPTANCE:'验收' }
const links = [['REQUIREMENT','PRODUCT'],['PRODUCT','ARCHITECTURE_DESIGN'],['PRODUCT','UI_DESIGN'],['ARCHITECTURE_DESIGN','BACKEND_CODING'],['UI_DESIGN','FRONTEND_CODING'],['BACKEND_CODING','TESTING'],['FRONTEND_CODING','TESTING'],['TESTING','ACCEPTANCE']]
const drafts = ref<Record<string,Draft>>({})
const approvalDraft = ref<ApprovalLevel>(props.project.approvalLevel)
const busy = ref(false); const busyStage = ref(''); const error = ref('')
const nodes = ref<Node[]>([]); const edges = ref<Edge[]>([])
const { fitView } = useVueFlow()
const byKey = computed(() => new Map(props.stages.map(s => [s.stageKey,s])))
const included = computed(() => props.stages.filter(s => s.status !== 'SKIPPED'))
const currentOrder = computed(() => props.project.currentStageOrder ?? 0)
const counts = computed(() => ({
  completed: props.stages.filter(s => s.status === 'COMPLETED').length,
  locked: props.stages.filter(s => ['IN_PROGRESS','PENDING_APPROVAL','REJECTED'].includes(s.status)).length,
  included: props.stages.filter(s => ['WAITING','READY','NOT_STARTED'].includes(s.status)).length,
  skipped: props.stages.filter(s => s.status === 'SKIPPED').length,
}))
const memberOptions = computed(() => props.members.map(m => ({ label: m.displayName + ((m.projectRole === 'OWNER' || m.role === 'OWNER') ? '（Owner）' : ''), value: m.userId })))
const approvalOptions = [{ label:'L1 · 每阶段审批',value:'L1' },{ label:'L2 · 关键阶段审批',value:'L2' },{ label:'L3 · 自动流转',value:'L3' }]
const canChangeApproval = computed(() => props.canManage && props.stages.every(s => ['WAITING','READY','NOT_STARTED','SKIPPED'].includes(s.status)))

watch(() => [props.stages,props.project.approvalLevel], () => {
  approvalDraft.value = props.project.approvalLevel
  drafts.value = Object.fromEntries(props.stages.map(s => [s.stageKey,{ownerUserId:s.ownerUserId,reviewerUserId:s.reviewerUserId ?? null,additionalReviewerUserIds:[...(s.additionalReviewerUserIds || [])]}]))
  void renderGraph()
}, { deep:true, immediate:true })

function stageOrder(s: CollabStage) { return s.order ?? s.stageOrder ?? order.indexOf(s.stageKey)+1 }
function title(s: CollabStage) { return s.title || titles[s.stageKey] || s.stageKey }
function state(s: CollabStage) {
  if (s.status === 'COMPLETED') return { label:'已通过 · 流程归档',tone:'complete',note:'此阶段已归档，不可更改' }
  if (['IN_PROGRESS','PENDING_APPROVAL','REJECTED'].includes(s.status)) return { label:s.status === 'PENDING_APPROVAL' ? '待审批 · 节点锁定' : s.status === 'REJECTED' ? '已驳回 · 等待重做' : '进行中 · 节点锁定',tone:'running',note:'阶段已开始，负责人和审批人不可更改' }
  if (s.status === 'SKIPPED') return { label:'未纳入流程（已跳过）',tone:'skipped',note:stageOrder(s) < currentOrder.value ? '早于当前流程位置，不能重新加入' : '流程运行时将自动忽略此阶段' }
  return { label:'已纳入活跃流程',tone:'included',note:'阶段开始前可调整负责人、审批人或跳过此阶段' }
}
function editable(s: CollabStage) {
  if (!props.canManage) return false
  if (s.status === 'SKIPPED') return stageOrder(s) >= currentOrder.value
  return ['WAITING','READY','NOT_STARTED'].includes(s.status)
}
function toggleable(s: CollabStage) {
  return props.canManage && ['L2','L3'].includes(props.project.approvalLevel) &&
    (s.status === 'SKIPPED' ? stageOrder(s) >= currentOrder.value : ['WAITING','READY','NOT_STARTED'].includes(s.status))
}
function needsReviewer(s: CollabStage) {
  return props.project.approvalLevel === 'L1' || (props.project.approvalLevel === 'L2' && ['PRODUCT','FRONTEND_CODING','BACKEND_CODING'].includes(s.stageKey))
}
function tone(status: string) {
  if (status === 'COMPLETED') return 'success'
  if (['IN_PROGRESS','PENDING_APPROVAL','REJECTED'].includes(status)) return 'warning'
  if (status === 'SKIPPED') return 'muted'
  return 'info'
}
function sub(s: CollabStage) {
  if (s.status === 'SKIPPED') return '未纳入流程'
  if (s.status === 'COMPLETED') return '已归档 ✓'
  if (s.status === 'IN_PROGRESS') return 'RUNNING'
  if (s.status === 'PENDING_APPROVAL') return '待审批'
  if (s.status === 'REJECTED') return '待重做'
  return '已纳入活跃流程'
}
async function renderGraph() {
  const graphNodes = order.map(id => ({ id,width:204,height:80 }))
  const graphEdges = links.map((link,i) => ({ id:'edge-'+i,source:link[0],target:link[1] }))
  try {
    const positions = await layoutGraph(graphNodes,graphEdges,{layerGap:64,nodeGap:30,padding:20})
    nodes.value = order.map((key,i) => {
      const s = byKey.value.get(key)
      const status = s?.status || 'SKIPPED'
      const ordinal = s ? stageOrder(s) : i+1
      return { id:key,position:positions[key] || {x:0,y:0},data:{title:String(ordinal).padStart(2,'0')+' '+(s ? title(s) : titles[key]),sub:s ? sub(s) : '未配置',tone:tone(status),status},class:'flow-node flow-'+tone(status) }
    })
    edges.value = graphEdges.map(e => ({id:e.id,source:e.source,target:e.target,type:'default',sourceHandle:'out',targetHandle:'in',class:['COMPLETED','IN_PROGRESS'].includes(byKey.value.get(e.source)?.status || '')?'flow-edge is-active':'flow-edge'}))
    await nextTick()
    await fitView({ padding: 0.12, includeHiddenNodes: true })
  } catch { nodes.value=[]; edges.value=[] }
}
function openNode(e: {node:{id:string}}) { emit('openStage',e.node.id) }
function errorMessage(e: unknown, fallback: string) { return (e as {response?:{data?:{message?:string}}})?.response?.data?.message || (e as Error)?.message || fallback }
async function saveApproval() {
  if (approvalDraft.value === props.project.approvalLevel) return
  busy.value=true; error.value=''
  try { await updateCollabProject(props.project.projectKey,{name:props.project.name,description:props.project.description || '',approvalLevel:approvalDraft.value,expectedVersion:props.project.versionNo}); emit('updated') }
  catch(e) { error.value=errorMessage(e,'保存审批策略失败') } finally { busy.value=false }
}
async function saveAssignment(s: CollabStage) {
  const d=drafts.value[s.stageKey]; if(!d) return
  busyStage.value=s.stageKey; error.value=''
  try { await updateCollabStageAssignment(props.project.projectKey,s.stageKey,d); emit('updated') }
  catch(e) { error.value=errorMessage(e,'保存阶段配置失败') } finally { busyStage.value='' }
}
async function toggleStage(s: CollabStage) {
  if(!toggleable(s)) return
  busyStage.value=s.stageKey; error.value=''
  try { await updateCollabStageInclusion(props.project.projectKey,s.stageKey,s.status === 'SKIPPED'); emit('updated') }
  catch(e) { error.value=errorMessage(e,'更新阶段状态失败') } finally { busyStage.value='' }
}
</script>

<template>
  <section class="collab-flow">
    <div class="strategy-card">
      <div class="strategy-controls">
        <label class="field-label" for="collab-approval-level">项目审批流转策略</label>
        <div class="strategy-actions">
          <t-select id="collab-approval-level" v-model="approvalDraft" :options="approvalOptions" :disabled="!canChangeApproval || busy" />
          <t-button theme="primary" :loading="busy" :disabled="!canManage || !canChangeApproval || approvalDraft === project.approvalLevel" @click="saveApproval">✓ 保存策略</t-button>
        </div>
      </div>
      <div class="strategy-note"><span aria-hidden="true">ⓘ</span><p><strong>约束说明：</strong>策略更新严格依赖项目版本号校验。任一阶段执行后，审批流转策略不可更改。已跳过阶段只能在<strong>不早于当前流程位置</strong>时重新加入。</p></div>
    </div>
    <section class="topology-card">
      <header class="topology-head">
        <div><h2><i></i>研发流程树 <span class="topology-label">DAG Topology Workflow</span></h2><p>从需求到验收，展示阶段依赖、并行支线与当前启用状态</p></div>
        <ul class="legend">
          <li><i class="dot success"></i>已完成/已归档 <b>{{ counts.completed }}</b></li>
          <li><i class="dot warning"></i>进行中/锁定 <b>{{ counts.locked }}</b></li>
          <li><i class="dot info"></i>已纳入活跃 <b>{{ counts.included }}</b></li>
          <li><i class="dot skipped"></i>已裁剪跳过 <b>{{ counts.skipped }}</b></li>
        </ul>
      </header>
      <div class="dag-canvas">
        <VueFlow :nodes="nodes" :edges="edges" :nodes-draggable="false" :nodes-connectable="false" :elements-selectable="false" :zoom-on-scroll="false" :pan-on-drag="false" :prevent-scrolling="true" fit-view-on-init @node-click="openNode">
          <Background :gap="22" pattern-color="rgba(102,125,158,.13)" />
          <template #node-default="{ data }">
            <div class="flow-node-card" :class="'tone-'+data.tone">
              <Handle id="in" type="target" :position="Position.Left" class="flow-handle" />
              <Handle id="out" type="source" :position="Position.Right" class="flow-handle" />
              <span class="node-title"><i class="dot"></i>{{ data.title }}</span>
              <span class="node-subtitle">{{ data.sub }}</span>
            </div>
          </template>
        </VueFlow>
        <div v-if="!nodes.length" class="dag-empty">流程图暂时无法布局，请刷新页面重试。</div>
      </div>
    </section>
    <section class="stage-config">
      <header class="stage-config-head"><div><h2>研发流转阶段清单</h2><p>按阶段顺序执行，背景与状态标签区分启用、锁定和跳过阶段。</p></div><span>{{ counts.completed }} / {{ included.length }} 已完成</span></header>
      <div v-if="error" class="flow-error" role="alert">{{ error }}</div>
      <article v-for="s in stages" :key="s.stageKey" class="stage-config-row" :class="['row-'+state(s).tone,{locked:!editable(s)}]">
        <div class="stage-identity">
          <span class="order">{{ String(stageOrder(s)).padStart(2,'0') }}</span>
          <div class="identity-copy"><span class="state-chip"><i></i>{{ state(s).label }}</span><h3>{{ title(s) }}<b v-if="s.status==='IN_PROGRESS'||s.status==='PENDING_APPROVAL'">●</b></h3><small>{{ state(s).note }}</small></div>
        </div>
        <label class="config-field">{{ editable(s) ? '负责人 *' : '负责人' }}
          <t-select v-model="drafts[s.stageKey].ownerUserId" :options="memberOptions" :disabled="!editable(s)||busyStage===s.stageKey" filterable />
        </label>
        <label class="config-field">主审批人
          <t-select v-model="drafts[s.stageKey].reviewerUserId" :options="[{label:'不指定（系统默认策略）',value:null},...memberOptions]" :disabled="!editable(s)||busyStage===s.stageKey" clearable filterable />
        </label>
        <fieldset class="reviewer-field" :disabled="!editable(s)||busyStage===s.stageKey">
          <legend>追加审批人（全部通过后推进）</legend>
          <t-checkbox-group v-model="drafts[s.stageKey].additionalReviewerUserIds">
            <t-checkbox v-for="member in members.filter(m=>m.userId!==drafts[s.stageKey].reviewerUserId)" :key="member.userId" :value="member.userId">{{ member.displayName }}</t-checkbox>
          </t-checkbox-group>
          <small v-if="needsReviewer(s)&&!drafts[s.stageKey].reviewerUserId&&!drafts[s.stageKey].additionalReviewerUserIds.length" class="reviewer-required">此审批阶段至少需要一位审批人</small>
        </fieldset>
        <div class="stage-actions">
          <t-button v-if="editable(s)" variant="outline" :loading="busyStage===s.stageKey" :disabled="busy||busyStage!==''" @click="saveAssignment(s)">保存</t-button>
          <t-button v-if="toggleable(s)" :theme="s.status==='SKIPPED'?'primary':'danger'" variant="outline" :loading="busyStage===s.stageKey" :disabled="busy||busyStage!==''" @click="toggleStage(s)">{{ s.status==='SKIPPED'?'＋ 加入流程':'跳过阶段' }}</t-button>
          <span v-else-if="!editable(s)" class="locked-label">{{ s.status==='COMPLETED'?'已锁定不可更改':'推进中不可调整' }}</span>
          <t-button variant="text" @click="emit('openStage',s.stageKey)">打开阶段</t-button>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.collab-flow{display:grid;gap:20px;margin:0 0 20px;color:var(--text-1)}
.strategy-card,.topology-card{border:1px solid #dfe6f0;border-radius:16px;background:#fff;box-shadow:0 1px 3px rgb(24 45 77 / 4%)}
.strategy-card{display:grid;grid-template-columns:minmax(440px,.95fr) minmax(380px,1.25fr);align-items:center;gap:34px;padding:22px 28px}
.strategy-controls{display:grid;gap:11px}.field-label{font-size:15px;font-weight:700;color:#53647c}.strategy-actions{display:flex;align-items:center;gap:12px}.strategy-actions :deep(.t-select){width:min(440px,100%)}.strategy-actions :deep(.t-button){height:48px;border-radius:10px;white-space:nowrap;font-weight:700}
.strategy-note{display:flex;gap:12px;align-items:flex-start;border-left:1px solid #e7edf5;padding:7px 0 7px 22px;color:#77869b;font-size:13px;line-height:1.75}.strategy-note>span{color:#ed9a15;font-size:20px;line-height:1}.strategy-note p{margin:0}.strategy-note strong{color:#687a91}
.topology-card{overflow:hidden}.topology-head{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 26px;border-bottom:1px solid #edf1f6}.topology-head h2,.stage-config-head h2{display:flex;align-items:center;gap:10px;margin:0;color:#263448;font-size:18px;font-weight:750}.topology-head h2>i{width:9px;height:23px;border-radius:3px;background:#1262df}.topology-label{padding:6px 10px;border:1px solid #e1e7ef;border-radius:7px;background:#f5f8fc;color:#74849b;font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}.topology-head p,.stage-config-head p{margin:7px 0 0;color:#8190a5;font-size:13px}
.legend{display:flex;align-items:center;justify-content:flex-end;gap:17px;flex-wrap:wrap;list-style:none;margin:0;padding:0}.legend li{display:flex;align-items:center;gap:7px;color:#78879a;font-size:12px;white-space:nowrap}.legend b{color:inherit;font-weight:700}.dot{width:10px;height:10px;flex:none;border-radius:50%;background:#aab7c8}.dot.success{background:#16bb83}.dot.warning{background:#ffb21a}.dot.info{background:#1262df}.dot.skipped{background:#bdc8d6;border:1px dashed #a9b7c8}
.dag-canvas{height:390px;position:relative;overflow:hidden;background-color:#fbfcfe;background-image:radial-gradient(#e4eaf2 1.3px,transparent 1.3px);background-size:22px 22px}.dag-canvas :deep(.vue-flow){background:transparent}.dag-canvas :deep(.vue-flow__background){display:none}.dag-canvas :deep(.vue-flow__node-default.flow-node){border:0;background:transparent;box-shadow:none;padding:0}.dag-canvas :deep(.vue-flow__edge-path){stroke:#d0d9e5;stroke-width:2}.dag-canvas :deep(.flow-edge.is-active .vue-flow__edge-path){stroke:#13b983}.dag-empty{position:absolute;inset:0;display:grid;place-items:center;color:#78879a;font-size:13px}
.flow-node-card{position:relative;box-sizing:border-box;display:grid;align-content:center;gap:7px;width:204px;height:80px;padding:12px 14px;border:1.5px solid #d9e2ee;border-radius:14px;background:#fff;box-shadow:0 2px 7px rgb(31 49 74 / 4%);cursor:pointer}.flow-node-card.tone-success{border-color:#adebd5}.flow-node-card.tone-warning{border:2px solid #ffb91e;background:#fffdf6;box-shadow:0 3px 11px rgb(229 163 25 / 12%)}.flow-node-card.tone-info{border:2px solid #1764df;box-shadow:0 3px 12px rgb(23 100 223 / 12%)}.flow-node-card.tone-muted{border-style:dashed;background:#fafbfd;opacity:.7}.node-title{display:flex;align-items:center;gap:9px;overflow:hidden;color:#253348;font-size:13px;font-weight:750;white-space:nowrap;text-overflow:ellipsis}.node-title .dot{width:10px;height:10px}.tone-success .node-title .dot{background:#16bb83}.tone-warning .node-title .dot{background:#ffb21a}.tone-info .node-title .dot{background:#1262df}.tone-muted .node-title .dot{background:#b9c5d4}.node-subtitle{padding-left:20px;color:#8b99ac;font-size:11px}.tone-success .node-subtitle{color:#149d75}.tone-warning .node-subtitle{color:#ca7414}.flow-handle{opacity:0;width:8px;height:8px;border:0;background:transparent;pointer-events:none}
.stage-config{display:grid;gap:11px;container:stage-config / inline-size;min-width:0}.stage-config-head{display:flex;align-items:end;justify-content:space-between;padding:0 2px 1px}.stage-config-head>span{padding:7px 10px;border:1px solid #e2e8f1;border-radius:8px;color:#718198;font-size:12px;font-weight:650;background:#fff}
.stage-config-row{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.05fr) minmax(0,1.1fr) minmax(var(--layout-action-min),auto);align-items:center;gap:14px;padding:17px 20px;border:1px solid #dfe6ef;border-radius:15px;background:#fff;transition:border-color .15s ease,background .15s ease}.stage-config-row>*{min-width:0}.stage-config-row.row-skipped{background:#f8fafc;border-style:dashed;border-color:#d9e1eb}.stage-config-row.row-complete{background:#f2fbf7;border-style:solid;border-color:#a8e4ca}.stage-config-row.row-running{background:#fffdf6;border-color:#ffe090}.stage-config-row.row-included{background:#fff;border-color:#d9e6f7}.stage-config-row.locked{color:#75849a}
.stage-identity{display:flex;align-items:flex-start;gap:13px;min-width:0}.order{padding-top:2px;color:#8fa0b5;font:700 13px ui-monospace,SFMono-Regular,Menlo,monospace}.row-running .order{color:#d98200}.row-included .order{color:#1262df}.row-complete .order{color:#12956c}.identity-copy{min-width:0;display:grid;justify-items:start;gap:5px}.state-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #e1e7ef;border-radius:6px;background:#f2f5f9;color:#7e8ea3;font-size:10px;white-space:nowrap}.state-chip>i{width:7px;height:7px;border-radius:50%;background:#adb9c8}.row-running .state-chip{border-color:#ffda79;background:#fff5d8;color:#b7670b}.row-running .state-chip>i{background:#f0a10c}.row-included .state-chip{border-color:#b8d0ff;background:#eaf2ff;color:#125bd0}.row-included .state-chip>i{background:#1764df}.row-complete .state-chip{border-color:#a8e4ca;background:#e4f7ee;color:#11845f}.row-complete .state-chip>i{background:#16ad7c}.identity-copy h3{margin:0;color:#263449;font-size:16px;line-height:1.3}.row-complete .identity-copy h3{color:#187454}.row-skipped .identity-copy h3{color:#596a80}.identity-copy h3 b{margin-left:6px;color:#12b981;font-size:9px;vertical-align:middle}.identity-copy small{color:#8a99ad;font-size:11px;line-height:1.45}.row-running .identity-copy small{color:#ca7414}.row-complete .identity-copy small{color:#438b72}
.config-field{display:grid;gap:7px;min-width:0;color:#7b8ba0;font-size:11px;font-weight:650}.config-field :deep(.t-select),.config-field :deep(.t-select__wrap){width:100%;min-width:0}.config-field :deep(.t-input__wrap),.config-field :deep(.t-input){min-height:42px;min-width:0}.reviewer-field{min-width:0;min-height:53px;margin:0;padding:0;border:0}.reviewer-field legend{margin-bottom:7px;color:#7b8ba0;font-size:11px;font-weight:650}.reviewer-field :deep(.t-checkbox-group){display:flex;min-width:0;flex-wrap:wrap;gap:3px 9px}.reviewer-field :deep(.t-checkbox){margin-right:0;max-width:100%}.reviewer-field :deep(.t-checkbox__label){color:#55677f;font-size:12px;overflow-wrap:anywhere}.reviewer-required{display:block;margin-top:4px;color:#d65b4a;font-size:10px}
.stage-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}.stage-actions :deep(.t-button){white-space:nowrap}.locked-label{padding:7px 8px;border-radius:6px;background:#fff4d9;color:#b36c15;font-size:10px;font-weight:700;white-space:nowrap}.row-complete .locked-label{background:#e4f7ee;color:#11845f}.row-skipped .locked-label{background:#edf1f6;color:#8291a5}.flow-error{padding:10px 13px;border:1px solid #ffd2c9;border-radius:8px;background:#fff4f1;color:#bb493b;font-size:12px}
@media(max-width:1150px){.strategy-card{grid-template-columns:1fr;gap:15px}.strategy-note{border-left:0;border-top:1px solid #e7edf5;padding:13px 0 0}.topology-head{align-items:flex-start;flex-direction:column}.legend{justify-content:flex-start}.stage-config-row{grid-template-columns:minmax(220px,1.1fr) 1fr 1fr}.reviewer-field{grid-column:2/4}.stage-actions{grid-column:1/-1;justify-content:flex-end}}
@media(max-width:700px){.collab-flow{gap:14px}.strategy-card{padding:17px}.strategy-actions{align-items:stretch;flex-direction:column}.strategy-actions :deep(.t-select){width:100%}.strategy-actions :deep(.t-button){width:100%}.topology-head{padding:16px}.topology-head h2{font-size:15px;flex-wrap:wrap}.topology-label{font-size:9px}.legend{gap:9px 12px}.legend li{font-size:10px}.dag-canvas{height:350px}.stage-config-head{align-items:flex-start;flex-direction:column;gap:9px}.stage-config-row{grid-template-columns:1fr 1fr;gap:13px;padding:14px}.stage-identity,.reviewer-field,.stage-actions{grid-column:1/-1}.stage-actions{justify-content:flex-start}.config-field :deep(.t-input__wrap){min-width:0}}
@container stage-config (max-width: 1100px){.stage-config-row{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr)}.reviewer-field{grid-column:2/4}.stage-actions{grid-column:1/-1;justify-content:flex-end}}
@container stage-config (max-width: 760px){.stage-config-row{grid-template-columns:repeat(2,minmax(0,1fr));padding:14px}.stage-identity,.reviewer-field,.stage-actions{grid-column:1/-1}.stage-actions{justify-content:flex-start}}
@container stage-config (max-width: 520px){.stage-config-row{grid-template-columns:minmax(0,1fr)}.stage-identity,.reviewer-field,.stage-actions{grid-column:1}}
</style>
