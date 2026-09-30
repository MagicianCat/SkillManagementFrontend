<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getGitStageStatus, refreshGitStage, type GitStageStatus } from '../../api/git.api'
import { completeExternalWorkflowStage } from '../../api/workflow.api'

const props = defineProps<{ runId: string; stageRunId: string; readonly?: boolean; eventSequence?: number }>()
const emit = defineEmits<{ completed: [] }>()
const data = ref<GitStageStatus | null>(null); const busy = ref(false); const completing = ref(false); const error = ref(''); const comment = ref('')
const newCommitCount = computed(() => data.value?.watches.reduce((n, watch) => n + watch.commits.filter(c => c.observationType !== 'INITIAL').length, 0) ?? 0)
function short(value?: string | null){ return value ? value.slice(0, 8) : '—' }
function time(value?: string | null){ return value ? new Date(value).toLocaleString() : '尚未检查' }
async function load(){ if(!props.runId||!props.stageRunId)return; try{data.value=await getGitStageStatus(props.runId,props.stageRunId);error.value=''}catch(c:any){error.value=c?.response?.data?.message||'Git 状态加载失败'} }
async function refresh(){busy.value=true;try{data.value=await refreshGitStage(props.runId,props.stageRunId)}catch(c:any){error.value=c?.response?.data?.message||'Git 检查失败'}finally{busy.value=false}}
async function complete(){if(newCommitCount.value===0&&!window.confirm('当前未检测到相对 baseline 的新提交，是否仍然完成该编码阶段？'))return;completing.value=true;try{await completeExternalWorkflowStage(props.runId,props.stageRunId,comment.value.trim()||undefined);emit('completed')}catch(c:any){error.value=c?.response?.data?.message||'编码阶段完成失败'}finally{completing.value=false}}
watch(()=>[props.runId,props.stageRunId],()=>void load());watch(()=>props.eventSequence,()=>void load());onMounted(()=>void load())
</script>

<template>
  <section class="git-panel panel">
    <header><div><p class="eyebrow">LOCAL / GIT WATCH</p><h3>代码仓库监听</h3><p>平台只读跟踪分支提交；编码与推送仍在本地 IDE 完成。</p></div><button type="button" :disabled="busy" @click="refresh">{{ busy ? '检查中…' : '立即检查' }}</button></header>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!data?.watches.length" class="empty">当前阶段尚未绑定代码仓库，可返回研发配置页追加。</p>
    <article v-for="watch in data?.watches" :key="watch.id" class="watch-card">
      <div class="watch-head"><div><strong>{{ watch.repositoryName }}</strong><small>{{ watch.branch }} · {{ watch.normalizedUrl }}</small></div><span :class="`status ${watch.status.toLowerCase()}`">{{ watch.status }}</span></div>
      <div class="sha-row"><span>Baseline <code>{{ short(watch.baselineCommit) }}</code></span><span>Latest <code>{{ short(watch.latestCommit) }}</code></span><span>检查于 {{ time(watch.lastPolledAt) }}</span></div>
      <p v-if="watch.lastError" class="error">{{ watch.lastError }}</p>
      <ol class="commits"><li v-for="commit in watch.commits" :key="commit.commitSha"><code>{{ short(commit.commitSha) }}</code><span>{{ commit.subject || (commit.observationType === 'INITIAL' ? '阶段启动基线' : '检测到新提交') }}</span><time>{{ time(commit.commitTime || commit.observedAt) }}</time></li></ol>
    </article>
    <footer v-if="!readonly && data?.stageStatus==='RUNNING'"><textarea v-model="comment" rows="2" placeholder="完成说明（可选）"/><button class="primary" type="button" :disabled="completing" @click="complete">{{ completing ? '提交中…' : `完成${data.stageKey==='BACKEND_CODING'?'后端':'前端'}编码` }}</button></footer>
  </section>
</template>

<style scoped>
.git-panel{display:grid;gap:12px;padding:16px;border:1px solid var(--border-1);border-radius:var(--radius-md);background:var(--surface-1)}header,.watch-head,.sha-row,footer{display:flex;align-items:center;justify-content:space-between;gap:12px}h3{margin:3px 0;color:var(--text-1)}header p{margin:0;color:var(--text-3);font-size:12px}.eyebrow{color:var(--accent-400)!important}.watch-card{display:grid;gap:10px;padding:14px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:var(--surface-2)}.watch-head strong,.watch-head small{display:block}.watch-head small{margin-top:4px;color:var(--text-3);overflow-wrap:anywhere}.status{padding:3px 8px;border-radius:10px;color:var(--info);background:var(--info-soft);font-size:11px}.status.error,.status.branch_missing{color:var(--error);background:var(--error-soft)}.status.changed{color:var(--success);background:var(--success-soft)}.sha-row{justify-content:flex-start;flex-wrap:wrap;color:var(--text-3);font-size:11px}.sha-row code,.commits code{color:var(--accent-300)}.commits{display:grid;gap:7px;margin:0;padding:0;list-style:none}.commits li{display:grid;grid-template-columns:80px 1fr auto;gap:10px;color:var(--text-2);font-size:12px}.commits time{color:var(--text-3)}footer textarea{flex:1;padding:9px;border:1px solid var(--border-2);border-radius:6px;background:var(--bg-2);color:var(--text-1)}button{padding:8px 12px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface-2);color:var(--text-1);cursor:pointer}.primary{border-color:var(--accent-500);background:var(--accent-600);color:#fff}.error{color:var(--error)}.empty{color:var(--text-3)}
</style>
