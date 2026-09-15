<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { approveWikiReview, getWikiReview, rejectWikiReview } from '../api/wiki.api'
import { reviewStatusLabel, type WikiReview, type WikiReviewStatus } from '../types/review'

const route = useRoute()
const router = useRouter()
const review = ref<WikiReview | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const comment = ref('')
const acting = ref(false)
const showAction = ref(false)
const actionKind = ref<'approve' | 'reject'>('approve')

function statusTheme(value: WikiReviewStatus) {
  return value === 'PENDING' ? 'warning' : value === 'APPROVED' ? 'success' : value === 'REJECTED' ? 'danger' : 'default'
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'
}

async function load() {
  try {
    review.value = await getWikiReview(Number(route.params.reviewId))
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? 'Wiki 审核任务加载失败')
      : 'Wiki 审核任务加载失败'
  } finally {
    loading.value = false
  }
}

function openAction(kind: 'approve' | 'reject') {
  actionKind.value = kind
  comment.value = ''
  showAction.value = true
}

async function confirmAction() {
  if (!review.value || !comment.value.trim()) return
  acting.value = true
  try {
    if (actionKind.value === 'approve') await approveWikiReview(review.value.reviewId, comment.value.trim())
    else await rejectWikiReview(review.value.reviewId, comment.value.trim())
    await router.push({ name: 'wiki-reviews' })
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '操作失败')
      : '操作失败'
    showAction.value = false
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="market-page wiki-review-detail">
    <t-button variant="text" @click="router.push({ name: 'wiki-reviews' })">← 返回 Wiki 审核</t-button>

    <t-loading :loading="loading" text="正在加载审核任务…" class="detail-loading">
      <t-alert v-if="errorMessage && !review" theme="error" :message="errorMessage" />
      <template v-else-if="review">
        <t-card :bordered="true" class="detail-header-card">
          <div class="detail-header">
            <div>
              <p class="eyebrow">WIKI REVIEW #{{ review.reviewId }}</p>
              <h1>{{ review.title }}</h1>
              <p class="detail-meta">{{ review.teamName ?? '未知团队' }} · 修订 {{ review.revisionNo }} · 第 {{ review.reviewNo }} 轮</p>
              <p class="detail-meta">{{ review.submitterName }} 提交于 {{ formatTime(review.submittedAt) }}</p>
            </div>
            <t-tag :theme="statusTheme(review.status)" variant="light" size="large">{{ reviewStatusLabel(review.status) }}</t-tag>
          </div>
        </t-card>

        <div class="detail-grid">
          <div class="detail-main">
            <t-card title="提交时的 Markdown" :bordered="true">
              <pre class="markdown-content">{{ review.markdownContent }}</pre>
            </t-card>

            <t-card :title="`关联 Skill（${review.skills.length}）`" :bordered="true">
              <t-space break-line>
                <RouterLink v-for="skill in review.skills" :key="skill.id" :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }">
                  <t-tag theme="primary" variant="outline">{{ skill.displayName }}</t-tag>
                </RouterLink>
              </t-space>
            </t-card>
          </div>

          <div class="detail-side">
            <t-card title="提交说明" :bordered="true">
              <p class="detail-copy">{{ review.submitComment || '（未填写）' }}</p>
            </t-card>
            <t-card v-if="review.status !== 'PENDING'" title="审核结果" :bordered="true">
              <p class="detail-copy">{{ review.reviewComment || '（未填写）' }}</p>
              <p class="detail-meta">{{ review.reviewerName ?? '—' }} · {{ formatTime(review.reviewedAt) }}</p>
            </t-card>
            <t-card v-if="review.status === 'PENDING'" title="审核操作" :bordered="true">
              <t-space>
                <t-button theme="danger" :disabled="acting" @click="openAction('reject')">拒绝</t-button>
                <t-button theme="primary" :disabled="acting" @click="openAction('approve')">通过</t-button>
              </t-space>
            </t-card>
            <t-alert v-if="errorMessage" theme="error" :message="errorMessage" />
          </div>
        </div>
      </template>
    </t-loading>

    <t-dialog v-model:visible="showAction" :header="actionKind === 'approve' ? '通过 Wiki 审核' : '拒绝 Wiki 审核'" :confirm-btn="{ content: '确认', loading: acting, disabled: !comment.trim() }" cancel-btn="取消" @confirm="confirmAction">
      <t-textarea v-model="comment" :autosize="{ minRows: 5, maxRows: 10 }" placeholder="审核意见（必填）" />
    </t-dialog>
  </div>
</template>

<style scoped>
.detail-loading{margin-top:18px}.detail-header-card{margin-top:18px}.detail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.detail-header h1{margin:4px 0 10px;color:#0f172a;font-size:24px}.detail-meta{margin:5px 0;color:#64748b;font-size:13px}.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;margin-top:16px}.detail-main,.detail-side{display:grid;align-content:start;gap:16px}.markdown-content{max-height:680px;overflow:auto;margin:0;padding:16px;border-radius:8px;color:#334155;background:#f8fafc;font:13px/1.8 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}.detail-copy{margin:0;color:#475569;font-size:13px;line-height:1.8}.detail-side :deep(.t-space){width:100%}@media(max-width:900px){.detail-grid{grid-template-columns:1fr}.detail-header{flex-direction:column}}
</style>
