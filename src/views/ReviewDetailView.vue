<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { approveReview, getReview, rejectReview } from '../api/reviews.api'
import { getDiff, getFileContent, getFiles } from '../api/files.api'
import {
  reviewStatusLabel,
  type ReviewStatus,
  type ReviewView,
} from '../types/review'
import type { FileDiffView, FileView } from '../types/skill'

const route = useRoute()
const router = useRouter()
const reviewId = computed(() => Number(route.params.reviewId))

const review = ref<ReviewView | null>(null)
const loading = ref(true)
const pageError = ref('')

// 文件浏览
const files = ref<FileView[]>([])
const filesError = ref('')
const selectedPath = ref('')
const fileContent = ref('')
const contentLoading = ref(false)
const contentError = ref('')

// 变更对比
const activeTab = ref<'diff' | 'comment'>('diff')
const diffs = ref<FileDiffView[]>([])
const diffLoading = ref(false)
const diffError = ref('')
const expandedPaths = ref<Set<string>>(new Set())

// 审核操作
const commentInput = ref('')
const acting = ref(false)
const actionError = ref('')

const isPending = computed(() => review.value?.status === 'PENDING')
const selectedFile = computed(
  () => files.value.find((f) => f.path === selectedPath.value) ?? null,
)

async function loadReview() {
  loading.value = true
  pageError.value = ''
  try {
    review.value = await getReview(reviewId.value)
  } catch (error: unknown) {
    pageError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '审核任务加载失败')
      : '审核任务加载失败'
    loading.value = false
    return
  }
  await Promise.all([loadFiles(), loadDiffs()])
  loading.value = false
}

async function loadFiles() {
  if (!review.value) return
  filesError.value = ''
  try {
    files.value = await getFiles(review.value.versionId)
  } catch (error: unknown) {
    filesError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '文件列表加载失败')
      : '文件列表加载失败'
  }
}

async function selectFile(path: string) {
  if (!review.value) return
  selectedPath.value = path
  contentLoading.value = true
  contentError.value = ''
  fileContent.value = ''
  try {
    fileContent.value = await getFileContent(review.value.versionId, path)
  } catch (error: unknown) {
    // 后端已知问题（前端设计文档 17.1）：重启后工作区可能暂不可用
    contentError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '源码工作区暂不可用，请稍后重试')
      : '源码工作区暂不可用，请稍后重试'
  } finally {
    contentLoading.value = false
  }
}

async function loadDiffs() {
  if (!review.value) return
  diffLoading.value = true
  diffError.value = ''
  try {
    diffs.value = await getDiff(review.value.versionId)
    expandedPaths.value = new Set(diffs.value.map((d) => d.path))
  } catch (error: unknown) {
    diffError.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '变更对比加载失败')
      : '变更对比加载失败'
  } finally {
    diffLoading.value = false
  }
}

function toggleDiff(path: string) {
  const next = new Set(expandedPaths.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expandedPaths.value = next
}

async function act(kind: 'approve' | 'reject') {
  const comment = commentInput.value.trim()
  if (!review.value || !comment) return
  acting.value = true
  actionError.value = ''
  try {
    if (kind === 'approve') {
      await approveReview(review.value.reviewId, comment)
    } else {
      await rejectReview(review.value.reviewId, comment)
    }
    await router.push({ name: 'reviews' })
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      actionError.value = '该任务已被其他审核人处理，正在刷新…'
      review.value = await getReview(reviewId.value)
    } else {
      actionError.value = axios.isAxiosError(error)
        ? String(error.response?.data?.message ?? '操作失败，请稍后重试')
        : '操作失败，请稍后重试'
    }
  } finally {
    acting.value = false
  }
}

function statusBadgeClass(status: ReviewStatus): string {
  switch (status) {
    case 'PENDING':
      return 'status-reviewing'
    case 'APPROVED':
      return 'status-approved'
    case 'REJECTED':
      return 'status-offline'
    default:
      return 'status-deprecated'
  }
}

function changeTypeLabel(changeType: FileDiffView['changeType']): string {
  switch (changeType) {
    case 'ADDED':
      return '新增'
    case 'DELETED':
      return '删除'
    default:
      return '修改'
  }
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function formatTime(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return value
  }
}

onMounted(loadReview)
</script>

<template>
  <div class="detail-page">
    <button class="back-link" @click="router.push({ name: 'reviews' })">
      ← 返回审核中心
    </button>

    <div v-if="loading" class="result-state">正在加载审核任务…</div>
    <div v-else-if="pageError" class="result-state result-state--error">
      {{ pageError }}
    </div>

    <template v-else-if="review">
      <header class="detail-header">
        <div>
          <p class="eyebrow">REVIEW #{{ review.reviewId }}</p>
          <h1>
            {{ review.skillName }}
            <span v-if="review.candidateVersion" class="candidate-version"
              >v{{ review.candidateVersion }}</span
            >
          </h1>
          <p class="skill-key">{{ review.skillKey }} · 第 {{ review.reviewNo }} 轮</p>
          <p class="detail-description">
            {{ review.submitterName }} 提交于 {{ formatTime(review.submittedAt) }}
          </p>
        </div>
        <span class="status-badge" :class="statusBadgeClass(review.status)">
          {{ reviewStatusLabel(review.status) }}
        </span>
      </header>

      <div class="review-layout">
        <!-- 文件树 -->
        <aside class="file-panel">
          <p class="panel-label">文件（只读）</p>
          <div v-if="filesError" class="file-panel__error">{{ filesError }}</div>
          <div v-else-if="!files.length" class="file-panel__empty">暂无文件</div>
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

        <!-- 主区 -->
        <section class="review-main">
          <div class="tab-bar" role="tablist">
            <button
              class="tab"
              :class="{ 'is-selected': activeTab === 'diff' }"
              @click="activeTab = 'diff'"
            >
              变更对比<template v-if="diffs.length">（{{ diffs.length }}）</template>
            </button>
            <button
              class="tab"
              :class="{ 'is-selected': activeTab === 'comment' }"
              @click="activeTab = 'comment'"
            >
              提交说明
            </button>
          </div>

          <!-- 变更对比 -->
          <div v-if="activeTab === 'diff'" class="tab-content">
            <div v-if="diffLoading" class="result-state">正在加载变更…</div>
            <div v-else-if="diffError" class="result-state result-state--error">
              {{ diffError }}
              <div>
                <button
                  class="btn-secondary"
                  style="margin-top: 10px"
                  @click="loadDiffs"
                >
                  重试
                </button>
              </div>
            </div>
            <div v-else-if="!diffs.length" class="result-state">
              与基线版本相比没有变更
            </div>
            <div v-else class="diff-list">
              <div v-for="diff in diffs" :key="diff.path" class="diff-card">
                <button class="diff-card__head" @click="toggleDiff(diff.path)">
                  <span
                    class="diff-badge"
                    :class="`diff-${diff.changeType.toLowerCase()}`"
                    >{{ changeTypeLabel(diff.changeType) }}</span
                  >
                  <span class="diff-card__path">{{ diff.path }}</span>
                  <span class="diff-card__size">
                    {{ formatSize(diff.baseSizeBytes) }} →
                    {{ formatSize(diff.currentSizeBytes) }}
                  </span>
                  <span aria-hidden="true">{{
                    expandedPaths.has(diff.path) ? '▾' : '▸'
                  }}</span>
                </button>
                <div
                  v-if="expandedPaths.has(diff.path)"
                  class="diff-card__body"
                >
                  <template
                    v-if="diff.baseContent !== null || diff.currentContent !== null"
                  >
                    <div
                      v-if="diff.changeType !== 'ADDED'"
                      class="diff-pane diff-pane--before"
                    >
                      <p class="diff-pane__label">变更前</p>
                      <pre>{{ diff.baseContent }}</pre>
                    </div>
                    <div
                      v-if="diff.changeType !== 'DELETED'"
                      class="diff-pane diff-pane--after"
                    >
                      <p class="diff-pane__label">变更后</p>
                      <pre>{{ diff.currentContent }}</pre>
                    </div>
                  </template>
                  <p v-else class="diff-binary">
                    二进制文件，仅大小变化：{{ formatSize(diff.baseSizeBytes) }}
                    → {{ formatSize(diff.currentSizeBytes) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 提交说明 -->
          <div v-else class="tab-content">
            <div class="comment-panel">
              <p>{{ review.submitComment || '（提交人未填写说明）' }}</p>
            </div>
          </div>

          <!-- 选中文件内容 -->
          <div v-if="selectedFile" class="file-viewer">
            <div class="file-viewer__bar">
              <span>{{ selectedFile.path }}</span>
              <button class="btn-secondary btn-xs" @click="selectedPath = ''">
                关闭
              </button>
            </div>
            <div v-if="contentLoading" class="result-state">加载文件内容…</div>
            <div v-else-if="contentError" class="result-state result-state--error">
              {{ contentError }}
              <div>
                <button
                  class="btn-secondary"
                  style="margin-top: 10px"
                  @click="selectFile(selectedPath)"
                >
                  重试
                </button>
              </div>
            </div>
            <pre v-else class="file-viewer__content">{{ fileContent }}</pre>
          </div>

          <!-- 审核操作区 -->
          <div v-if="isPending" class="action-panel">
            <h2>审核意见</h2>
            <textarea
              v-model="commentInput"
              rows="4"
              placeholder="通过或拒绝均需填写意见（必填）…"
            ></textarea>
            <p v-if="actionError" class="inline-error">{{ actionError }}</p>
            <div class="action-panel__buttons">
              <button
                class="btn-danger"
                :disabled="acting || !commentInput.trim()"
                @click="act('reject')"
              >
                拒绝
              </button>
              <button
                class="btn-primary"
                :disabled="acting || !commentInput.trim()"
                @click="act('approve')"
              >
                {{ acting ? '提交中…' : '通过' }}
              </button>
            </div>
          </div>
          <div v-else class="action-panel action-panel--readonly">
            <h2>审核结果</h2>
            <p>
              {{ review.reviewerName ?? '—' }} 于
              {{ formatTime(review.reviewedAt) }} 处理
            </p>
            <p v-if="review.reviewComment" class="review-comment">
              {{ review.reviewComment }}
            </p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.btn-primary,
.btn-secondary,
.btn-danger {
  height: 38px;
  padding: 0 16px;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.btn-primary {
  border: 0;
  color: #fff;
  background: #4f46e5;
}
.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}
.btn-primary:disabled,
.btn-danger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid #cbd5e1;
  color: #475569;
  background: #fff;
}
.btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
}
.btn-danger {
  border: 0;
  color: #fff;
  background: #dc2626;
}
.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}
.btn-xs {
  height: 24px;
  padding: 0 9px;
  font-size: 11px;
}
.candidate-version {
  margin-left: 8px;
  color: #64748b;
  font-size: 18px;
  font-weight: 500;
}
.review-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
}
.file-panel {
  align-self: start;
  max-height: 70vh;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.panel-label {
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.file-panel__empty,
.file-panel__error {
  padding: 18px 12px;
  color: #94a3b8;
  font-size: 11px;
}
.file-panel__error {
  color: #b91c1c;
}
.file-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 12px;
  border: 0;
  color: #475569;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.file-row:hover,
.file-row.is-selected {
  color: #4f46e5;
  background: #eef2ff;
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
  color: #64748b;
  background: #f1f5f9;
  font-size: 9px;
}
.review-main {
  display: grid;
  min-width: 0;
  gap: 14px;
  align-content: start;
}
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
}
.tab {
  padding: 9px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: #64748b;
  background: transparent;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tab.is-selected {
  border-bottom-color: #4f46e5;
  color: #4f46e5;
  font-weight: 650;
}
.tab-content {
  min-height: 120px;
}
.diff-list {
  display: grid;
  gap: 10px;
}
.diff-card {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.diff-card__head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.diff-card__head:hover {
  background: #f8fafc;
}
.diff-card__path {
  flex: 1;
  overflow: hidden;
  color: #1e293b;
  font-family: var(--font-mono);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.diff-card__size {
  color: #94a3b8;
  font-size: 11px;
}
.diff-badge {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
}
.diff-added {
  color: #15803d;
  background: #dcfce7;
}
.diff-modified {
  color: #1d4ed8;
  background: #dbeafe;
}
.diff-deleted {
  color: #b91c1c;
  background: #fee2e2;
}
.diff-card__body {
  display: grid;
  gap: 0;
  border-top: 1px solid #f1f5f9;
}
.diff-pane__label {
  margin: 0;
  padding: 7px 14px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.diff-pane pre {
  max-height: 320px;
  margin: 0;
  overflow: auto;
  padding: 0 14px 14px;
  color: #334155;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.diff-pane--before pre {
  color: #991b1b;
}
.diff-pane--after pre {
  color: #14532d;
}
.diff-binary {
  margin: 0;
  padding: 14px;
  color: #64748b;
  font-size: 12px;
}
.comment-panel {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.comment-panel p {
  margin: 0;
  color: #334155;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.file-viewer {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.file-viewer__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
}
.file-viewer__content {
  max-height: 420px;
  margin: 0;
  overflow: auto;
  padding: 14px;
  color: #334155;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.action-panel {
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.action-panel h2 {
  margin: 0 0 12px;
  color: #1e293b;
  font-size: 14px;
}
.action-panel textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
  resize: vertical;
  outline: none;
}
.action-panel textarea:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgb(79 70 229 / 12%);
}
.action-panel__buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
.action-panel--readonly p {
  margin: 0 0 8px;
  color: #64748b;
  font-size: 12px;
}
.review-comment {
  padding: 10px 12px;
  border-radius: 7px;
  color: #334155 !important;
  background: #f8fafc;
  line-height: 1.7;
  white-space: pre-wrap;
}
.inline-error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: 12px;
}
@media (max-width: 720px) {
  .review-layout {
    grid-template-columns: 1fr;
  }
  .file-panel {
    max-height: 220px;
  }
}
</style>
