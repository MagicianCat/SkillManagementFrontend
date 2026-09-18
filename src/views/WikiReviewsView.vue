<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  approveWikiReview,
  batchApproveWikiReviews,
  batchRejectWikiReviews,
  listWikiReviews,
  rejectWikiReview,
  searchWikiTeams,
} from '../api/wiki.api'
import { reviewStatusLabel, type WikiReviewStatus, type WikiReviewSummary } from '../types/review'
import type { PageResponse, WikiTeam } from '../types/skill'

const router = useRouter()
const response = ref<PageResponse<WikiReviewSummary> | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const keyword = ref('')
const teamId = ref<number | undefined>()
const status = ref<WikiReviewStatus | ''>('PENDING')
const teams = ref<WikiTeam[]>([])
const selectedIds = ref<Set<number>>(new Set())
const actionId = ref<number | null>(null)
const actionKind = ref<'approve' | 'reject'>('approve')
const actionComment = ref('')
const showAction = ref(false)
const showBatch = ref(false)
const batchKind = ref<'approve' | 'reject'>('approve')
const batchComment = ref('')
const acting = ref(false)
const page = ref(0)

const statusOptions = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
  { label: '全部', value: '' },
]

const teamOptions = computed(() => teams.value.map(team => ({ label: team.name, value: team.id })))
const pendingItems = computed(() => response.value?.items.filter(item => item.status === 'PENDING') ?? [])
const allSelected = computed(() => pendingItems.value.length > 0 && pendingItems.value.every(item => selectedIds.value.has(item.reviewId)))

function errorText(error: unknown, fallback: string) {
  return axios.isAxiosError(error) ? String(error.response?.data?.message ?? fallback) : fallback
}

async function loadTeams(keywordValue = '') {
  try {
    teams.value = (await searchWikiTeams(keywordValue, 0, 50)).items
  } catch {
    // 团队筛选失败不影响审核列表使用
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await listWikiReviews({
      status: status.value || undefined,
      keyword: keyword.value.trim() || undefined,
      teamId: teamId.value,
      page: page.value,
      size: 12,
      sort: 'submittedAt,desc',
    })
    selectedIds.value = new Set()
  } catch (error: unknown) {
    errorMessage.value = errorText(error, 'Wiki 审核任务加载失败')
  } finally {
    loading.value = false
  }
}

function changeStatus(value: string | number) {
  status.value = String(value) as WikiReviewStatus | ''
  page.value = 0
  void load()
}

function changeTeam(value: string | number) {
  teamId.value = value ? Number(value) : undefined
  page.value = 0
  void load()
}

function openAction(item: WikiReviewSummary, kind: 'approve' | 'reject') {
  actionId.value = item.reviewId
  actionKind.value = kind
  actionComment.value = ''
  showAction.value = true
}

function toggle(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else if (next.size < 50) next.add(id)
  selectedIds.value = next
}

function toggleAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(pendingItems.value.slice(0, 50).map(item => item.reviewId))
}

async function confirmAction() {
  if (!actionId.value || !actionComment.value.trim()) return
  acting.value = true
  try {
    if (actionKind.value === 'approve') await approveWikiReview(actionId.value, actionComment.value.trim())
    else await rejectWikiReview(actionId.value, actionComment.value.trim())
    showAction.value = false
    await load()
  } catch (error: unknown) {
    errorMessage.value = errorText(error, '操作失败')
  } finally {
    acting.value = false
  }
}

async function confirmBatch() {
  if (!selectedIds.value.size || !batchComment.value.trim()) return
  acting.value = true
  try {
    const ids = [...selectedIds.value]
    if (batchKind.value === 'approve') await batchApproveWikiReviews(ids, batchComment.value.trim())
    else await batchRejectWikiReviews(ids, batchComment.value.trim())
    showBatch.value = false
    await load()
  } catch (error: unknown) {
    errorMessage.value = errorText(error, '批量操作失败')
  } finally {
    acting.value = false
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function statusTheme(value: WikiReviewStatus) {
  return value === 'PENDING' ? 'warning' : value === 'APPROVED' ? 'success' : value === 'REJECTED' ? 'danger' : 'default'
}

function changePage(value: number) {
  page.value = value - 1
  void load()
}

function changeReviewType(value: string | number) {
  if (String(value) === 'skill') void router.push({ name: 'reviews' })
}

onMounted(() => {
  void loadTeams()
  void load()
})
</script>

<template>
  <div class="market-page wiki-review-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">REVIEW · WIKI</p>
        <h1>审核中心</h1>
        <p class="page-subtitle">处理团队 Wiki 推送到全平台的审核任务</p>
      </div>
    </div>

    <t-tabs class="review-type-tabs" value="wiki" @change="changeReviewType">
      <t-tab-panel value="skill" label="Skill 审核" />
      <t-tab-panel value="wiki" label="Wiki 审核" />
    </t-tabs>

    <section class="market-toolbar wiki-review-toolbar" aria-label="Wiki 审核任务搜索">
      <t-input v-model="keyword" class="review-keyword-filter" clearable placeholder="按文档标题搜索" @enter="page = 0; load()" />
      <t-select v-model="teamId" class="review-team-filter" clearable filterable placeholder="筛选团队" :options="teamOptions" @search="loadTeams" @change="changeTeam" />
      <t-space class="status-tabs" size="small" role="tablist" aria-label="状态筛选">
        <t-button v-for="tab in statusOptions" :key="tab.label" class="status-tab" variant="text" size="small" :class="{ 'is-selected': status === tab.value }" @click="changeStatus(tab.value)">{{ tab.label }}</t-button>
      </t-space>
      <span v-if="response" class="result-count">共 {{ response.totalElements }} 条</span>
    </section>

    <t-alert v-if="errorMessage" theme="error" :message="errorMessage" close-btn @close="errorMessage = ''" />

    <t-card v-if="selectedIds.size" :bordered="true" class="batch-bar">
      <span>已选 {{ selectedIds.size }}/50 条</span>
      <t-space>
        <t-button theme="primary" size="small" @click="batchKind = 'approve'; batchComment = ''; showBatch = true">批量通过</t-button>
        <t-button theme="danger" size="small" @click="batchKind = 'reject'; batchComment = ''; showBatch = true">批量拒绝</t-button>
        <t-button variant="outline" size="small" @click="selectedIds = new Set()">清空</t-button>
      </t-space>
    </t-card>

    <t-loading :loading="loading" text="正在加载 Wiki 审核任务…" class="review-loading">
      <t-empty v-if="!response?.items.length" description="没有匹配的 Wiki 审核任务" />
      <template v-else>
        <t-card v-if="pendingItems.length" :bordered="true" class="select-all-card">
          <t-checkbox :checked="allSelected" @change="toggleAll">全选本页待审核（{{ pendingItems.length }} 条）</t-checkbox>
        </t-card>
        <div class="review-list">
          <t-card v-for="item in response.items" :key="item.reviewId" :bordered="true" class="review-item-card">
            <div class="review-item-check">
              <t-checkbox v-if="item.status === 'PENDING'" :checked="selectedIds.has(item.reviewId)" :disabled="!selectedIds.has(item.reviewId) && selectedIds.size >= 50" @change="toggle(item.reviewId)" />
            </div>
            <div class="review-item-main">
              <div class="review-item-title-row">
                <t-link theme="primary" hover="color" @click="router.push({ name: 'wiki-review-detail', params: { reviewId: item.reviewId } })">{{ item.title }}</t-link>
                <t-tag :theme="statusTheme(item.status)" variant="light">{{ reviewStatusLabel(item.status) }}</t-tag>
              </div>
              <p class="review-item-meta">{{ item.teamName ?? '未知团队' }} · 修订 {{ item.revisionNo }} · 第 {{ item.reviewNo }} 轮 · {{ item.submitterName }} 提交于 {{ formatTime(item.submittedAt) }}</p>
              <p class="review-item-comment">{{ item.submitComment }}</p>
              <t-alert v-if="item.status !== 'PENDING' && item.reviewComment" theme="default" :message="`审核意见（${item.reviewerName ?? '—'}）：${item.reviewComment}`" />
            </div>
            <t-space class="review-item-actions">
              <template v-if="item.status === 'PENDING'">
                <t-button theme="primary" size="small" @click="openAction(item, 'approve')">通过</t-button>
                <t-button theme="danger" size="small" @click="openAction(item, 'reject')">拒绝</t-button>
              </template>
              <t-button variant="outline" size="small" @click="router.push({ name: 'wiki-review-detail', params: { reviewId: item.reviewId } })">查看详情</t-button>
            </t-space>
          </t-card>
        </div>
      </template>
    </t-loading>

    <t-pagination v-if="response && response.totalPages > 1" :current="page + 1" :total="response.totalElements" :page-size="12" :total-content="false" show-jumper @change="changePage" />

    <t-dialog v-model:visible="showAction" :header="actionKind === 'approve' ? '通过 Wiki 审核' : '拒绝 Wiki 审核'" :confirm-btn="{ content: '确认', loading: acting, disabled: !actionComment.trim() }" cancel-btn="取消" @confirm="confirmAction">
      <t-textarea v-model="actionComment" :autosize="{ minRows: 4, maxRows: 8 }" placeholder="审核意见（必填）" />
    </t-dialog>

    <t-dialog v-model:visible="showBatch" :header="batchKind === 'approve' ? '批量通过 Wiki 审核' : '批量拒绝 Wiki 审核'" :confirm-btn="{ content: '确认', loading: acting, disabled: !batchComment.trim() }" cancel-btn="取消" @confirm="confirmBatch">
      <p>将处理选中的 {{ selectedIds.size }} 条任务，审核意见将应用到每一条。</p>
      <t-textarea v-model="batchComment" :autosize="{ minRows: 4, maxRows: 8 }" placeholder="批量审核意见（必填）" />
    </t-dialog>
  </div>
</template>

<style scoped>
.review-type-tabs{margin:18px 0}.wiki-review-toolbar{gap:16px}.review-keyword-filter{flex:1 1 360px;min-width:260px;max-width:440px}.review-team-filter{flex:0 0 240px;width:240px}.status-tabs{flex:0 0 auto}.status-tab{padding:7px 12px}.status-tab.is-selected{color:var(--accent-500);background:var(--accent-softer)}.result-count{margin-left:auto;white-space:nowrap}.batch-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.review-loading{min-height:180px}.select-all-card{margin-bottom:12px}.review-list{display:grid;gap:12px}.review-item-card :deep(.t-card__body){display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:12px}.review-item-title-row{display:flex;align-items:center;gap:10px}.review-item-meta{margin:8px 0;color:var(--text-2);font-size:12px}.review-item-comment{margin:0;color:var(--text-1);font-size:13px;line-height:1.6}.review-item-comment:empty{display:none}.review-item-actions{align-self:center;white-space:nowrap}.review-item-main :deep(.t-alert){margin-top:10px}.review-item-main :deep(.t-alert__message){font-size:12px}@media(max-width:900px){.wiki-review-toolbar{flex-wrap:wrap}.review-keyword-filter{flex-basis:100%;max-width:none}.review-team-filter{flex:1 1 240px}.result-count{margin-left:0}.review-item-card :deep(.t-card__body){grid-template-columns:auto minmax(0,1fr)}.review-item-actions{grid-column:2}}
</style>
