<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { COLLAB_STAGES } from '../../api/collab-projects.api'
import { getGroupAsdmRules, previewGroupAsdmRules, resetGroupAsdmRuleStage, saveGroupAsdmRules, type AsdmGroupRulesView, type AsdmRuleStage, type RequirementSummary } from '../../api/collab-groups.api'

const props = defineProps<{ groupKey: string; isOwner: boolean; requirements: RequirementSummary[] }>()
type RuleDraft = { enabled: boolean; addIncludeGlobs: string[]; excludeGlobs: string[]; disabledIncludeGlobs: string[]; addMarkerGlobs: string[]; markerGroups: string[][]; relativeBase: string }
const view = ref<AsdmGroupRulesView | null>(null)
const stageKey = ref<string>(COLLAB_STAGES[0].key)
const drafts = ref<Record<string, RuleDraft>>({})
const savedDrafts = ref<Record<string, RuleDraft>>({})
const busy = ref(false)
const error = ref('')
const notice = ref('')
const preview = ref<{ stageKey: string; headSha?: string; matchedPaths?: string[]; unmatchedPaths?: string[] } | null>(null)
const stageRules = computed(() => ruleStages(view.value))
const currentRules = computed(() => stageRules.value.find(stage => stage.stageKey === stageKey.value))
const currentDraft = computed(() => drafts.value[stageKey.value])
const markerGroupsText = computed(() => {
  const draft = currentDraft.value
  if (!draft) return ''
  const groups = (draft.markerGroups.length
    ? draft.markerGroups
    : currentRules.value?.defaultRules?.markerGroups || []).map(group => [...group])
  if (draft.addMarkerGlobs.length) {
    if (!groups.length) groups.push([])
    groups[0] = [...groups[0], ...draft.addMarkerGlobs]
  }
  return groups.map(group => group.join(' | ')).join('\n')
})
const effectiveRules = computed(() => {
  const rules = currentRules.value
  const draft = currentDraft.value
  if (!rules || !draft) return null
  const defaults = rules.defaultRules || {}
  const includes = (defaults.includeGlobs || []).filter(pattern => !draft.disabledIncludeGlobs.includes(pattern))
  for (const pattern of draft.addIncludeGlobs) if (!includes.includes(pattern)) includes.push(pattern)
  const markers = (draft.markerGroups.length
    ? draft.markerGroups
    : defaults.markerGroups || []).map(group => [...group])
  if (draft.addMarkerGlobs.length) {
    if (!markers.length) markers.push([])
    markers[0] = [...markers[0], ...draft.addMarkerGlobs]
  }
  return {
    enabled: draft.enabled,
    includeGlobs: includes,
    excludeGlobs: [...new Set([...(defaults.excludeGlobs || []), ...draft.excludeGlobs])],
    markerGroups: markers,
    relativeBase: draft.relativeBase.trim() || null,
  }
})
const dirty = computed(() => Boolean(currentDraft.value && JSON.stringify(currentDraft.value) !== JSON.stringify(savedDrafts.value[stageKey.value])))
function ruleStages(data: AsdmGroupRulesView | null): AsdmRuleStage[] {
  if (!data?.stages) return []
  return Array.isArray(data.stages) ? data.stages : Object.entries(data.stages).map(([key, value]) => ({ ...value, stageKey: value.stageKey || key }))
}
function lines(value?: string[]) { return (value || []).join('\n') }
function parseLines(value: string) { return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean) }
function parseMarkerGroups(value: string) {
  return parseLines(value).map(line => line.split('|').map(pattern => pattern.trim()).filter(Boolean)).filter(group => group.length)
}
function normalized(stage: AsdmRuleStage): RuleDraft { const overrides = stage.overrides || {}; return { enabled: stage.enabled !== false, addIncludeGlobs: [...(overrides.addIncludeGlobs || [])], excludeGlobs: [...(overrides.excludeGlobs || [])], disabledIncludeGlobs: [...(overrides.disabledIncludeGlobs || [])], addMarkerGlobs: [...(overrides.addMarkerGlobs || [])], markerGroups: (overrides.markerGroups || []).map(group => [...group]), relativeBase: overrides.relativeBase || '' } }
function hydrate(data: AsdmGroupRulesView) { view.value = data; const rows = ruleStages(data); const entries = Object.fromEntries(rows.map(stage => [stage.stageKey, normalized(stage)])); drafts.value = entries; savedDrafts.value = JSON.parse(JSON.stringify(entries)); if (!rows.some(row => row.stageKey === stageKey.value) && rows.length) stageKey.value = rows[0].stageKey }
function msg(e: unknown) { return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || '请求失败' }
async function load() { busy.value = true; error.value = ''; try { hydrate(await getGroupAsdmRules(props.groupKey)) } catch (e) { error.value = msg(e) } finally { busy.value = false } }
async function save() { if (!view.value || !currentDraft.value || !dirty.value) return; busy.value = true; error.value = ''; notice.value = ''; try { const stages = Object.fromEntries(Object.entries(drafts.value).map(([key, draft]) => [key, { enabled: draft.enabled, addIncludeGlobs: draft.addIncludeGlobs, excludeGlobs: draft.excludeGlobs, disabledIncludeGlobs: draft.disabledIncludeGlobs, addMarkerGlobs: draft.addMarkerGlobs, markerGroups: draft.markerGroups, relativeBase: draft.relativeBase.trim() || null }])); hydrate(await saveGroupAsdmRules(props.groupKey, { expectedRevision: view.value.revision, stages })); notice.value = 'ASDM 产物规则已保存；已有需求点击一键同步后才会切换到新版本。' } catch (e) { error.value = msg(e) } finally { busy.value = false } }
async function reset() { if (!view.value || !props.isOwner) return; busy.value = true; error.value = ''; notice.value = ''; try { hydrate(await resetGroupAsdmRuleStage(props.groupKey, stageKey.value, view.value.revision)); notice.value = '本阶段已恢复系统默认规则。' } catch (e) { error.value = msg(e) } finally { busy.value = false } }
async function runPreview() { if (!currentDraft.value) return; busy.value = true; error.value = ''; preview.value = null; try { const requirement = props.requirements.find(item => item.asdmBranch); if (!requirement) { error.value = '请先创建并绑定 ASDM 分支的需求，再进行匹配预览。'; return } preview.value = await previewGroupAsdmRules(props.groupKey, { stageKey: stageKey.value, requirementKey: requirement.requirementKey, overrides: { enabled: currentDraft.value.enabled, addIncludeGlobs: currentDraft.value.addIncludeGlobs, excludeGlobs: currentDraft.value.excludeGlobs, disabledIncludeGlobs: currentDraft.value.disabledIncludeGlobs, addMarkerGlobs: currentDraft.value.addMarkerGlobs, markerGroups: currentDraft.value.markerGroups, relativeBase: currentDraft.value.relativeBase || null } }) } catch (e) { error.value = msg(e) } finally { busy.value = false } }
function stageTitle(key: string) { return COLLAB_STAGES.find(stage => stage.key === key)?.title || key }
watch(stageRules, rows => { if (rows.length && !rows.some(row => row.stageKey === stageKey.value)) stageKey.value = rows[0].stageKey })
onMounted(load)
</script>

<template>
  <section v-if="view" class="rules-panel">
    <header class="rules-header"><div><h2>ASDM 产物规则</h2><p>路径以 ASDM 仓库根目录为基准。项目组规则版本独立于角色模板版本。</p></div><button class="quiet" :disabled="busy" @click="load">刷新</button></header>
    <div class="version-row"><span>系统默认 {{view.defaultVersion}}</span><span>项目组版本 {{view.revision}}</span><span>最近修改人 {{view.updatedBy||'—'}}</span></div>
    <nav class="stage-tabs"><button v-for="stage in COLLAB_STAGES" :key="stage.key" :class="{selected:stageKey===stage.key}" @click="stageKey=stage.key">{{stage.title}}</button></nav>
    <template v-if="currentRules && currentDraft">
      <div class="rules-stage-heading"><h3>{{stageTitle(stageKey)}}</h3><label><input v-model="currentDraft.enabled" type="checkbox" :disabled="!isOwner||busy">启用本阶段 ASDM 检测</label></div>
      <section v-if="effectiveRules" class="effective-rules">
        <div class="effective-heading"><h4>当前最终生效规则</h4><small>{{dirty ? '含未保存修改' : '已保存配置'}}</small></div>
        <div class="effective-grid">
          <div><strong>检测状态</strong><span>{{effectiveRules.enabled ? '已启用' : '已停用'}}</span></div>
          <div><strong>目录前缀</strong><code>{{effectiveRules.relativeBase || '未设置'}}</code></div>
          <div><strong>包含路径（{{effectiveRules.includeGlobs.length}}）</strong><ul><li v-for="pattern in effectiveRules.includeGlobs" :key="pattern"><code>{{pattern}}</code></li><li v-if="!effectiveRules.includeGlobs.length" class="empty">没有生效的包含路径</li></ul></div>
          <div><strong>触发标志规则（每组任选一项，组间必须同时满足）</strong><ul><li v-for="(group,index) in effectiveRules.markerGroups" :key="index"><code>{{group.join(' | ')}}</code></li><li v-if="!effectiveRules.markerGroups.length" class="empty">没有配置触发标志规则</li></ul></div>
          <div><strong>排除路径（{{effectiveRules.excludeGlobs.length}}）</strong><ul><li v-for="pattern in effectiveRules.excludeGlobs" :key="pattern"><code>{{pattern}}</code></li><li v-if="!effectiveRules.excludeGlobs.length" class="empty">没有排除路径</li></ul></div>
        </div>
      </section>
      <div class="rules-columns"><div class="rules-column"><section><h4>常见目录前缀 <small>可选</small></h4><input v-model="currentDraft.relativeBase" :disabled="!isOwner||busy" placeholder="例如 workspace/requirements/${REQ_DIR}"></section><section><h4>触发标志规则 <small>每行一个必需条件，同行用 | 表示任选其一</small></h4><p class="marker-hint">{{!currentDraft.markerGroups.length && !currentDraft.addMarkerGlobs.length ? '当前显示系统默认规则；修改后将保存为本组规则。' : '当前使用本组自定义规则。'}}</p><textarea :value="markerGroupsText" :disabled="!isOwner||busy" spellcheck="false" placeholder="每行一个必须满足的条件；同行用 | 分隔可选路径\n例如：\nworkspace/**/spec.md | ${REQ_PATH}/spec.md\nworkspace/**/review.md" @input="currentDraft.markerGroups=parseMarkerGroups(($event.target as HTMLTextAreaElement).value); currentDraft.addMarkerGlobs=[]"></textarea></section></div><div class="rules-column"><section><h4>本组新增包含路径</h4><textarea :value="lines(currentDraft.addIncludeGlobs)" :disabled="!isOwner||busy" spellcheck="false" placeholder="每行一个 glob，例如 workspace/new-design/**/*.md" @input="currentDraft.addIncludeGlobs=parseLines(($event.target as HTMLTextAreaElement).value)"></textarea></section><section><h4>禁用默认包含路径</h4><textarea :value="lines(currentDraft.disabledIncludeGlobs)" :disabled="!isOwner||busy" spellcheck="false" placeholder="填写需要禁用的默认 glob" @input="currentDraft.disabledIncludeGlobs=parseLines(($event.target as HTMLTextAreaElement).value)"></textarea></section><section><h4>排除路径 <small>优先于包含路径</small></h4><textarea :value="lines(currentDraft.excludeGlobs)" :disabled="!isOwner||busy" spellcheck="false" placeholder="每行一个 glob" @input="currentDraft.excludeGlobs=parseLines(($event.target as HTMLTextAreaElement).value)"></textarea></section></div></div>
      <div class="rule-actions"><span v-if="error" class="error">{{error}}</span><span v-else-if="notice" class="success">{{notice}}</span><span v-else class="rule-hint">新增路径使用有限 glob；不支持绝对路径、URL 或 `..`。</span><button class="secondary" :disabled="busy||!props.isOwner" @click="reset">恢复本阶段默认</button><button class="secondary" :disabled="busy" @click="runPreview">预览匹配</button><button v-if="isOwner" class="primary" :disabled="busy||!dirty" @click="save">{{busy?'处理中…':'保存规则'}}</button></div>
      <section v-if="preview" class="preview-results"><strong>预览结果 <template v-if="preview.headSha">· HEAD {{preview.headSha}}</template></strong><span>匹配 {{preview.matchedPaths?.length||0}} 个，未匹配 {{preview.unmatchedPaths?.length||0}} 个</span><ul><li v-for="path in preview.matchedPaths||[]" :key="path">命中 · {{path}}</li><li v-for="path in preview.unmatchedPaths||[]" :key="path">未命中 · {{path}}</li></ul></section>
    </template>
  </section>
  <section v-else-if="error" class="rules-panel rules-error"><strong>ASDM 产物规则</strong><span>{{error}}</span><button class="secondary" :disabled="busy" @click="load">重试</button></section>
</template>

<style scoped>
.rules-panel{padding:18px 20px;margin:0 0 16px;border:1px solid var(--border-accent);border-radius:12px;background:var(--surface-1);color:var(--text-1)}.rules-header{display:flex;justify-content:space-between;align-items:center}.rules-header h2{margin:0 0 5px;font-size:16px}.rules-header p{margin:0;color:var(--text-3);font-size:11px}.version-row{display:flex;gap:18px;flex-wrap:wrap;margin:13px 0;padding:10px 12px;border-radius:8px;background:var(--surface-2);font-size:11px;color:var(--text-2)}.stage-tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:8px}.stage-tabs button,.quiet,.primary,.secondary{border:0;border-radius:7px;padding:8px 10px;cursor:pointer}.stage-tabs button{white-space:nowrap;background:transparent;color:var(--text-3);font-size:11px}.stage-tabs button.selected{background:var(--accent-soft);color:var(--accent-400)}.rules-stage-heading{display:flex;justify-content:space-between;align-items:center;padding:8px 0 12px}.rules-stage-heading h3{margin:0;font-size:13px}.rules-stage-heading label{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--text-2)}.rules-column section{min-width:0;padding:11px;border:1px solid var(--border-1);border-radius:8px}.effective-rules{margin:0 0 10px;padding:12px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-2)}.effective-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.effective-heading h4{margin:0;font-size:11px}.effective-heading small{color:var(--text-3);font-size:10px}.effective-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.effective-grid>div{min-width:0;padding:9px;border:1px solid var(--border-1);border-radius:7px;background:var(--surface-1)}.effective-grid>div:first-child,.effective-grid>div:nth-child(2){display:flex;justify-content:space-between;gap:8px}.effective-grid strong{display:block;margin-bottom:6px;font-size:10px;color:var(--text-2)}.effective-grid>div:first-child strong,.effective-grid>div:nth-child(2) strong{margin:0}.effective-grid ul{max-height:120px;overflow:auto;margin:0;padding-left:16px;color:var(--text-2);font-size:10px}.effective-grid code{overflow-wrap:anywhere;font-size:10px}.rules-column h4{margin:0 0 8px;font-size:11px}.rules-column h4 small{font-weight:400;color:var(--text-3)}.rules-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}.rules-column{display:grid;gap:10px;min-width:0}.rules-column textarea,.rules-column input{box-sizing:border-box;width:100%;min-height:78px;padding:8px;border:1px solid var(--border-2);border-radius:7px;background:var(--surface-2);color:var(--text-1);font:11px var(--font-mono);resize:vertical}.rules-column input{min-height:0}.marker-hint{margin:0 0 6px;color:var(--text-3);font-size:10px}.empty{color:var(--text-3);font-style:italic}.rule-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:12px}.rule-hint{flex:1;color:var(--text-3);font-size:10px}.primary{background:var(--accent-600);color:#fff}.secondary{background:var(--surface-3);color:var(--text-1)}.quiet{background:none;color:var(--accent-400)}button:disabled{opacity:.5;cursor:not-allowed}.error{color:var(--error);font-size:11px}.success{flex:1;color:var(--success);font-size:10px}.preview-results{display:grid;gap:7px;margin-top:13px;padding:12px;border:1px solid var(--border-1);border-radius:8px;font-size:11px}.preview-results span{color:var(--text-3)}.preview-results ul{max-height:150px;overflow:auto;margin:0;padding-left:18px;color:var(--text-2);font-size:10px}.rules-error{display:flex;align-items:center;gap:12px}.rules-error span{flex:1;color:var(--error);font-size:11px}@media(max-width:750px){.rules-columns,.effective-grid{grid-template-columns:1fr}.rule-actions{justify-content:flex-start}.rule-hint{flex-basis:100%}}
</style>
