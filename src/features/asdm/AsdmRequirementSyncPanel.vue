<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { COLLAB_STAGES } from '../../api/collab-projects.api'
import { getRequirementAsdmRules, getRequirementAsdmSyncJob, retryRequirementAsdmSyncJob, startRequirementAsdmSync, type AsdmRequirementRulesView, type AsdmSyncJobView, type AsdmSyncStageResult } from '../../api/collab-groups.api'

const props = defineProps<{ requirementKey: string; enabled: boolean; requirementStatus?: string }>()
const rules = ref<AsdmRequirementRulesView | null>(null)
const job = ref<AsdmSyncJobView | null>(null)
const busy = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setTimeout> | undefined
const isRunning = computed(() => Boolean(job.value && ['QUEUED', 'SCANNING', 'PUBLISHING', 'RUNNING', 'PROCESSING'].includes(job.value.status)))
const ruleMismatch = computed(() => {
  if (rules.value?.differsFromLatestGroupRules !== undefined) return rules.value.differsFromLatestGroupRules
  if (rules.value?.inSync !== undefined) return !rules.value.inSync
  const active = rules.value?.inUse
  const latest = rules.value?.latestGroupRules
  return Boolean(active && latest && (active.groupRevision !== latest.groupRevision || active.defaultVersion !== latest.defaultVersion))
})
const ruleLabel = computed(() => rules.value?.ruleVersion || (rules.value?.inUse?.defaultVersion ? `${rules.value.inUse.defaultVersion}+group:${rules.value.inUse.groupRevision ?? '—'}` : rules.value?.inUse?.effectiveHash ? `已绑定 ${rules.value.inUse.effectiveHash.slice(0, 12)}` : '读取中…'))
const stages = computed(() => {
  const rows = job.value?.stages || job.value?.items || []
  return [...rows].sort((a, b) => stageOrder(a.stageKey) - stageOrder(b.stageKey))
})
function stageOrder(key: string) { return COLLAB_STAGES.findIndex(stage => stage.key === key) }
function stageTitle(key: string) { return COLLAB_STAGES.find(stage => stage.key === key)?.title || key }
function statusLabel(status?: string) { return ({ QUEUED: '排队中', SCANNING: '扫描中', PUBLISHING: '发布中', RUNNING: '处理中', PROCESSING: '处理中', COMPLETED: '已完成', NO_CHANGES: '无变化', PARTIAL_FAILED: '部分失败', FAILED: '失败', CANCELLED: '已取消' } as Record<string, string>)[status || ''] || status || '—' }
function msg(e: unknown) { return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || '请求失败' }
function schedulePoll() { if (pollTimer) clearTimeout(pollTimer); if (isRunning.value && job.value) pollTimer = setTimeout(poll, 2500) }
async function poll() { if (!job.value) return; try { job.value = await getRequirementAsdmSyncJob(props.requirementKey, job.value.syncJobId); if (!isRunning.value) await loadRules(); schedulePoll() } catch (e) { error.value = msg(e); if (isRunning.value) pollTimer = setTimeout(poll, 5000) } }
async function loadRules() { if (!props.enabled) return; try { rules.value = await getRequirementAsdmRules(props.requirementKey) } catch (e) { error.value = msg(e) } }
async function start() { busy.value = true; error.value = ''; try { const created = await startRequirementAsdmSync(props.requirementKey, `asdm-sync-${props.requirementKey}-${crypto.randomUUID()}`); job.value = created; await loadRules(); schedulePoll() } catch (e) { error.value = msg(e) } finally { busy.value = false } }
async function retry() { if (!job.value) return; busy.value = true; error.value = ''; try { job.value = await retryRequirementAsdmSyncJob(props.requirementKey, job.value.syncJobId); schedulePoll() } catch (e) { error.value = msg(e) } finally { busy.value = false } }
function stageAction(row: AsdmSyncStageResult) { return ({ ACTIVE_DISCOVERY: '更新活动阶段候选', BACKFILL: '补充归档', PREVIEW: '仅预览', SKIPPED: '跳过' } as Record<string, string>)[row.action || ''] || row.action || statusLabel(row.status) }
onMounted(loadRules)
onBeforeUnmount(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>

<template>
  <section v-if="enabled" class="panel sync-panel">
    <header><div><h2>ASDM 产物同步</h2><p>一次扫描需求全部阶段；活动阶段沿用负责人确认流程，已完成阶段采用补充归档。</p></div><button class="primary" :disabled="busy || isRunning || !['ACTIVE','COMPLETED'].includes(requirementStatus || '')" @click="start">{{busy?'正在受理…':isRunning?'同步进行中…':'同步 ASDM 产物'}}</button></header>
    <div class="rules-state"><span>需求规则：{{ruleLabel}}</span><b :class="{different: ruleMismatch}">{{ruleMismatch ? '与项目组最新版不同' : '与项目组规则一致'}}</b><button class="quiet" :disabled="busy" @click="loadRules">刷新</button></div>
    <p v-if="error" class="error-note">{{error}}</p>
    <div v-if="job" class="job-summary"><div class="job-heading"><strong>任务 #{{job.syncJobId}} · {{statusLabel(job.status)}}</strong><span v-if="job.headSha">HEAD <code>{{job.headSha}}</code></span></div><p v-if="job.message">{{job.message}}</p><p v-if="job.lastErrorCode" class="error-note">{{job.lastErrorCode}}</p><p v-if="job.ruleVersion">规则版本：{{job.ruleVersion}}</p>
      <div v-if="stages.length" class="stage-results"><article v-for="stage in stages" :key="stage.stageKey" class="stage-result"><div class="stage-title"><strong>{{stageTitle(stage.stageKey)}}</strong><span>{{stageAction(stage)}}</span></div><div class="counts"><span>发现 {{stage.foundCount||0}}</span><span>新增 {{stage.newCount||0}}</span><span>更新 {{stage.updatedCount||0}}</span><span>归属不明 {{stage.uncertainCount||0}}</span><span>跳过 {{stage.skippedCount||0}}</span><span v-if="stage.publishedCount!==undefined">成功 {{stage.publishedCount}}</span><span v-if="stage.failedCount">失败 {{stage.failedCount}}</span></div><small v-if="stage.action==='ACTIVE_DISCOVERY' && stage.candidateStatus" class="hint">活动候选：{{stage.candidateStatus}}<span v-if="stage.notifyAfter"> · 静默至 {{new Date(stage.notifyAfter).toLocaleString()}}</span></small><small v-if="stage.lastErrorCode" class="error-note">{{stage.lastErrorCode}}</small><a v-if="stage.supplementalIndexUrl" :href="stage.supplementalIndexUrl" target="_blank" rel="noopener noreferrer">打开补充同步索引 ↗</a><div v-for="file in stage.files||[]" :key="file.path||file.sourcePath" class="file-result"><span>{{file.path||file.sourcePath}} · {{file.syncAction||file.publishStatus}}</span><a v-if="file.feishuUrl" :href="file.feishuUrl" target="_blank" rel="noopener noreferrer">打开飞书 ↗</a><small v-if="file.lastErrorCode">{{file.lastErrorCode}}</small></div></article></div>
      <button v-if="['PARTIAL_FAILED','FAILED'].includes(job.status)" class="secondary retry" :disabled="busy" @click="retry">重试失败文件</button>
    </div>
    <p v-else class="hint">同步会固定本次规则版本与分支 HEAD。尚未开始阶段仅预览；正在发布或待审批阶段保持原版本。</p>
  </section>
</template>

<style scoped>
.panel{padding:16px 18px;margin:0 0 16px;border:1px solid var(--border-accent);border-radius:12px;background:var(--surface-1);color:var(--text-1)}header{display:flex;justify-content:space-between;align-items:center;gap:16px}h2{margin:0 0 5px;font-size:15px}header p,.hint,.job-summary>p{margin:0;color:var(--text-3);font-size:11px}.primary,.secondary,.quiet{border:0;border-radius:8px;padding:9px 12px;cursor:pointer;font-weight:650}.primary{background:var(--accent-600);color:white}.secondary{background:var(--surface-3);color:var(--text-1)}.quiet{padding:4px 8px;background:none;color:var(--accent-400)}button:disabled{opacity:.5;cursor:not-allowed}.rules-state{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px 12px;border-radius:8px;background:var(--surface-2);font-size:11px;color:var(--text-2)}.rules-state span{flex:1}.rules-state b{color:var(--success)}.rules-state b.different{color:var(--warning)}.hint{padding-top:12px}.error-note{color:var(--error);font-size:11px}.job-summary{margin-top:14px;padding-top:13px;border-top:1px solid var(--border-1)}.job-heading{display:flex;justify-content:space-between;gap:12px;font-size:12px}.job-heading span{color:var(--text-3)}code{font-size:10px}.stage-results{display:grid;gap:8px;margin-top:12px}.stage-result{padding:10px 12px;border:1px solid var(--border-1);border-radius:9px}.stage-title{display:flex;justify-content:space-between;gap:10px;font-size:11px}.stage-title span{color:var(--text-3)}.counts{display:flex;flex-wrap:wrap;gap:7px 14px;margin-top:8px;color:var(--text-3);font-size:10px}.file-result{display:flex;justify-content:space-between;gap:10px;margin-top:7px;padding-top:7px;border-top:1px solid var(--border-1);font-size:10px;color:var(--text-2)}.file-result a{color:var(--accent-400);white-space:nowrap}.file-result small{color:var(--error)}.retry{margin-top:12px}@media(max-width:700px){header,.job-heading,.file-result{align-items:flex-start;flex-direction:column}.rules-state{flex-wrap:wrap}.rules-state span{flex-basis:100%}}
</style>
