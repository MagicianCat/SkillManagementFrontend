<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { hasPermission } from '../types/permissions'
import axios from 'axios'
import {
  cancelDraft,
  getActiveDraft,
  getSkillCategories,
  getSkill,
  getSkillVersions,
  openDraft,
  updateSkillMeta,
  uploadDraftZip,
} from '../api/skills.api'
import { getFileContent, getFiles, saveFileContent } from '../api/files.api'
import {
  getOfflineImpact,
  submitReview,
  takeVersionOffline,
  validateVersion,
} from '../api/versions.api'
import {
  developmentStageLabel,
  type SkillCategory,
  type FileView,
  type SkillView,
  type VersionView,
} from '../types/skill'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const skillKey = computed(() => String(route.params.skillKey))

const skill = ref<SkillView | null>(null)
const draft = ref<VersionView | null>(null)
const versions = ref<VersionView[]>([])
const files = ref<FileView[]>([])
const loading = ref(true)
const pageError = ref('')

// 编辑器状态
const selectedPath = ref('')
const serverContent = ref('')
const draftContent = ref('')
const contentLoading = ref(false)
const contentError = ref('')
const saving = ref(false)
const dirty = computed(() => draftContent.value !== serverContent.value)

// 元数据表单
const metaForm = ref({
  displayName: '',
  description: '',
  sourceUrl: '',
  categoryId: null as number | null,
})
const categories = ref<SkillCategory[]>([])
const categoryOptions = computed(() => categories.value.filter((item) => item.parentId === null).map((root) => ({
  // 父级仅用于展开，不能 disabled，否则 TDesign 会连同叶子一起禁用。
  label: root.name, value: root.id,
  children: categories.value.filter((item) => item.parentId === root.id).map((leaf) => ({ label: leaf.name, value: leaf.id, disabled: !leaf.selectable })),
})))
const metaSaving = ref(false)
const metaMessage = ref('')

// 提审对话框
const showSubmitDialog = ref(false)
const submitComment = ref('')
const submitWarnings = ref<string[]>([])
const submitting = ref(false)
const actionError = ref('')

// 取消草稿
const showCancelDialog = ref(false)
const cancelling = ref(false)

// 重传 ZIP
const zipInput = ref<HTMLInputElement | null>(null)
const reuploading = ref(false)
const offlining = ref(false)

const canOffline = computed(() =>
  hasPermission(authStore.user?.permissions, 'skill:offline'),
)
const publishedVersion = computed(() =>
  versions.value.find((item) =>
    ['PUBLISHED', 'DEPRECATED'].includes(item.lifecycleStatus),
  ),
)

const isDraft = computed(() => draft.value?.lifecycleStatus === 'DRAFT')
const readOnly = computed(() => !isDraft.value)
// 文件内容受草稿生命周期控制；Skill 元数据由 skill:edit 权限独立控制。
const metadataReadOnly = computed(
  () => !hasPermission(authStore.user?.permissions, 'skill:edit'),
)

const currentFile = computed(
  () => files.value.find((f) => f.path === selectedPath.value) ?? null,
)

async function loadSkillAndDraft() {
  loading.value = true
  pageError.value = ''
  try {
    skill.value = await getSkill(skillKey.value)
    versions.value = await getSkillVersions(skillKey.value)
    metaForm.value = {
      displayName: skill.value.displayName,
      description: skill.value.description,
      sourceUrl: skill.value.sourceUrl ?? '',
      categoryId: skill.value.categoryId,
    }
  } catch {
    pageError.value = 'Skill 加载失败'
    loading.value = false
    return
  }
  try {
    draft.value = await getActiveDraft(skillKey.value)
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      draft.value = null
      loading.value = false
      return
    }
    pageError.value = '草稿加载失败'
    loading.value = false
    return
  }
  try {
    await loadFiles()
  } catch (error: unknown) {
    // 草稿文件索引缺失/查询失败（例如仅打开过草稿但从未上传内容的版本）
    pageError.value = axios.isAxiosError(error)
      ? String(
          error.response?.data?.message ??
            '草稿内容加载失败（该草稿可能尚无文件，请重新上传 ZIP）',
        )
      : '草稿内容加载失败'
    loading.value = false
    return
  }
  loading.value = false
}

async function takeOffline() {
  const version = publishedVersion.value
  if (!version || !canOffline.value) return
  const reason = window.prompt('请输入下架原因')?.trim()
  if (!reason) return
  offlining.value = true
  actionError.value = ''
  try {
    const impact = await getOfflineImpact(version.id)
    let force = false
    if (impact.blocked) {
      force = window.confirm(
        `该版本有 ${impact.publishedDependents} 个已发布依赖方，确认仍要强制下架吗？`,
      )
      if (!force) return
    } else if (!window.confirm('确认下架当前已发布版本吗？下架后普通用户将无法下载。')) {
      return
    }
    await takeVersionOffline(version.id, { force, reason })
    versions.value = await getSkillVersions(skillKey.value)
    metaMessage.value = '已下架'
  } catch (error: unknown) {
    actionError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '下架失败')
      : '下架失败'
  } finally {
    offlining.value = false
  }
}

async function loadFiles() {
  if (!draft.value) return
  files.value = await getFiles(draft.value.id)
  const main = files.value.find((f) => f.path === 'SKILL.md')
  const first = main ?? files.value.find((f) => f.editable)
  if (first) await selectFile(first.path, true)
}

async function selectFile(path: string, force = false) {
  if (!force && dirty.value) {
    const action = window.confirm(
      '当前文件有未保存的修改。点击"确定"放弃修改并切换，点击"取消"留在当前文件。',
    )
    if (!action) return
  }
  selectedPath.value = path
  contentLoading.value = true
  contentError.value = ''
  serverContent.value = ''
  draftContent.value = ''
  try {
    const content = await getFileContent(draft.value!.id, path)
    serverContent.value = content
    draftContent.value = content
  } catch (error: unknown) {
    // 后端已知问题（前端设计文档 17.1）：重启后工作区可能暂不可用
    contentError.value = axios.isAxiosError(error)
      ? String(
          error.response?.data?.message ??
            '源码工作区暂不可用，请稍后重试',
        )
      : '源码工作区暂不可用，请稍后重试'
  } finally {
    contentLoading.value = false
  }
}

async function save() {
  if (!draft.value || !currentFile.value || !dirty.value) return
  saving.value = true
  contentError.value = ''
  try {
    const updatedFiles = await saveFileContent(draft.value.id, {
      path: selectedPath.value,
      content: draftContent.value,
      versionNo: draft.value.versionNo,
    })
    files.value = updatedFiles
    serverContent.value = draftContent.value
    // 保存会推进 versionNo/sourceRevision，需刷新草稿
    draft.value = await getActiveDraft(skillKey.value)
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      contentError.value =
        '内容已被其他人修改，请复制当前内容后刷新页面再试'
      draft.value = await getActiveDraft(skillKey.value)
    } else {
      contentError.value = axios.isAxiosError(error)
        ? String(error.response?.data?.message ?? '保存失败')
        : '保存失败'
    }
  } finally {
    saving.value = false
  }
}

async function saveMeta() {
  if (!skill.value) return
  metaSaving.value = true
  metaMessage.value = ''
  try {
    skill.value = await updateSkillMeta(skillKey.value, {
      displayName: metaForm.value.displayName.trim(),
      description: metaForm.value.description.trim(),
      categoryId: metaForm.value.categoryId!,
      versionNo: skill.value.versionNo,
      sourceUrl: metaForm.value.sourceUrl.trim() || null,
    })
    metaMessage.value = '已保存'
  } catch (error: unknown) {
    metaMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '保存失败')
      : '保存失败'
  } finally {
    metaSaving.value = false
  }
}

async function startSubmit() {
  if (!draft.value) return
  actionError.value = ''
  if (dirty.value) {
    actionError.value = '请先保存当前文件再提交审核'
    return
  }
  submitting.value = true
  try {
    submitWarnings.value = await validateVersion(draft.value.id)
    submitComment.value = ''
    showSubmitDialog.value = true
  } catch (error: unknown) {
    actionError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '校验失败')
      : '校验失败'
  } finally {
    submitting.value = false
  }
}

async function confirmSubmit() {
  if (!draft.value || !submitComment.value.trim()) return
  submitting.value = true
  actionError.value = ''
  try {
    await submitReview(draft.value.id, {
      versionNo: draft.value.versionNo,
      comment: submitComment.value.trim(),
    })
    showSubmitDialog.value = false
    await router.push({ name: 'skill-detail', params: { skillKey: skillKey.value } })
  } catch (error: unknown) {
    actionError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '提交失败')
      : '提交失败'
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      draft.value = await getActiveDraft(skillKey.value)
    }
  } finally {
    submitting.value = false
  }
}

async function confirmCancel() {
  if (!draft.value) return
  cancelling.value = true
  actionError.value = ''
  try {
    await cancelDraft(skillKey.value, draft.value.versionNo)
    showCancelDialog.value = false
    await router.push({ name: 'skill-detail', params: { skillKey: skillKey.value } })
  } catch (error: unknown) {
    actionError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '取消失败')
      : '取消失败'
  } finally {
    cancelling.value = false
  }
}

async function openNewDraft() {
  try {
    draft.value = await openDraft(skillKey.value)
    await loadFiles()
  } catch (error: unknown) {
    pageError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '打开草稿失败')
      : '打开草稿失败'
  }
}
function triggerReupload() {
  zipInput.value?.click()
}

async function onReuploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) {
    actionError.value = '仅支持 .zip 文件'
    return
  }
  if (dirty.value) {
    const ok = window.confirm('重新上传会覆盖当前所有未保存修改，是否继续？')
    if (!ok) return
  }
  reuploading.value = true
  actionError.value = ''
  try {
    await uploadDraftZip(skillKey.value, file)
    draft.value = await getActiveDraft(skillKey.value)
    serverContent.value = ''
    draftContent.value = ''
    selectedPath.value = ''
    await loadFiles()
  } catch (error: unknown) {
    actionError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '上传失败')
      : '上传失败'
  } finally {
    reuploading.value = false
  }
}

onBeforeRouteLeave(() => {
  if (dirty.value) {
    return window.confirm('当前文件有未保存的修改，确定离开吗？')
  }
})

onMounted(async () => { categories.value = await getSkillCategories(); await loadSkillAndDraft() })
onBeforeUnmount(() => {
  serverContent.value = ''
  draftContent.value = ''
})
</script>

<template>
  <div class="draft-page">
    <div v-if="loading" class="result-state">正在加载草稿…</div>
    <div v-else-if="pageError" class="result-state result-state--error">
      {{ pageError }}
    </div>

    <!-- 无活动草稿空态 -->
    <div v-else-if="!draft" class="result-state">
      <p>当前没有活动草稿</p>
      <button
        v-if="canOffline && publishedVersion"
        class="btn-danger"
        style="margin: 14px 8px 0"
        :disabled="offlining"
        @click="takeOffline"
      >
        {{ offlining ? '下架中…' : '下架已发布版本' }}
      </button>
      <button class="btn-primary" style="margin-top: 14px" @click="openNewDraft">
        打开草稿开始编辑
      </button>
      <section v-if="!metadataReadOnly && skill" class="metadata-only-editor">
        <p class="panel-label">Skill 元数据</p>
        <label class="meta-field">
          <span>展示名称</span>
          <input v-model="metaForm.displayName" />
        </label>
        <label class="meta-field">
          <span>研发全流程分类</span>
          <t-cascader
            v-model="metaForm.categoryId"
            :options="categoryOptions"
            filterable
            :clearable="false"
            placeholder="选择研发全流程分类"
          />
        </label>
        <label class="meta-field">
          <span>描述</span>
          <textarea v-model="metaForm.description" rows="4"></textarea>
        </label>
        <label class="meta-field">
          <span>来源网址</span>
          <input
            v-model="metaForm.sourceUrl"
            type="url"
            placeholder="例如 https://github.com/example/repository"
          />
        </label>
        <div class="meta-actions">
          <button class="btn-secondary" :disabled="metaSaving" @click="saveMeta">
            {{ metaSaving ? '保存中…' : '保存元数据' }}
          </button>
          <span v-if="metaMessage" class="meta-message">{{ metaMessage }}</span>
        </div>
      </section>
    </div>

    <template v-else>
      <header class="draft-header">
        <button
          class="back-link"
          @click="router.push({ name: 'skill-detail', params: { skillKey } })"
        >
          ← 返回详情
        </button>
        <div class="draft-header__title">
          <h1>{{ skill?.displayName || skillKey }}</h1>
          <span class="status-badge status-draft">{{
            developmentStageLabel(skill?.developmentStage)
          }}</span>
          <span v-if="readOnly" class="readonly-note">审核中 · 只读</span>
        </div>
        <div class="draft-header__actions">
          <button
            v-if="canOffline && publishedVersion"
            class="btn-danger"
            :disabled="offlining"
            @click="takeOffline"
          >
            {{ offlining ? '下架中…' : '下架已发布版本' }}
          </button>
          <button
            v-if="isDraft"
            class="btn-secondary"
            :disabled="reuploading"
            @click="triggerReupload"
          >
            {{ reuploading ? '上传中…' : '重新上传 ZIP' }}
          </button>
          <button
            v-if="isDraft"
            class="btn-secondary"
            :disabled="saving || !dirty"
            @click="save"
          >
            {{ saving ? '保存中…' : '保存草稿' }}
          </button>
          <button
            v-if="isDraft"
            class="btn-primary"
            :disabled="submitting"
            @click="startSubmit"
          >
            提交审核
          </button>
          <button
            v-if="isDraft"
            class="btn-danger"
            @click="showCancelDialog = true"
          >
            取消草稿
          </button>
        </div>
      </header>
      <p v-if="actionError" class="inline-error" role="alert">
        {{ actionError }}
      </p>

      <main class="draft-layout">
        <!-- 文件树 -->
        <aside class="file-tree">
          <p class="panel-label">文件</p>
          <div v-if="!files.length" class="file-tree__empty">
            该草稿暂无文件（打开草稿时未继承已发布内容）<br />
            请点击右上角「重新上传 ZIP」导入内容
          </div>
          <button
            v-for="file in files"
            :key="file.path"
            class="file-row"
            :class="{ 'is-selected': selectedPath === file.path }"
            @click="selectFile(file.path)"
          >
            <span class="file-row__path">{{ file.path }}</span>
            <span v-if="file.source === 'GENERATED'" class="file-tag"
              >平台生成</span
            >
          </button>
        </aside>

        <!-- 编辑区 -->
        <section class="editor-pane">
          <div class="editor-pane__bar">
            <span>{{ selectedPath || '未选择文件' }}</span>
            <span v-if="dirty" class="dirty-dot" title="有未保存修改">●</span>
          </div>
          <div v-if="contentLoading" class="result-state">加载文件内容…</div>
          <div
            v-else-if="contentError"
            class="result-state result-state--error"
          >
            {{ contentError }}
            <div>
              <button
                class="btn-secondary"
                style="margin-top: 10px"
                @click="selectFile(selectedPath, true)"
              >
                重试
              </button>
            </div>
          </div>
          <textarea
            v-else-if="currentFile"
            v-model="draftContent"
            class="editor-textarea"
            :readonly="readOnly || !currentFile.editable"
            spellcheck="false"
          ></textarea>
          <div v-else class="result-state">请选择左侧文件</div>
        </section>

        <!-- 元数据 -->
        <aside class="meta-pane">
          <p class="panel-label">元数据</p>
          <label class="meta-field">
            <span>展示名称</span>
            <input v-model="metaForm.displayName" :disabled="metadataReadOnly" />
          </label>
          <label class="meta-field">
            <span>研发全流程分类</span>
            <t-cascader v-model="metaForm.categoryId" :options="categoryOptions" filterable :clearable="false" :disabled="metadataReadOnly" />
          </label>
          <label class="meta-field">
            <span>描述</span>
            <textarea
              v-model="metaForm.description"
              rows="5"
              :disabled="metadataReadOnly"
            ></textarea>
          </label>
          <label class="meta-field">
            <span>来源网址</span>
            <input
              v-model="metaForm.sourceUrl"
              type="url"
              placeholder="例如 https://github.com/example/repository"
              :disabled="metadataReadOnly"
            />
          </label>
          <label class="meta-field">
            <span>候选版本</span>
            <input
              :value="draft.candidateVersion ? `v${draft.candidateVersion}` : '尚未分配'"
              readonly
            />
          </label>
          <div v-if="!metadataReadOnly" class="meta-actions">
            <button
              class="btn-secondary"
              :disabled="metaSaving"
              @click="saveMeta"
            >
              {{ metaSaving ? '保存中…' : '保存元数据' }}
            </button>
            <span v-if="metaMessage" class="meta-message">{{
              metaMessage
            }}</span>
          </div>
        </aside>
      </main>
    </template>

    <!-- 提交审核对话框 -->
    <div v-if="showSubmitDialog" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="submit-title">
        <h2 id="submit-title">提交审核</h2>
        <div v-if="submitWarnings.length" class="warnings">
          <p>校验发现以下告警：</p>
          <ul>
            <li v-for="warning in submitWarnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </div>
        <label class="modal-field">
          审核说明 <em style="color: var(--error)">*</em>
          <textarea
            v-model="submitComment"
            rows="3"
            placeholder="请描述本次变更内容"
          ></textarea>
        </label>
        <p v-if="actionError" class="inline-error">{{ actionError }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showSubmitDialog = false">
            取消
          </button>
          <button
            class="btn-primary"
            :disabled="submitting || !submitComment.trim()"
            @click="confirmSubmit"
          >
            {{ submitting ? '提交中…' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 取消草稿对话框 -->
    <div v-if="showCancelDialog" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="cancel-title">
        <h2 id="cancel-title">取消草稿</h2>
        <p class="modal-desc">
          取消后草稿内容将<strong>不可恢复</strong>，候选版本号会被释放。确定继续吗？
        </p>
        <p v-if="actionError" class="inline-error">{{ actionError }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showCancelDialog = false">
            保留草稿
          </button>
          <button
            class="btn-danger"
            :disabled="cancelling"
            @click="confirmCancel"
          >
            {{ cancelling ? '取消中…' : '确认取消草稿' }}
          </button>
        </div>
      </div>
    </div>

    <input
      ref="zipInput"
      type="file"
      accept=".zip"
      style="display: none"
      @change="onReuploadChange"
    />
  </div>
</template>

<style scoped>
.draft-page {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 14px;
}
.draft-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.draft-header__title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
}
.draft-header__title h1 {
  margin: 0;
  color: var(--text-1);
  font-size: 20px;
}
.readonly-note {
  color: var(--warning);
  font-size: 12px;
}
.draft-header__actions {
  display: flex;
  gap: 8px;
}
.draft-layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 220px minmax(0, 1fr) 300px;
  gap: 14px;
}
.file-tree,
.editor-pane,
.meta-pane {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border: 1px solid var(--border-1);
  border-radius: 10px;
  background: var(--surface-1);
  backdrop-filter: blur(12px);
  box-shadow: var(--inner-highlight);
}
.panel-label {
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-1);
  color: var(--text-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.file-tree {
  overflow-y: auto;
}
.file-tree__empty {
  padding: 18px 12px;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.7;
}
.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 12px;
  border: 0;
  color: var(--text-2);
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.file-row:hover,
.file-row.is-selected {
  color: var(--accent-300);
  background: var(--accent-soft);
}
.file-row__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-tag {
  flex: 0 0 auto;
  padding: 2px 5px;
  border-radius: 4px;
  color: var(--text-2);
  background: var(--surface-2);
  font-size: 9px;
}
.editor-pane__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-1);
  color: var(--text-2);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}
.dirty-dot {
  color: var(--warning);
}
.editor-textarea {
  flex: 1;
  min-height: 320px;
  padding: 16px;
  border: 0;
  color: var(--text-1);
  background: transparent;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  line-height: 1.65;
  outline: none;
  resize: none;
}
.meta-pane {
  padding-bottom: 12px;
  overflow-y: auto;
}
.meta-field {
  display: grid;
  gap: 6px;
  padding: 10px 12px 0;
}
.meta-field span {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 650;
}
.meta-field input,
.meta-field select,
.meta-field textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-2);
  border-radius: 6px;
  color: var(--text-1);
  background: var(--surface-2);
  font: inherit;
  font-size: 12px;
  outline: none;
}
.meta-field input[readonly] {
  color: var(--text-3);
  background: var(--surface-1);
}
.meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
}
.meta-message {
  color: var(--success);
  font-size: 11px;
}
.btn-primary,
.btn-secondary,
.btn-danger {
  height: 34px;
  padding: 0 13px;
  border-radius: 7px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.btn-primary {
  border: 0;
  color: var(--text-on-accent);
  background: var(--accent-500);
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid var(--border-2);
  color: var(--text-2);
  background: var(--surface-1);
}
.btn-secondary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-danger {
  border: 1px solid rgb(248 113 113 / 25%);
  color: var(--error);
  background: var(--surface-1);
}
.btn-danger:hover {
  background: var(--error-soft);
}
.inline-error {
  margin: 0;
  color: var(--error);
  font-size: 12px;
}
.warnings {
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid rgb(251 191 36 / 25%);
  border-radius: 7px;
  color: var(--warning);
  background: var(--warning-soft);
  font-size: 12px;
}
.warnings ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.modal-mask {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--mask-bg);
}
.modal {
  width: min(92vw, 460px);
  padding: 24px;
  border: 1px solid var(--border-1);
  border-radius: 12px;
  background: var(--surface-overlay);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-lg);
}
.modal h2 {
  margin: 0;
  color: var(--text-1);
  font-size: 17px;
}
.modal-desc {
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}
.modal-field {
  display: grid;
  gap: 7px;
  margin-top: 12px;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 650;
}
.modal-field textarea {
  padding: 8px 10px;
  border: 1px solid var(--border-2);
  border-radius: 7px;
  color: var(--text-1);
  background: var(--surface-2);
  font: inherit;
  font-size: 13px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
</style>
