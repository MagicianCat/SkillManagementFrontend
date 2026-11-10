<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { approveWikiReview, getWikiReview, rejectWikiReview } from '../api/wiki.api'
import MarkdownView from '../components/MarkdownView.vue'
import { reviewStatusLabel, type WikiReview, type WikiReviewStatus } from '../types/review'

const route = useRoute()
const router = useRouter()
const review = ref<WikiReview | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const comment = ref('')
const acting = ref(false)

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

async function confirmAction(kind: 'approve' | 'reject') {
  if (!review.value || !comment.value.trim()) return
  acting.value = true
  errorMessage.value = ''
  try {
    if (kind === 'approve') await approveWikiReview(review.value.reviewId, comment.value.trim())
    else await rejectWikiReview(review.value.reviewId, comment.value.trim())
    await router.push({ name: 'wiki-reviews' })
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '操作失败')
      : '操作失败'
    if (axios.isAxiosError(error) && error.response?.data?.code === 'WIKI_REVIEW_NOT_PENDING') {
      await load()
    }
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

        <div class="detail-content">
          <t-card title="提交时的 Markdown" :bordered="true">
            <MarkdownView :content="review.markdownContent" class="markdown-content" />
          </t-card>

          <t-card :title="`本次公开范围：${review.wikiCount ?? 1} 篇 Wiki，${review.skillCount ?? review.skills.length} 个 Skill`" :bordered="true">
            <p class="detail-copy">管理员批准后，以下整棵子树及其关联的团队 Skill 将一起公开。</p>
            <ul><li v-for="item in review.wikiItems" :key="item.documentId">{{ item.title }} · 修订 {{ item.revisionNo }} · ID {{ item.documentId }}</li></ul>
            <p v-if="!review.wikiItems?.length" class="detail-copy">历史单篇审核任务</p>
          </t-card>

          <t-card :title="`关联 Skill（${review.skills.length}）`" :bordered="true">
            <p class="detail-copy skill-promotion-note">通过本次 Wiki 审核时，关联的团队 Skill 也会同步转为全平台可见。</p>
            <t-space break-line>
              <RouterLink v-for="skill in review.skills" :key="skill.id" :to="{ name: 'skill-detail', params: { skillKey: skill.skillKey } }">
                <t-tag theme="primary" variant="outline">{{ skill.displayName }}</t-tag>
              </RouterLink>
            </t-space>
          </t-card>

          <t-card title="提交说明" :bordered="true">
            <p class="detail-copy">{{ review.submitComment || '（未填写）' }}</p>
          </t-card>

          <t-card v-if="review.status === 'PENDING'" title="审核意见" :bordered="true">
            <t-textarea v-model="comment" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="通过或拒绝均需填写意见（必填）" />
            <t-alert v-if="errorMessage" class="action-error" theme="error" :message="errorMessage" />
            <div class="action-buttons">
              <t-button theme="danger" :disabled="acting || !comment.trim()" @click="confirmAction('reject')">拒绝</t-button>
              <t-button theme="primary" :loading="acting" :disabled="acting || !comment.trim()" @click="confirmAction('approve')">通过</t-button>
            </div>
          </t-card>
          <t-card v-else title="审核结果" :bordered="true">
            <p class="detail-copy">{{ review.reviewComment || '（未填写）' }}</p>
            <p class="detail-meta">{{ review.reviewerName ?? '—' }} · {{ formatTime(review.reviewedAt) }}</p>
          </t-card>
        </div>
      </template>
    </t-loading>

  </div>
</template>

<style scoped>
.detail-loading{margin-top:18px}.detail-header-card{margin-top:18px}.detail-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.detail-header h1{margin:4px 0 10px;color:var(--text-1);font-size:24px}.detail-meta{margin:5px 0;color:var(--text-2);font-size:13px}.detail-content{display:grid;gap:16px;margin-top:16px}.action-buttons{display:flex;justify-content:flex-end;gap:12px;margin-top:16px}.action-error{margin-top:12px}.markdown-content{overflow:auto;margin:0;padding:16px;border-radius:8px;color:var(--text-1);background:var(--surface-2)}.detail-copy{margin:0;color:var(--text-2);font-size:13px;line-height:1.8}.skill-promotion-note{margin-bottom:10px}@media(max-width:900px){.detail-header{flex-direction:column}}
</style>
