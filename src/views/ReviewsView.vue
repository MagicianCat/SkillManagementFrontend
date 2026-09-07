<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  approveReview,
  batchApproveReviews,
  batchRejectReviews,
  listReviews,
  rejectReview,
} from '../api/reviews.api'
import {
  reviewStatusLabel,
  type BatchReviewResult,
  type ReviewStatus,
  type ReviewView,
} from '../types/review'
import type { PageResponse } from '../types/skill'

const route = useRoute()
const router = useRouter()

const BATCH_LIMIT = 50

const keywordInput = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : '',
)
const response = ref<PageResponse<ReviewView> | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const selectedIds = ref<Set<number>>(new Set())

// 单条审核对话框
const showActionDialog = ref(false)
const actionKind = ref<'approve' | 'reject'>('approve')
const actionTarget = ref<ReviewView | null>(null)
const actionComment = ref('')
const acting = ref(false)
const actionError = ref('')

// 批量审核对话框
const showBatchDialog = ref(false)
const batchKind = ref<'approve' | 'reject'>('approve')
const batchComment = ref('')
const batching = ref(false)
const batchError = ref('')

// 批量结果弹窗
const batchResult = ref<BatchReviewResult | null>(null)
const batchResultKind = ref<'approve' | 'reject'>('approve')

const selectedStatus = computed(() =>
  typeof route.query.status === 'string' ? route.query.status : 'PENDING',
)
const page = computed(() => Number(route.query.page || 0))

const statusTabs: Array<{ value: ReviewStatus | ''; label: string }> = [
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: '', label: '全部' },
]

const pendingItems = computed(
  () => response.value?.items.filter((item) => item.status === 'PENDING') ?? [],
)
const allPendingSelected = computed(
  () =>
    pendingItems.value.length > 0 &&
    pendingItems.value.every((item) => selectedIds.value.has(item.reviewId)),
)

async function fetchReviews() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await listReviews({
      status: (selectedStatus.value as ReviewStatus) || undefined,
      keyword:
        typeof route.query.keyword === 'string' && route.query.keyword
          ? route.query.keyword
          : undefined,
      page: page.value,
      size: 12,
      sort: 'submittedAt,desc',
    })
    selectedIds.value = new Set()
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '审核任务加载失败，请稍后重试')
      : '审核任务加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function updateQuery(values: Record<string, string | undefined>) {
  const query = { ...route.query, ...values, page: '0' } as Record<
    string,
    string | undefined
  >
  Object.entries(query).forEach(([key, value]) => {
    if (!value) delete query[key]
  })
  void router.push({ query })
}

function selectStatus(value: ReviewStatus | '') {
  updateQuery({ status: value || undefined })
}

function onKeywordInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(
    () => updateQuery({ keyword: keywordInput.value.trim() || undefined }),
    300,
  )
}

function goToPage(nextPage: number) {
  if (!response.value || nextPage < 0 || nextPage >= response.value.totalPages)
    return
  void router.push({ query: { ...route.query, page: String(nextPage) } })
}

function toggleSelect(item: ReviewView) {
  if (item.status !== 'PENDING') return
  const next = new Set(selectedIds.value)
  if (next.has(item.reviewId)) {
    next.delete(item.reviewId)
  } else {
    if (next.size >= BATCH_LIMIT) return
    next.add(item.reviewId)
  }
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allPendingSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(
      pendingItems.value.slice(0, BATCH_LIMIT).map((item) => item.reviewId),
    )
  }
}

function clearSelection() {
  selectedIds.value = new Set()
}

function openActionDialog(item: ReviewView, kind: 'approve' | 'reject') {
  actionTarget.value = item
  actionKind.value = kind
  actionComment.value = ''
  actionError.value = ''
  showActionDialog.value = true
}

function openBatchDialog(kind: 'approve' | 'reject') {
  if (!selectedIds.value.size) return
  batchKind.value = kind
  batchComment.value = ''
  batchError.value = ''
  showBatchDialog.value = true
}

function errorText(error: unknown, fallback: string): string {
  return axios.isAxiosError(error)
    ? String(error.response?.data?.message ?? fallback)
    : fallback
}

async function confirmAction() {
  const target = actionTarget.value
  const comment = actionComment.value.trim()
  if (!target || !comment) return
  acting.value = true
  actionError.value = ''
  try {
    if (actionKind.value === 'approve') {
      await approveReview(target.reviewId, comment)
    } else {
      await rejectReview(target.reviewId, comment)
    }
    showActionDialog.value = false
    await fetchReviews()
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      actionError.value = '该任务已被其他审核人处理，列表即将刷新'
      await fetchReviews()
    } else {
      actionError.value = errorText(error, '操作失败，请稍后重试')
    }
  } finally {
    acting.value = false
  }
}

async function confirmBatch() {
  const comment = batchComment.value.trim()
  if (!selectedIds.value.size || !comment) return
  batching.value = true
  batchError.value = ''
  try {
    const ids = [...selectedIds.value]
    const result =
      batchKind.value === 'approve'
        ? await batchApproveReviews(ids, comment)
        : await batchRejectReviews(ids, comment)
    showBatchDialog.value = false
    batchResultKind.value = batchKind.value
    batchResult.value = result
    await fetchReviews()
  } catch (error: unknown) {
    batchError.value = errorText(error, '批量操作失败，请稍后重试')
  } finally {
    batching.value = false
  }
}

function openDetail(item: ReviewView) {
  void router.push({
    name: 'review-detail',
    params: { reviewId: item.reviewId },
  })
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

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return value
  }
}

watch(
  () => route.query,
  () => {
    keywordInput.value =
      typeof route.query.keyword === 'string' ? route.query.keyword : ''
    void fetchReviews()
  },
  { deep: true },
)
onMounted(fetchReviews)
</script>

<template>
  <div class="market-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">REVIEW</p>
        <h1>审核中心</h1>
        <p class="page-subtitle">处理 Skill 版本的审核任务</p>
      </div>
    </div>

    <section class="market-toolbar" aria-label="审核任务搜索">
      <label class="search-box"
        ><span aria-hidden="true">⌕</span
        ><input
          v-model="keywordInput"
          type="search"
          placeholder="按 Skill 名称或 Key 搜索..."
          @input="onKeywordInput"
      /></label>
      <div class="status-tabs" role="tablist" aria-label="状态筛选">
        <button
          v-for="tab in statusTabs"
          :key="tab.label"
          class="status-tab"
          :class="{ 'is-selected': selectedStatus === tab.value }"
          @click="selectStatus(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
      <span v-if="response" class="result-count"
        >共 {{ response.totalElements }} 条</span
      >
    </section>

    <div v-if="selectedIds.size" class="batch-bar" aria-live="polite">
      <span>已选 {{ selectedIds.size }}/{{ BATCH_LIMIT }} 条</span>
      <button class="btn-primary btn-sm" @click="openBatchDialog('approve')">
        批量通过
      </button>
      <button class="btn-danger btn-sm" @click="openBatchDialog('reject')">
        批量拒绝
      </button>
      <button class="btn-secondary btn-sm" @click="clearSelection">清空</button>
    </div>

    <section class="review-results" aria-live="polite">
      <div v-if="loading" class="result-state">正在加载审核任务…</div>
      <div v-else-if="errorMessage" class="result-state result-state--error">
        {{ errorMessage }}
      </div>
      <div v-else-if="!response?.items.length" class="result-state">
        没有匹配的审核任务
      </div>
      <template v-else>
        <label
          v-if="pendingItems.length"
          class="select-all-row"
        >
          <input
            type="checkbox"
            :checked="allPendingSelected"
            @change="toggleSelectAll"
          />
          全选本页待审核（{{ pendingItems.length }} 条）
        </label>
        <article
          v-for="item in response.items"
          :key="item.reviewId"
          class="review-card"
          :class="{ 'is-selectable': item.status === 'PENDING' }"
        >
          <input
            v-if="item.status === 'PENDING'"
            type="checkbox"
            class="review-card__check"
            :checked="selectedIds.has(item.reviewId)"
            :disabled="
              !selectedIds.has(item.reviewId) && selectedIds.size >= BATCH_LIMIT
            "
            @change="toggleSelect(item)"
          />
          <div class="review-card__main">
            <div class="review-card__title-row">
              <button class="review-card__title" @click="openDetail(item)">
                {{ item.skillName
                }}<small v-if="item.candidateVersion"
                  >v{{ item.candidateVersion }}</small
                >
              </button>
              <span class="status-badge" :class="statusBadgeClass(item.status)">
                {{ reviewStatusLabel(item.status) }}
              </span>
            </div>
            <p class="review-card__meta">
              {{ item.skillKey }} · 第 {{ item.reviewNo }} 轮 ·
              {{ item.submitterName }} 提交于 {{ formatTime(item.submittedAt) }}
            </p>
            <p class="review-card__comment">{{ item.submitComment }}</p>
            <p
              v-if="item.status !== 'PENDING' && item.reviewComment"
              class="review-card__review"
            >
              审核意见（{{ item.reviewerName ?? '—' }}）：{{ item.reviewComment }}
            </p>
          </div>
          <div class="review-card__actions">
            <template v-if="item.status === 'PENDING'">
              <button
                class="btn-primary btn-sm"
                @click="openActionDialog(item, 'approve')"
              >
                通过
              </button>
              <button
                class="btn-danger btn-sm"
                @click="openActionDialog(item, 'reject')"
              >
                拒绝
              </button>
            </template>
            <button class="btn-secondary btn-sm" @click="openDetail(item)">
              查看详情
            </button>
          </div>
        </article>
      </template>

      <div v-if="response && response.totalPages > 1" class="pagination">
        <button :disabled="page === 0" @click="goToPage(page - 1)">
          上一页</button
        ><span>{{ page + 1 }} / {{ response.totalPages }}</span
        ><button
          :disabled="page + 1 >= response.totalPages"
          @click="goToPage(page + 1)"
        >
          下一页
        </button>
      </div>
    </section>

    <!-- 单条审核对话框 -->
    <div v-if="showActionDialog" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="action-dialog-title">
        <h2 id="action-dialog-title">
          {{ actionKind === 'approve' ? '通过审核' : '拒绝审核' }}
        </h2>
        <p class="modal-desc">
          {{ actionTarget?.skillName }}
          <template v-if="actionTarget?.candidateVersion">
            v{{ actionTarget.candidateVersion }}
          </template>
          · 第 {{ actionTarget?.reviewNo }} 轮
        </p>
        <label class="modal-field">
          审核意见（必填）
          <textarea
            v-model="actionComment"
            rows="4"
            :placeholder="
              actionKind === 'approve'
                ? '说明通过理由…'
                : '说明需要修改的内容…'
            "
          ></textarea>
        </label>
        <p v-if="actionError" class="inline-error">{{ actionError }}</p>
        <div class="modal-actions">
          <button
            class="btn-secondary"
            :disabled="acting"
            @click="showActionDialog = false"
          >
            取消
          </button>
          <button
            :class="actionKind === 'approve' ? 'btn-primary' : 'btn-danger'"
            :disabled="acting || !actionComment.trim()"
            @click="confirmAction"
          >
            {{ acting ? '提交中…' : actionKind === 'approve' ? '确认通过' : '确认拒绝' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 批量审核对话框 -->
    <div v-if="showBatchDialog" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="batch-dialog-title">
        <h2 id="batch-dialog-title">
          {{ batchKind === 'approve' ? '批量通过' : '批量拒绝' }}
        </h2>
        <p class="modal-desc">
          将对选中的 {{ selectedIds.size }} 条待审核任务执行{{
            batchKind === 'approve' ? '通过' : '拒绝'
          }}，审核意见将应用到每一条。
        </p>
        <label class="modal-field">
          审核意见（必填，应用于本批所有记录）
          <textarea
            v-model="batchComment"
            rows="4"
            :placeholder="
              batchKind === 'approve' ? '批量审核通过' : '请补充使用说明…'
            "
          ></textarea>
        </label>
        <p v-if="batchError" class="inline-error">{{ batchError }}</p>
        <div class="modal-actions">
          <button
            class="btn-secondary"
            :disabled="batching"
            @click="showBatchDialog = false"
          >
            取消
          </button>
          <button
            :class="batchKind === 'approve' ? 'btn-primary' : 'btn-danger'"
            :disabled="batching || !batchComment.trim()"
            @click="confirmBatch"
          >
            {{
              batching
                ? '提交中…'
                : `确认${batchKind === 'approve' ? '通过' : '拒绝'} ${selectedIds.size} 条`
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- 批量结果弹窗 -->
    <div v-if="batchResult" class="modal-mask">
      <div class="modal" role="dialog" aria-labelledby="batch-result-title">
        <h2 id="batch-result-title">
          批量{{ batchResultKind === 'approve' ? '通过' : '拒绝' }}结果
        </h2>
        <p class="modal-desc">
          共 {{ batchResult.total }} 条：成功 {{ batchResult.successCount }}
          条，失败 {{ batchResult.failureCount }} 条。
        </p>
        <ul v-if="batchResult.failureCount" class="batch-failures">
          <li
            v-for="failure in batchResult.items.filter((i) => !i.success)"
            :key="failure.reviewId"
          >
            #{{ failure.reviewId }}：{{ failure.errorMessage ?? failure.errorCode }}
          </li>
        </ul>
        <div class="modal-actions">
          <button class="btn-primary" @click="batchResult = null">知道了</button>
        </div>
      </div>
    </div>
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
.btn-sm {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.status-tabs {
  display: flex;
  gap: 4px;
}
.status-tab {
  padding: 7px 12px;
  border: 0;
  border-radius: 6px;
  color: #64748b;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.status-tab:hover,
.status-tab.is-selected {
  color: #4f46e5;
  background: #eef2ff;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  color: #3730a3;
  background: #eef2ff;
  font-size: 12px;
}
.select-all-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}
.review-results {
  display: grid;
  gap: 12px;
}
.review-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.review-card.is-selectable {
  border-left: 3px solid #c7d2fe;
}
.review-card__check {
  margin-top: 4px;
  width: 15px;
  height: 15px;
  accent-color: #4f46e5;
  cursor: pointer;
}
.review-card__main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 5px;
}
.review-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.review-card__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 0;
  border: 0;
  color: #1e293b;
  background: transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.review-card__title:hover {
  color: #4f46e5;
}
.review-card__title small {
  color: #64748b;
  font-size: 11px;
  font-weight: 400;
}
.review-card__meta {
  margin: 0;
  color: #94a3b8;
  font-size: 11px;
}
.review-card__comment {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.review-card__review {
  margin: 4px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  color: #64748b;
  background: #f8fafc;
  font-size: 11px;
  line-height: 1.6;
}
.review-card__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}
.modal-mask {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 45%);
}
.modal {
  width: min(92vw, 460px);
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 45px rgb(15 23 42 / 18%);
}
.modal h2 {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 16px;
}
.modal-desc {
  margin: 0 0 14px;
  color: #64748b;
  font-size: 12px;
}
.modal-field {
  display: grid;
  gap: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 650;
}
.modal-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  resize: vertical;
  outline: none;
}
.modal-field textarea:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgb(79 70 229 / 12%);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.inline-error {
  margin: 12px 0 0;
  color: #b91c1c;
  font-size: 12px;
}
.batch-failures {
  max-height: 200px;
  margin: 0;
  overflow-y: auto;
  padding: 10px 12px;
  border-radius: 7px;
  color: #b45309;
  background: #fef3c7;
  font-size: 12px;
  line-height: 1.8;
  list-style: none;
}
@media (max-width: 720px) {
  .market-toolbar {
    flex-wrap: wrap;
  }
  .review-card {
    flex-wrap: wrap;
  }
  .review-card__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
