<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  getRequirementAsdmCandidate, getRequirementAsdmPackage, getRequirementAsdmStage,
  retryRequirementAsdmPackage, scanRequirementAsdmStage, updateRequirementAsdmAssociation,
  type AsdmCandidateFile, type AsdmPackageView, type AsdmStageCandidate, type AsdmStageView,
} from '../../api/collab-groups.api'
import { asdmStatusLabel, groupCandidateFiles, isRetryableFile } from './asdm-view-model.js'

const props = defineProps<{ requirementKey: string; stageKey: string; enabled: boolean; canManage: boolean }>()
const stageInfo = ref<AsdmStageView | null>(null)
const candidate = ref<AsdmStageCandidate | null>(null)
const packageInfo = ref<AsdmPackageView | null>(null)
const loading = ref(false)
const busyPath = ref('')
const scanning = ref(false)
const retrying = ref(false)
const notice = ref('')
const failure = ref('')
const packageId = computed(() => stageInfo.value?.packageId ?? null)
const groupedFiles = computed(() => groupCandidateFiles(candidate.value?.files || []))
const candidateCounts = computed(() => candidate.value?.fileCounts || {})
const hasCandidate = computed(() => Boolean(candidate.value?.candidateId))

function message(error: unknown) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error as Error)?.message || '请求失败'
}
function sizeLabel(bytes?: number) {
  if (bytes == null) return '大小未知'
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function kindLabel(mode?: string) {
  return ({ DOCX: '飞书文档', DRIVE_FILE: '飞书附件', LINK_ONLY: '仅链接' } as Record<string, string>)[mode || ''] || '待识别'
}
function setCandidate(value: AsdmStageCandidate | null | undefined) {
  candidate.value = value || null
}
async function load() {
  if (!props.enabled) return
  loading.value = true
  failure.value = ''
  try {
    stageInfo.value = await getRequirementAsdmStage(props.requirementKey, props.stageKey)
    setCandidate(stageInfo.value.candidate || stageInfo.value.latestCandidate)
    if (stageInfo.value.candidateId || hasCandidate.value) {
      try { setCandidate(await getRequirementAsdmCandidate(props.requirementKey, props.stageKey)) }
      catch { setCandidate(null) }
    }
    if (packageId.value != null) {
      try { packageInfo.value = await getRequirementAsdmPackage(props.requirementKey, props.stageKey, packageId.value) }
      catch { packageInfo.value = null }
    } else packageInfo.value = null
  } catch (error) {
    failure.value = message(error)
  } finally {
    loading.value = false
  }
}
async function scan() {
  scanning.value = true; notice.value = ''; failure.value = ''
  try { await scanRequirementAsdmStage(props.requirementKey, props.stageKey); notice.value = '已加入补扫队列'; await load() }
  catch (error) { failure.value = message(error) }
  finally { scanning.value = false }
}
async function decideFile(file: AsdmCandidateFile, decision: 'INCLUDE' | 'EXCLUDE') {
  if (!candidate.value) return
  busyPath.value = file.path; notice.value = ''; failure.value = ''
  try {
    const response = await updateRequirementAsdmAssociation(props.requirementKey, props.stageKey, {
      candidateId: candidate.value.candidateId,
      expectedRevision: candidate.value.revision,
      expectedVersion: candidate.value.versionNo ?? stageInfo.value?.versionNo ?? 0,
      path: file.path,
      decision,
    })
    setCandidate(response)
    notice.value = decision === 'INCLUDE' ? '文件已纳入候选，快照需要重新确认' : '文件已排除'
    await load()
  } catch (error) { failure.value = message(error) }
  finally { busyPath.value = '' }
}
async function retryPackage() {
  if (packageId.value == null) return
  retrying.value = true; notice.value = ''; failure.value = ''
  try { await retryRequirementAsdmPackage(props.requirementKey, packageId.value); notice.value = '已受理失败文件重试'; await load() }
  catch (error) { failure.value = message(error) }
  finally { retrying.value = false }
}
function evidenceText(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.path || record.name || record.evidence || record.description || JSON.stringify(value))
  }
  return String(value)
}
function filesForPackage() { return packageInfo.value?.files || [] }
function progressLabel(published?: number, total?: number) { return `${published ?? 0} / ${total ?? 0}` }
watch(() => [props.requirementKey, props.stageKey, props.enabled], load)
onMounted(load)
</script>

<template>
  <section v-if="enabled" class="panel asdm-stage-panel">
    <header class="panel-head">
      <div><h2>ASDM 阶段产物</h2><p>按当前阶段规则发现文件；发布后逐项同步，全部必发项成功才会推进流程。</p></div>
      <button v-if="canManage" class="secondary" :disabled="scanning || loading" @click="scan">{{ scanning ? '补扫中…' : '重新扫描' }}</button>
    </header>
    <div v-if="loading && !stageInfo" class="muted">正在读取 ASDM 阶段状态…</div>
    <div v-else-if="failure && !stageInfo" class="callout error">暂时无法读取 ASDM 状态：{{ failure }}</div>
    <template v-else-if="stageInfo">
      <div class="stage-meta">
        <span class="state-pill" :data-status="stageInfo.status">{{ asdmStatusLabel(stageInfo.status) }}</span>
        <span v-if="stageInfo.sourceBranch || candidate?.sourceBranch">分支 {{ stageInfo.sourceBranch || candidate?.sourceBranch }}</span>
        <span v-if="stageInfo.headSha || candidate?.sourceCommitSha">Head <code>{{ (stageInfo.headSha || candidate?.sourceCommitSha || '').slice(0, 12) }}</code></span>
        <span v-if="stageInfo.ruleVersion || candidate?.ruleVersion">规则 {{ stageInfo.ruleVersion || candidate?.ruleVersion }}</span>
        <span v-if="stageInfo.lastScanTime || candidate?.lastScanTime">最近扫描 {{ new Date(stageInfo.lastScanTime || candidate?.lastScanTime || '').toLocaleString() }}</span>
      </div>
      <div v-if="stageInfo.markerEvidence?.length || candidate?.markerEvidence?.length" class="evidence">
        <strong>标志产物证据</strong>
        <span v-for="(entry, index) in (stageInfo.markerEvidence || candidate?.markerEvidence || [])" :key="index">{{ evidenceText(entry) }}</span>
      </div>
      <p v-if="stageInfo.lastErrorCode" class="callout error">最近错误：{{ stageInfo.lastErrorCode }}</p>
      <div v-if="hasCandidate" class="candidate-summary">
        <div><strong>候选 revision {{ candidate?.revision }}</strong><span>第 {{ candidate?.attemptNo }} 轮 · {{ candidate?.markerReady ? '标志条件已满足' : '等待标志条件' }}</span></div>
        <span v-if="candidate?.notifyAfter">静默截止 {{ new Date(candidate.notifyAfter).toLocaleString() }}</span>
        <div class="counts">
          <span>自动收录 {{ candidateCounts.confirmed ?? 0 }}</span><span>疑似归属 {{ candidateCounts.likely ?? 0 }}</span>
          <span>归属不明 {{ candidateCounts.uncertain ?? 0 }}</span><span>外部引用 {{ candidateCounts.externalRefs ?? 0 }}</span>
        </div>
        <p>疑似归属文件默认不自动发布；外部仓文件只提供引用，不代表已同步代码。</p>
      </div>
      <div v-else class="muted">{{ stageInfo.triggerReady ? '标志产物已满足，等待候选快照。' : '尚未满足当前阶段的产物触发条件。' }}</div>

      <div v-if="hasCandidate" class="file-groups">
        <section v-if="groupedFiles.confirmed.length" class="file-group">
          <h3>自动收录 <span>{{ groupedFiles.confirmed.length }}</span></h3>
          <article v-for="file in groupedFiles.confirmed" :key="file.path" class="file-row">
            <div class="file-title"><strong>{{ file.path }}</strong><span>{{ kindLabel(file.deliverAs) }} · {{ sizeLabel(file.sizeBytes) }}</span></div>
            <p>{{ file.reason || '与当前需求和阶段强关联' }}</p>
            <a v-if="file.gitlabUrl" :href="file.gitlabUrl" target="_blank" rel="noopener noreferrer">在 GitLab 查看 ↗</a>
          </article>
        </section>
        <section v-if="groupedFiles.likely.length || groupedFiles.uncertain.length" class="file-group review-group">
          <h3>疑似归属 / 待确认 <span>{{ groupedFiles.likely.length + groupedFiles.uncertain.length }}</span></h3>
          <article v-for="file in [...groupedFiles.likely, ...groupedFiles.uncertain]" :key="file.path" class="file-row">
            <div class="file-title"><strong>{{ file.path }}</strong><span>{{ file.association === 'LIKELY' ? '推断关联' : file.association === 'OVERSIZE' ? '超出大小限制' : '归属不明' }} · {{ sizeLabel(file.sizeBytes) }}</span></div>
            <p>{{ file.reason || '需要负责人确认是否属于本需求' }}</p>
            <div class="file-actions">
              <a v-if="file.gitlabUrl" :href="file.gitlabUrl" target="_blank" rel="noopener noreferrer">GitLab ↗</a>
              <button v-if="canManage && !file.selected && file.association !== 'OVERSIZE'" :disabled="busyPath === file.path" @click="decideFile(file, 'INCLUDE')">{{ busyPath === file.path ? '处理中…' : '确认纳入' }}</button>
              <button v-if="canManage && file.selected" :disabled="busyPath === file.path" @click="decideFile(file, 'EXCLUDE')">确认排除</button>
              <button v-else-if="canManage && file.association !== 'OVERSIZE'" class="quiet" :disabled="busyPath === file.path" @click="decideFile(file, 'EXCLUDE')">排除</button>
            </div>
          </article>
        </section>
        <section v-if="groupedFiles.external.length" class="file-group">
          <h3>外部仓引用 <span>{{ groupedFiles.external.length }}</span></h3>
          <article v-for="file in groupedFiles.external" :key="file.path" class="file-row"><div class="file-title"><strong>{{ file.path }}</strong><span>仅链接</span></div><p>{{ file.reason || '外部仓库内容不会通过 ASDM 仓库凭证复制' }}</p><a v-if="file.gitlabUrl" :href="file.gitlabUrl" target="_blank" rel="noopener noreferrer">打开外部链接 ↗</a></article>
        </section>
        <section v-if="groupedFiles.excluded.length" class="file-group excluded-group">
          <details><summary>排除文件（{{ groupedFiles.excluded.length }}）</summary><article v-for="file in groupedFiles.excluded" :key="file.path" class="file-row"><strong>{{ file.path }}</strong><p>{{ file.reason || '不符合自动发布范围' }}</p></article></details>
        </section>
      </div>
      <div v-if="packageInfo" class="package-progress">
        <header><div><h3>飞书同步进度</h3><span class="state-pill" :data-status="packageInfo.status">{{ asdmStatusLabel(packageInfo.status) }}</span></div><button v-if="canManage && filesForPackage().some(file => isRetryableFile(file.publishStatus))" class="secondary" :disabled="retrying" @click="retryPackage">{{ retrying ? '重试中…' : '重试失败项' }}</button></header>
        <div class="progress-counts"><span>文档 {{ progressLabel(packageInfo.docxPublished, packageInfo.docxTotal) }}</span><span>附件 {{ progressLabel(packageInfo.attachmentPublished, packageInfo.attachmentTotal) }}</span></div>
        <a v-if="packageInfo.indexUrl" :href="packageInfo.indexUrl" target="_blank" rel="noopener noreferrer">打开阶段包索引 ↗</a>
        <article v-for="file in filesForPackage()" :key="file.path" class="package-file"><strong>{{ file.path }}</strong><span>{{ file.publishStatus }}</span><a v-if="file.feishuUrl" :href="file.feishuUrl" target="_blank" rel="noopener noreferrer">查看飞书文件</a><small v-if="file.lastErrorCode" class="error-text">{{ file.lastErrorCode }}</small></article>
      </div>
      <p v-if="notice" class="callout success">{{ notice }}</p>
      <p v-if="failure && stageInfo" class="callout error">{{ failure }}</p>
      <button class="refresh" :disabled="loading" @click="load">刷新状态</button>
    </template>
  </section>
</template>

<style scoped>
.asdm-stage-panel{border-color:var(--border-accent)}.panel-head,.package-progress header{display:flex;align-items:center;justify-content:space-between;gap:14px}.panel-head p{margin:4px 0 0;color:var(--text-3);font-size:11px}.panel-head h2{margin:0}.stage-meta{display:flex;flex-wrap:wrap;gap:8px 15px;padding:10px 0;color:var(--text-3);font-size:11px}.stage-meta code{color:var(--text-2)}.state-pill{display:inline-flex;padding:4px 8px;border-radius:99px;background:var(--accent-soft);color:var(--accent-400);font-size:10px}.state-pill[data-status="AUTH_PAUSED"],.state-pill[data-status="ERROR"],.state-pill[data-status="PARTIAL_FAILED"]{background:var(--error-soft);color:var(--error)}.state-pill[data-status="PUBLISHED"],.state-pill[data-status="COMPLETED"]{background:#e9f9f2;color:#16815c}.evidence,.candidate-summary{display:grid;gap:7px;padding:12px;margin:7px 0;border:1px solid var(--border-1);border-radius:9px;background:var(--surface-2);font-size:11px;color:var(--text-2)}.evidence strong,.candidate-summary strong{color:var(--text-1)}.candidate-summary>div:first-child{display:flex;justify-content:space-between;gap:8px}.candidate-summary p{margin:0;color:var(--text-3)}.counts,.progress-counts{display:flex;flex-wrap:wrap;gap:7px}.counts span,.progress-counts span{padding:5px 8px;border-radius:6px;background:var(--surface-1);font-size:10px}.file-groups{display:grid;gap:12px;margin-top:14px}.file-group{padding:12px;border:1px solid var(--border-1);border-radius:9px}.file-group h3,.package-progress h3{margin:0 0 8px;font-size:12px}.file-group h3 span{margin-left:5px;color:var(--text-3);font-weight:400}.file-row{padding:9px 0;border-top:1px solid var(--border-1);font-size:11px}.file-row:first-of-type{border-top:0}.file-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.file-title strong,.package-file strong{overflow-wrap:anywhere;color:var(--text-1)}.file-title span,.file-row p,.package-file small{color:var(--text-3)}.file-row p{margin:4px 0}.file-row a,.package-progress>a,.package-file a{color:var(--accent-400);text-decoration:none}.file-actions{display:flex;align-items:center;gap:10px;margin-top:6px}.file-actions button,.refresh{border:0;background:none;color:var(--accent-400);padding:0;cursor:pointer;font:inherit}.file-actions button.quiet{color:var(--text-3)}.file-actions button:disabled,.refresh:disabled{opacity:.5}.excluded-group summary{cursor:pointer;color:var(--text-3);font-size:11px}.package-progress{display:grid;gap:9px;margin-top:16px;padding:12px;border-radius:9px;background:var(--surface-2)}.package-progress header{align-items:flex-start}.package-progress header>div{display:grid;gap:5px}.package-file{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:7px;border-top:1px solid var(--border-1);font-size:10px}.package-file strong{flex:1 1 55%}.error-text{color:var(--error)!important}.callout{padding:9px 11px;border-radius:7px;font-size:11px}.callout.error{background:var(--error-soft);color:var(--error)}.callout.success{background:#e9f9f2;color:#16815c}.muted{color:var(--text-3);font-size:11px;padding:10px 0}.refresh{margin-top:10px;font-size:11px}@media(max-width:650px){.panel-head,.candidate-summary>div:first-child{align-items:flex-start;flex-direction:column}.file-title{flex-direction:column}}
</style>
