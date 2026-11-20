<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import { getFeishuAuthorizeUrl } from '../api/auth.api'
import { getDriveFiles, getDriveRoot, getFeishuAccess, getFeishuEditableContent, getFeishuJob, previewFeishuSource, resolveFeishuUrl, retryFeishuJob, searchDrive, startFeishuExport } from '../api/wiki-feishu.api'
import type { DriveFile, FeishuSource, TransferJob } from '../api/wiki-feishu.api'
import type { WikiDocument, WikiKnowledgeCategory } from '../types/skill'

const props = defineProps<{ mode: 'IMPORT_CREATE' | 'IMPORT_UPDATE' | 'EXPORT'; document?: WikiDocument | null; sourceAudience?: 'CURRENT' | 'PLATFORM_APPROVED'; teamId?: number | null; parentId?: number | null; knowledgeCategory?: WikiKnowledgeCategory | null; skillIds?: number[]; initialJobId?: number }>()
const emit = defineEmits<{ close: []; completed: [wikiId?: number]; staged: [payload: { title: string; markdownContent: string; contentMode: 'REPLACE' | 'APPEND' }] }>()
const access = ref<Awaited<ReturnType<typeof getFeishuAccess>> | null>(null)
const folderStack = ref<Array<{ token: string; name: string }>>([])
const files = ref<DriveFile[]>([])
const nextPage = ref('')
const selectedSource = ref<FeishuSource | null>(null)
const selectedTitle = ref('')
const preview = ref('')
const url = ref('')
const searchKeyword = ref('')
const searchResults = ref<DriveFile[]>([])
const format = ref<'DOCX' | 'MARKDOWN_FILE'>('DOCX')
const contentMode = ref<'REPLACE' | 'APPEND'>('REPLACE')
const task = ref<TransferJob | null>(null)
const loading = ref(false)
const error = ref('')
let pollTimer: ReturnType<typeof setTimeout> | undefined
const currentFolder = () => folderStack.value.at(-1)?.token
function message(e: unknown) { return axios.isAxiosError(e) ? String(e.response?.data?.message ?? '飞书请求失败') : '操作失败，请重试' }
async function loadFiles(pageToken?: string) {
  loading.value = true; error.value = ''
  try {
    const page = await getDriveFiles(currentFolder(), pageToken)
    files.value = pageToken ? [...files.value, ...page.items] : page.items
    nextPage.value = page.hasMore ? page.pageToken : ''
  } catch (e) { error.value = message(e) }
  finally { loading.value = false }
}
async function enterFolder(file: DriveFile) { folderStack.value.push({ token: file.token, name: file.name }); await loadFiles() }
async function goFolder(index: number) { folderStack.value = folderStack.value.slice(0, index + 1); await loadFiles() }
async function choose(file: DriveFile) {
  if (!['docx', 'doc', 'file'].includes(file.type)) return
  if (file.type === 'file' && !file.name.toLowerCase().endsWith('.md')) { error.value = '仅支持 Markdown 文件'; return }
  selectedSource.value = { fileType: file.type.toUpperCase(), fileToken: file.token }
  selectedTitle.value = file.name; preview.value = ''; error.value = ''
  try { const result = await previewFeishuSource(selectedSource.value); preview.value = result.excerpt; selectedTitle.value = result.title }
  catch (e) { error.value = message(e); selectedSource.value = null }
}
async function resolveUrl() {
  loading.value = true; error.value = ''
  try {
    const found = await resolveFeishuUrl(url.value)
    selectedSource.value = { fileType: found.type, fileToken: found.token }; selectedTitle.value = found.title
    preview.value = (await previewFeishuSource(selectedSource.value)).excerpt
  } catch (e) { error.value = message(e); selectedSource.value = null }
  finally { loading.value = false }
}
async function search() {
  if (!searchKeyword.value.trim()) return
  loading.value = true; error.value = ''
  try {
    const result = await searchDrive(searchKeyword.value.trim()) as { files?: Array<Record<string, string>> }
    searchResults.value = (result.files ?? []).filter(item => ['DOCX', 'DOC', 'WIKI'].includes(item.docType ?? '')).map(item => ({ token: item.docId ?? '', type: (item.docType ?? '').toLowerCase(), name: item.title ?? item.name ?? '飞书文档', modifiedAt: '' }))
  } catch (e) { error.value = message(e) }
  finally { loading.value = false }
}
async function authorize() {
  try { window.location.assign(await getFeishuAuthorizeUrl(window.location.pathname + window.location.search)) }
  catch (e) { error.value = message(e) }
}
async function submit() {
  if (task.value) return
  loading.value = true; error.value = ''
  try {
    if (props.mode !== 'EXPORT') {
      const editable = await getFeishuEditableContent(selectedSource.value!)
      emit('staged', { title: editable.title, markdownContent: editable.markdownContent, contentMode: contentMode.value })
      return
    }
    const accepted = await startFeishuExport(props.document!.id, { format: format.value, folderToken: currentFolder(), sourceRevisionNo: props.document!.revisionNo, sourceAudience: props.sourceAudience ?? 'CURRENT' })
    await poll(accepted.jobId)
  } catch (e) { error.value = message(e) }
  finally { loading.value = false }
}
async function poll(id: number) {
  try {
    task.value = await getFeishuJob(id)
    if (task.value.status === 'SUCCEEDED') emit('completed', task.value.wikiDocumentId)
    else if (['PENDING', 'RUNNING'].includes(task.value.status)) pollTimer = setTimeout(() => void poll(id), 2500)
  } catch (e) { error.value = message(e) }
}
async function retry() { if (!task.value) return; try { await retryFeishuJob(task.value.id); await poll(task.value.id) } catch (e) { error.value = message(e) } }
onMounted(async () => {
  if (props.initialJobId) void poll(props.initialJobId)
  try {
    access.value = await getFeishuAccess()
    if (access.value.authorized && access.value.canBrowse) {
      folderStack.value = [{ token: await getDriveRoot(), name: '我的云盘' }]
      await loadFiles()
    }
  } catch (e) { error.value = message(e) }
})
onBeforeUnmount(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>

<template>
  <div class="drive-mask" @click.self="emit('close')"><section class="drive-dialog" role="dialog" aria-modal="true" aria-label="飞书云盘传输"><header><h2>{{ mode === 'EXPORT' ? '导出到飞书云盘' : '从飞书云盘导入' }}</h2><t-button variant="text" @click="emit('close')">关闭</t-button></header>
    <p class="hint">{{ mode === 'EXPORT' ? '文件会保存到你选定的飞书目录，不会自动分享。' : '先将飞书正文载入编辑器；检查内容、选择知识分类后再保存 Wiki。' }}</p>
    <div v-if="!access?.authorized" class="notice">请先授权飞书文档访问。<t-button size="small" @click="authorize">重新授权</t-button></div>
    <div v-else>
      <div v-if="!access.canBrowse" class="notice">当前授权缺少云盘目录浏览权限。可粘贴文档链接导入，或重新授权以浏览目录。<t-button size="small" @click="authorize">重新授权</t-button></div>
      <div v-if="access.canBrowse" class="browser"><nav><button v-for="(part, i) in folderStack" :key="part.token" @click="goFolder(i)">{{ part.name }} / </button></nav><div class="file-list"><button v-for="file in files" :key="file.token" @click="file.type === 'folder' ? enterFolder(file) : mode !== 'EXPORT' && choose(file)"><span>{{ file.type === 'folder' ? '📁' : '📄' }}</span> {{ file.name }}</button><p v-if="!files.length">此目录暂无可选文件</p></div><t-button v-if="nextPage" variant="text" :loading="loading" @click="loadFiles(nextPage)">加载更多</t-button></div>
      <template v-if="mode !== 'EXPORT'"><div class="url-row"><t-input v-model="searchKeyword" placeholder="搜索飞书文档" @enter="search" /><t-button variant="outline" :loading="loading" @click="search">搜索</t-button></div><div v-if="searchResults.length" class="file-list search-results"><button v-for="file in searchResults" :key="file.token" @click="choose(file)">📄 {{ file.name }}</button></div><div class="url-row"><t-input v-model="url" placeholder="粘贴飞书 DOCX、Wiki 或旧版 DOC 链接" /><t-button variant="outline" :loading="loading" @click="resolveUrl">解析链接</t-button></div><p v-if="selectedSource">已选择：{{ selectedTitle }}（{{ selectedSource.fileType }}）</p><pre v-if="preview" class="preview">{{ preview }}</pre><label v-if="mode === 'IMPORT_UPDATE'" class="choice">正文处理 <t-select v-model="contentMode" :options="[{ label: '替换正文', value: 'REPLACE' }, { label: '追加正文', value: 'APPEND' }]" /></label></template>
      <template v-else><label class="choice">导出格式 <t-select v-model="format" :options="[{ label: '飞书 DOCX', value: 'DOCX' }, { label: '原始 Markdown 文件', value: 'MARKDOWN_FILE' }]" /></label><p v-if="format === 'DOCX'" class="hint">标题、列表、待办、引用、代码、分割线、表格和常见行内样式会转换为飞书组件。图片及嵌入内容请选 Markdown 文件保存原文。</p></template>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p><div v-if="task" class="notice">任务 #{{ task.id }}：{{ task.status }}<span v-if="task.errorMessage"> · {{ task.errorMessage }}</span><a v-if="task.feishuOutputUrl" :href="task.feishuOutputUrl" target="_blank" rel="noopener noreferrer">打开飞书文件</a><t-button v-if="['FAILED', 'AUTH_REQUIRED'].includes(task.status)" size="small" @click="retry">重试</t-button></div>
    <footer><t-button variant="outline" @click="emit('close')">关闭</t-button><t-button v-if="!task" theme="primary" :loading="loading" :disabled="!access?.authorized || mode !== 'EXPORT' && !selectedSource" @click="submit">{{ mode === 'EXPORT' ? '开始导出' : '导入到编辑器' }}</t-button></footer>
  </section></div>
</template>

<style scoped>
.drive-mask{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:var(--mask-bg)}.drive-dialog{box-sizing:border-box;width:min(100%,640px);max-height:90vh;overflow:auto;padding:24px;border-radius:12px;background:var(--surface-overlay-solid);color:var(--text-1);box-shadow:var(--shadow-xl)}header,footer,.url-row{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{margin:0}.hint{color:var(--text-2);font-size:13px}.notice{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px;margin:12px 0;border-radius:8px;background:var(--surface-2);font-size:13px}.notice a{color:var(--accent-400)}.error{color:var(--error)}.browser{margin:14px 0;border:1px solid var(--border-1);border-radius:8px}nav{display:flex;flex-wrap:wrap;padding:10px;border-bottom:1px solid var(--border-1)}nav button,.file-list button{border:0;background:transparent;color:var(--text-1);cursor:pointer;text-align:left}.file-list{max-height:180px;overflow:auto}.file-list button{display:block;width:100%;padding:9px 12px}.file-list button:hover{background:var(--surface-2)}.file-list p{padding:8px 12px}.url-row{margin:15px 0}.url-row :deep(.t-input){flex:1}.preview{max-height:160px;overflow:auto;padding:12px;border-radius:8px;background:var(--surface-2);white-space:pre-wrap}.choice{display:flex;align-items:center;gap:12px;margin:15px 0}.choice :deep(.t-select){width:240px}footer{justify-content:flex-end;margin-top:20px}
.search-results{border:1px solid var(--border-1);border-radius:8px}
</style>
