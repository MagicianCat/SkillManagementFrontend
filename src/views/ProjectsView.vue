<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import { createDocumentAgentSession, createProject, createProjectDocument, listProjectDocuments, listProjects, publishProjectDocument, readDocumentAgentEvents, saveProjectDraft, sendDocumentAgentTurn, type Project, type ProjectDocument } from '../api/projects.api'

const projects = ref<Project[]>([])
const selected = ref<Project | null>(null)
const documents = ref<ProjectDocument[]>([])
const selectedDocument = ref<ProjectDocument | null>(null)
const busy = ref(false)
const newProjectName = ref('')
const newDocumentTitle = ref('')
const newDocumentType = ref('REQUIREMENT')
const draftTitle = ref('')
const draftContent = ref('')
const agentProfile = ref('requirement-analysis/v1')
const agentMessage = ref('')
const agentOutput = ref('')
const agentBusy = ref(false)
const agentSessionId = ref<string | null>(null)
const router = useRouter()

async function loadProjects() { projects.value = await listProjects(); if (!selected.value && projects.value.length) await selectProject(projects.value[0]) }
async function selectProject(project: Project) { selected.value = project; documents.value = await listProjectDocuments(project.projectKey); selectedDocument.value = documents.value[0] ?? null; syncEditor() }
function syncEditor() { draftTitle.value = selectedDocument.value?.title ?? ''; draftContent.value = selectedDocument.value?.draft?.markdownContent ?? selectedDocument.value?.published?.markdownContent ?? '' }
async function addProject() { if (!newProjectName.value.trim()) return; busy.value = true; try { const project = await createProject(newProjectName.value.trim(), ''); newProjectName.value = ''; await loadProjects(); await selectProject(project); MessagePlugin.success('项目已创建') } finally { busy.value = false } }
async function addDocument() { if (!selected.value || !newDocumentTitle.value.trim()) return; busy.value = true; try { await createProjectDocument(selected.value.projectKey, { documentType: newDocumentType.value, title: newDocumentTitle.value.trim(), markdownContent: '# ' + newDocumentTitle.value.trim() }); newDocumentTitle.value = ''; documents.value = await listProjectDocuments(selected.value.projectKey); selectedDocument.value = documents.value[0] ?? null; syncEditor(); MessagePlugin.success('文档草稿已创建') } finally { busy.value = false } }
async function saveDraft() { if (!selected.value || !selectedDocument.value) return; busy.value = true; try { selectedDocument.value = await saveProjectDraft(selected.value.projectKey, selectedDocument.value.id, { title: draftTitle.value, markdownContent: draftContent.value, versionNo: selectedDocument.value.versionNo }); documents.value = await listProjectDocuments(selected.value.projectKey); MessagePlugin.success('草稿已保存') } finally { busy.value = false } }
async function publish() { if (!selected.value || !selectedDocument.value?.draft) return; busy.value = true; try { selectedDocument.value = await publishProjectDocument(selected.value.projectKey, selectedDocument.value.id, selectedDocument.value.draft.id, selectedDocument.value.versionNo); documents.value = await listProjectDocuments(selected.value.projectKey); MessagePlugin.success('文档已发布') } finally { busy.value = false } }
async function askAgent() { if (!selected.value || !selectedDocument.value || !agentMessage.value.trim()) return; agentBusy.value = true; try { if (!agentSessionId.value) { const session = await createDocumentAgentSession(selected.value.projectKey, selectedDocument.value.id, agentProfile.value); agentSessionId.value = String(session.session_id ?? '') } const result = await sendDocumentAgentTurn(selected.value.projectKey, agentSessionId.value, agentMessage.value.trim()); agentMessage.value = ''; const job = result.job as { job_id?: string } | undefined; if (job?.job_id) { await new Promise((resolve) => setTimeout(resolve, 300)); agentOutput.value = await readDocumentAgentEvents(selected.value.projectKey, job.job_id) } } catch (error) { agentOutput.value = String(error) } finally { agentBusy.value = false } }
onMounted(() => void loadProjects())
</script>

<template>
  <div class="page-shell project-page">
    <div class="page-header"><div><h1>虚拟项目组</h1><p>项目文档控制面</p></div></div>
    <div class="project-layout">
      <aside class="project-sidebar">
        <div class="inline-form"><input v-model="newProjectName" placeholder="新项目名称" @keyup.enter="addProject"><button :disabled="busy" @click="addProject">创建</button></div>
        <button v-for="project in projects" :key="project.projectKey" class="project-item" :class="{ active: selected?.projectKey === project.projectKey }" @click="selectProject(project)">{{ project.name }}</button>
        <p v-if="!projects.length" class="muted">还没有项目组</p>
      </aside>
      <main class="project-main" v-if="selected">
        <div class="section-heading"><div><h2>{{ selected.name }}</h2><span class="muted">角色：{{ selected.role }}</span></div><button class="primary" @click="router.push({ name: 'document-agent', query: { projectKey: selected.projectKey } })">使用文档 Agent</button></div>
        <div class="document-toolbar"><select v-model="newDocumentType"><option>REQUIREMENT</option><option>PRD</option><option>ARCHITECTURE</option><option>UI_DESIGN</option></select><input v-model="newDocumentTitle" placeholder="新文档标题" @keyup.enter="addDocument"><button :disabled="busy" @click="addDocument">新建草稿</button></div>
        <div class="document-list"><button v-for="document in documents" :key="document.id" class="document-item" :class="{ active: selectedDocument?.id === document.id }" @click="selectedDocument = document; syncEditor()"><span>{{ document.title }}</span><small>{{ document.documentType }} · {{ document.status }}</small></button><p v-if="!documents.length" class="muted">选择一种文档类型开始写作</p></div>
        <section v-if="selectedDocument" class="document-editor"><input v-model="draftTitle" class="title-input"><textarea v-model="draftContent" rows="18" placeholder="使用 Markdown 编写项目文档"></textarea><div class="editor-actions"><button :disabled="busy" @click="saveDraft">保存草稿</button><button class="primary" :disabled="busy || !selectedDocument.draft" @click="publish">发布正式版本</button></div><div class="agent-box"><h3>OpenHands 文档 Agent</h3><div class="inline-form"><select v-model="agentProfile"><option value="requirement-analysis/v1">需求分析</option><option value="prd-authoring/v1">PRD</option><option value="architecture-design/v1">架构设计</option><option value="ui-design/v1">UI 设计</option></select><input v-model="agentMessage" placeholder="让 Agent 修改当前草稿" @keyup.enter="askAgent"><button :disabled="agentBusy" @click="askAgent">发送</button></div><pre v-if="agentOutput">{{ agentOutput }}</pre></div></section>
      </main>
      <main v-else class="empty-state">请先创建或选择一个项目组。</main>
    </div>
  </div>
</template>

<style scoped>
.project-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:18px}.project-sidebar,.project-main{background:var(--surface-card,#fff);border:1px solid var(--border-color,#e5e7eb);border-radius:12px;padding:18px}.project-sidebar{display:flex;flex-direction:column;gap:8px}.inline-form,.document-toolbar,.editor-actions{display:flex;gap:8px;align-items:center}.inline-form input,.document-toolbar input{min-width:0;flex:1}.project-item,.document-item{display:flex;justify-content:space-between;text-align:left;border:0;border-radius:8px;background:transparent;padding:10px;cursor:pointer}.project-item.active,.document-item.active{background:#eef5ff;color:#155eef}.document-list{display:grid;gap:4px;margin:14px 0}.document-item small{color:#64748b}.document-editor{display:grid;gap:10px}.title-input,.document-editor textarea{width:100%;box-sizing:border-box;border:1px solid #d7dce5;border-radius:8px;padding:10px}.document-editor textarea{resize:vertical;font:13px/1.7 ui-monospace,monospace}.agent-box{display:grid;gap:10px;border-top:1px solid #edf0f5;padding-top:16px}.agent-box pre{max-height:220px;overflow:auto;white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:8px}.muted{color:#64748b}.empty-state{padding:50px;text-align:center}@media(max-width:800px){.project-layout{grid-template-columns:1fr}}
</style>
