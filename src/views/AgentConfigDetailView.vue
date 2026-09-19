<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getAgentProfile, publishAgentProfileVersion, saveAgentProfileVersion } from '../api/agent-config.api'
import { forkAgent } from '../api/agent-library.api'
import { getSkills } from '../api/skills.api'
import type { AgentProfile, AgentProfileVersion } from '../api/agent-config.api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const profile = ref<AgentProfile | null>(null)
const draft = ref<AgentProfileVersion | null>(null)
const editing = ref(false)
const tab = ref('overview')
const message = ref('')
const skillsJson = ref('[]')
const toolsJson = ref('[]')
const schemaJson = ref('{}')
const runtimeJson = ref('{}')
const skillQuery = ref('')
const skillOptions = ref<Array<{ skillId: number; skillKey: string; displayName: string; description?: string }>>([])
const createsNewVersion = ref(false)
const canEdit = computed(() => {
  const current = profile.value
  if (!current || current.sourceType === 'SYSTEM') return false
  return current.ownerUserId != null && auth.user?.id != null && String(current.ownerUserId) === String(auth.user.id)
})

function formatJson(value: unknown, fallback: string) { return typeof value === 'string' ? value : JSON.stringify(value ?? JSON.parse(fallback), null, 2) }
function beginEdit(version = profile.value?.latestVersion) {
  if (!version) return
  createsNewVersion.value = version.status !== 'DRAFT'
  draft.value = { ...version, id: undefined, status: 'DRAFT', skills: [...(version.skills ?? [])], tools: [...(version.tools ?? [])] }
  skillsJson.value = formatJson(draft.value.skills, '[]'); toolsJson.value = formatJson(draft.value.tools, '[]'); schemaJson.value = formatJson(draft.value.outputSchemaJson, '{}'); runtimeJson.value = formatJson(draft.value.runtimeConfigJson, '{}'); editing.value = true
}
async function load() { try { profile.value = await getAgentProfile(String(route.params.code)) } catch (cause) { message.value = cause instanceof Error ? cause.message : '详情加载失败' } }
async function searchSkills() { const result = await getSkills({ keyword: skillQuery.value.trim() || undefined, page: 0, size: 30 }); skillOptions.value = result.items.map((skill) => ({ skillId: skill.id, skillKey: skill.skillKey, displayName: skill.displayName, description: skill.description })) }
function toggleSkill(option: { skillId: number; skillKey: string; displayName: string; description?: string }) { if (!draft.value) return; const existing = draft.value.skills?.find((skill) => skill.skillKey === option.skillKey); draft.value.skills = existing ? draft.value.skills?.filter((skill) => skill.skillKey !== option.skillKey) : [...(draft.value.skills ?? []), { skillId: option.skillId, skillKey: option.skillKey, name: option.displayName, versionPolicy: 'LATEST_PUBLISHED', required: false, sortOrder: (draft.value.skills?.length ?? 0) + 1 }] }
async function save() {
  if (!profile.value || !draft.value) return
  try { const payload = { ...draft.value, id: undefined, status: 'DRAFT' as const, skills: draft.value.skills ?? JSON.parse(skillsJson.value), tools: JSON.parse(toolsJson.value), outputSchemaJson: JSON.parse(schemaJson.value), runtimeConfigJson: JSON.parse(runtimeJson.value) }; const saved = await saveAgentProfileVersion(profile.value.code, payload, { createNewVersion: createsNewVersion.value }); profile.value.latestVersion = saved; editing.value = false; createsNewVersion.value = false; message.value = `草稿 v${saved.versionNo} 已保存` } catch (cause) { message.value = cause instanceof Error ? cause.message : '保存失败，请检查 JSON 格式' }
}
async function publish() { const version = profile.value?.latestVersion; if (!profile.value || !version) return; try { await publishAgentProfileVersion(profile.value.code, version.versionNo); message.value = '版本已发布'; await load() } catch (cause) { message.value = cause instanceof Error ? cause.message : '发布失败' } }
async function fork() { if (!profile.value) return; try { const copy = await forkAgent(profile.value.code, { newCode: `${profile.value.code}-fork`, newName: `${profile.value.name} Fork`, versionNo: profile.value.latestVersion?.versionNo }); await router.push({ name: 'agent-config-detail', params: { code: copy.code } }) } catch (cause) { message.value = cause instanceof Error ? cause.message : 'Fork 失败' } }
onMounted(load)
</script>

<template>
  <main class="agent-detail">
    <p v-if="message" class="notice">{{ message }}</p>
    <template v-if="profile">
      <header><div><span class="eyebrow">{{ profile.category }} · {{ profile.code }} · {{ profile.sourceType || 'USER' }}</span><h1>{{ profile.name }}</h1><p>{{ profile.description }}</p></div><div class="actions"><button v-if="!editing" type="button" @click="fork">基于此创建 Agent</button><button v-if="!editing && canEdit" type="button" @click="beginEdit()">{{ profile.latestVersion?.status === 'PUBLISHED' ? '基于此创建草稿' : '编辑草稿' }}</button><button v-if="editing && canEdit" type="button" class="primary" @click="save">保存草稿</button><button v-if="!editing && canEdit && profile.latestVersion?.status === 'DRAFT'" type="button" class="primary" @click="publish">发布当前版本</button></div></header>
      <nav class="tabs"><button v-for="item in [['overview','基本信息'],['prompt','System Prompt'],['skills','Skills'],['tools','Tools & 权限'],['runtime','Model / Runtime'],['schema','Output Schema'],['versions','版本记录']]" :key="item[0]" type="button" :class="{active:tab===item[0]}" @click="tab=String(item[0])">{{ item[1] }}</button></nav>
      <section class="panel">
        <template v-if="editing && draft"><label>System Prompt<textarea v-model="draft.systemPrompt" rows="9" /></label><div class="form-grid"><label>Model<input v-model="draft.modelCode" /></label><label>Temperature<input v-model.number="draft.temperature" type="number" step="0.1" min="0" max="2" /></label><label>Max Iteration<input v-model.number="draft.maxIterationPerRun" type="number" min="1" /></label><label>Timeout（秒）<input v-model.number="draft.timeoutSeconds" type="number" min="1" /></label></div><div class="skill-picker" data-testid="agent-profile-skills"><div class="skill-search"><input v-model="skillQuery" placeholder="搜索真实 Skill" @keyup.enter="searchSkills" /><button type="button" @click="searchSkills">搜索</button></div><label v-for="option in skillOptions" :key="option.skillKey" class="skill-option"><input type="checkbox" :checked="draft.skills?.some((skill) => skill.skillKey === option.skillKey)" @change="toggleSkill(option)" /><span>{{ option.displayName }}</span></label><div v-for="skill in draft.skills ?? []" :key="skill.skillKey" class="skill-binding"><strong>{{ skill.name || skill.skillKey }}</strong><select v-model="skill.versionPolicy"><option value="FIXED">FIXED</option><option value="LATEST_PUBLISHED">LATEST_PUBLISHED</option></select><input v-if="skill.versionPolicy === 'FIXED'" v-model="skill.fixedSkillVersionId" placeholder="fixedSkillVersionId" /><label><input v-model="skill.required" type="checkbox" /> Required</label><input v-model.number="skill.sortOrder" type="number" min="0" /></div></div><div class="json-grid"><label>Tools JSON<textarea data-testid="agent-profile-tools" v-model="toolsJson" rows="10" /></label><label>Output Schema JSON<textarea v-model="schemaJson" rows="10" /></label><label>Runtime Config JSON<textarea v-model="runtimeJson" rows="10" /></label></div></template>
        <template v-else-if="tab==='overview'"><dl><dt>版本</dt><dd>v{{ profile.latestVersion?.versionNo ?? '—' }} · {{ profile.latestVersion?.status ?? '—' }}</dd><dt>维护者</dt><dd>{{ profile.maintainer || '—' }}</dd><dt>迭代上限</dt><dd>{{ profile.latestVersion?.maxIterationPerRun ?? '—' }}</dd><dt>超时</dt><dd>{{ profile.latestVersion?.timeoutSeconds ?? '—' }} 秒</dd></dl></template>
        <template v-else-if="tab==='prompt'"><pre>{{ profile.latestVersion?.systemPrompt || '暂无 Prompt' }}</pre></template>
        <template v-else-if="tab==='skills'"><ul data-testid="agent-profile-skills"><li v-for="skill in profile.latestVersion?.skills ?? []" :key="skill.skillKey">{{ skill.name || skill.skillKey }} · {{ skill.versionPolicy }}</li></ul></template>
        <template v-else-if="tab==='tools'"><ul data-testid="agent-profile-tools"><li v-for="tool in profile.latestVersion?.tools ?? []" :key="tool.toolCode">{{ tool.toolCode }} · {{ tool.permissionMode }} · {{ tool.enabled ? '启用' : '禁用' }}</li></ul></template>
        <template v-else-if="tab==='runtime'"><pre>{{ JSON.stringify(profile.latestVersion?.runtimeConfigJson ?? {}, null, 2) }}</pre></template><template v-else-if="tab==='schema'"><pre>{{ JSON.stringify(profile.latestVersion?.outputSchemaJson ?? {}, null, 2) }}</pre></template><template v-else><p>已发布版本不可原地修改；可使用“基于此创建草稿”生成新版本。</p></template>
      </section>
    </template><p v-else>正在加载 Agent 配置…</p>
  </main>
</template>
<style scoped>.agent-detail{max-width:1100px;margin:auto}.agent-detail header{display:flex;justify-content:space-between;gap:20px;align-items:start}.agent-detail header p{color:var(--text-2)}.actions{display:flex;gap:8px}.actions button{padding:10px 16px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-2)}.actions .primary{color:#fff;background:var(--accent-600)}.eyebrow{color:var(--accent-500);font-size:11px;letter-spacing:.12em}.tabs{display:flex;flex-wrap:wrap;gap:5px;margin:25px 0 0;border-bottom:1px solid var(--border-1)}.tabs button{padding:11px 14px;color:var(--text-2);border:0;background:none}.tabs button.active{color:var(--accent-500);border-bottom:2px solid var(--accent-500)}.panel{min-height:300px;padding:24px;border:1px solid var(--border-1);border-top:0;background:var(--surface-1)}.panel dl{display:grid;grid-template-columns:140px 1fr;gap:14px}.panel dt{color:var(--text-2)}.panel pre{overflow:auto;white-space:pre-wrap;line-height:1.6}.panel label{display:grid;gap:6px;margin-bottom:16px;color:var(--text-2);font-size:13px}.panel input,.panel textarea{box-sizing:border-box;width:100%;padding:9px;color:var(--text-1);border:1px solid var(--border-1);border-radius:8px;background:var(--surface-2);font:inherit}.form-grid,.json-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.json-grid{margin-top:10px}.notice{color:var(--accent-500)}@media(max-width:700px){.agent-detail header{display:block}.actions{margin-top:12px}.form-grid,.json-grid{grid-template-columns:1fr}}
</style>
