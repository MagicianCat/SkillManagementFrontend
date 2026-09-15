<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  getSkill,
  getSkillVersions,
  downloadSkillVersion,
  getSkillFeedback,
  saveSkillRating,
  addSkillComment,
  deleteSkillComment,
} from '../api/skills.api'
import { useAuthStore } from '../stores/auth'
import { saveBlobResponse } from '../utils/download'
import {
  developmentStageLabel,
  type SkillView,
  type VersionView,
  type SkillFeedbackPage,
  type WikiDocument,
} from '../types/skill'
import { getSkillWikiDocuments } from '../api/skills.api'
import { getSkillInstallGuide } from '../utils/skill-installation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const skill = ref<SkillView | null>(null)
const versions = ref<VersionView[]>([])
const selectedId = ref<number | null>(null)
const platform = ref(typeof route.query.platform === 'string' ? route.query.platform : 'CODEBUDDY')
const osType = ref(typeof route.query.osType === 'string' ? route.query.osType : 'ANY')
const feedback = ref<SkillFeedbackPage | null>(null)
const wikiDocuments = ref<WikiDocument[]>([])
const myRating = ref(0)
const commentDraft = ref('')
const feedbackBusy = ref(false)
const commentsLoading = ref(false)
const loading = ref(true)
const downloading = ref(false)
const errorMessage = ref('')
const downloadable = computed(() =>
  versions.value.filter((version) =>
    ['PUBLISHED', 'DEPRECATED'].includes(version.lifecycleStatus),
  ),
)
const selectedVersion = computed(
  () =>
    versions.value.find((version) => version.id === selectedId.value) ?? null,
)
const skillKey = computed(() => String(route.params.skillKey))
const installGuide = computed(() =>
  getSkillInstallGuide(platform.value, osType.value, skillKey.value),
)
const lifecycleLabel = (status: string) =>
  ({
    DRAFT: '草稿',
    REVIEWING: '审核中',
    APPROVED: '已批准',
    PUBLISHED: '已发布',
    DEPRECATED: '已废弃',
    OFFLINE: '已下线',
  })[status] ?? status

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [skillResult, versionsResult, feedbackResult, wikiResult] = await Promise.all([
      getSkill(skillKey.value),
      getSkillVersions(skillKey.value),
      getSkillFeedback(skillKey.value),
      getSkillWikiDocuments(skillKey.value),
    ])
    skill.value = skillResult
    versions.value = versionsResult
    feedback.value = feedbackResult
    wikiDocuments.value = wikiResult
    myRating.value = feedbackResult.myRating?.rating ?? 0
    selectedId.value =
      downloadable.value[0]?.id ?? versionsResult[0]?.id ?? null
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? 'Skill 详情加载失败')
      : 'Skill 详情加载失败'
  } finally {
    loading.value = false
  }
}

async function updateRating(rating: number) {
  if (!rating || feedbackBusy.value) return
  const previous = myRating.value
  myRating.value = rating
  feedbackBusy.value = true
  try {
    await saveSkillRating(skillKey.value, rating)
    feedback.value = await getSkillFeedback(skillKey.value, feedback.value?.comments.number ?? 0)
  } catch (error: unknown) {
    myRating.value = previous
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '评分保存失败')
      : '评分保存失败'
  } finally { feedbackBusy.value = false }
}
async function submitComment() {
  const comment = commentDraft.value.trim()
  if (!comment || feedbackBusy.value) return
  feedbackBusy.value = true
  try {
    await addSkillComment(skillKey.value, comment)
    commentDraft.value = ''
    feedback.value = await getSkillFeedback(skillKey.value)
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '评论发布失败')
      : '评论发布失败'
  } finally { feedbackBusy.value = false }
}
async function removeComment(commentId: number) {
  if (feedbackBusy.value) return
  feedbackBusy.value = true
  try {
    await deleteSkillComment(skillKey.value, commentId)
    feedback.value = await getSkillFeedback(skillKey.value, feedback.value?.comments.number ?? 0)
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '评论删除失败')
      : '评论删除失败'
  } finally { feedbackBusy.value = false }
}
async function loadMoreComments() {
  if (!feedback.value || feedback.value.comments.last || commentsLoading.value) return
  commentsLoading.value = true
  try {
    const next = await getSkillFeedback(skillKey.value, feedback.value.comments.number + 1)
    feedback.value = {
      ...next,
      comments: {
        ...next.comments,
        content: [...feedback.value.comments.content, ...next.comments.content],
      },
    }
  } finally { commentsLoading.value = false }
}

async function download() {
  if (
    !selectedVersion.value ||
    !['PUBLISHED', 'DEPRECATED'].includes(selectedVersion.value.lifecycleStatus)
  )
    return
  downloading.value = true
  errorMessage.value = ''
  try {
    saveBlobResponse(
      await downloadSkillVersion(
        selectedVersion.value.id,
        platform.value,
        osType.value,
      ),
    )
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? '下载失败，请稍后重试')
      : '下载失败，请稍后重试'
  } finally {
    downloading.value = false
  }
}
onMounted(load)
</script>

<template>
  <div class="detail-page">
    <button class="back-link" @click="router.push({ name: 'skills' })">
      ← 返回 Skill 市场
    </button>
    <div v-if="loading" class="result-state">正在加载详情…</div>
    <div
      v-else-if="errorMessage && !skill"
      class="result-state result-state--error"
    >
      {{ errorMessage }}
    </div>
    <template v-else-if="skill">
      <header class="detail-header">
        <div>
          <p class="eyebrow">SKILL DETAIL</p>
          <h1>{{ skill.displayName }}</h1>
          <p class="skill-key">{{ skill.skillKey }}</p>
          <p class="detail-description">
            {{ skill.description || '暂无描述' }}
          </p>
          <a
            v-if="skill.sourceUrl"
            class="source-url"
            :href="skill.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            来源网址 ↗
          </a>
        </div>
        <div class="detail-header__badges">
          <span
            v-if="skill.developmentStage"
            class="status-badge"
            :class="`stage-${skill.developmentStage.toLowerCase()}`"
            >{{ developmentStageLabel(skill.developmentStage) }}</span
          >
          <span
            class="status-badge"
            :class="`status-${skill.status.toLowerCase()}`"
            >{{ skill.status === 'ACTIVE' ? '有效' : '已归档' }}</span
          >
        </div>
      </header>
      <div class="detail-layout">
        <section class="version-panel">
          <div class="section-heading">
            <div>
              <h2>版本历史</h2>
              <p>选择一个已发布版本查看下载选项</p>
            </div>
            <span>{{ versions.length }} 个版本</span>
          </div>
          <div v-if="!versions.length" class="result-state">暂无版本</div>
          <button
            v-for="version in versions"
            :key="version.id"
            class="version-row"
            :class="{ 'is-selected': selectedId === version.id }"
            @click="selectedId = version.id"
          >
            <span class="version-radio"></span
            ><span class="version-main"
              ><strong>{{
                version.version
                  ? `v${version.version}`
                  : version.candidateVersion
                    ? `候选 v${version.candidateVersion}`
                    : '尚未分配'
              }}</strong
              ><small
                >{{ version.changeType }} · r{{ version.sourceRevision }}</small
              ></span
            ><span
              class="status-badge"
              :class="`status-${version.lifecycleStatus.toLowerCase()}`"
              >{{ lifecycleLabel(version.lifecycleStatus) }}</span
            >
          </button>
        </section>
        <aside class="download-panel">
          <p class="eyebrow">DOWNLOAD</p>
          <h2>下载 Skill 包</h2>
          <p class="download-help">请选择目标平台与操作系统。</p>
          <label
            >平台<select v-model="platform">
              <option value="CODEBUDDY">CodeBuddy</option>
              <option value="OPENCODE">OpenCode</option>
            </select></label
          ><label
            >操作系统<select v-model="osType">
              <option value="ANY">通用（ANY）</option>
              <option value="WINDOWS">Windows</option>
              <option value="MACOS">macOS</option>
              <option value="LINUX">Linux</option>
            </select></label
          >
          <div class="install-guide" aria-live="polite">
            <strong>解压后放置位置</strong>
            <span class="install-guide__target">{{ installGuide.platformLabel }} · {{ installGuide.osLabel }}</span>
            <div v-for="location in installGuide.locations" :key="location.scope" class="install-location">
              <span>{{ location.label }}</span>
              <code>{{ location.path }}</code>
            </div>
            <small>{{ installGuide.note }}</small>
          </div>
          <p
            v-if="
              selectedVersion &&
              !['PUBLISHED', 'DEPRECATED'].includes(
                selectedVersion.lifecycleStatus,
              )
            "
            class="download-disabled"
          >
            当前版本尚未发布，暂不可下载。
          </p>
          <p v-if="errorMessage" class="inline-error" role="alert">
            {{ errorMessage }}
          </p>
          <button
            class="download-button"
            :disabled="
              downloading ||
              !selectedVersion ||
              !['PUBLISHED', 'DEPRECATED'].includes(
                selectedVersion.lifecycleStatus,
              )
            "
            @click="download"
          >
            {{ downloading ? '准备下载…' : '下载 Skill 包' }}
          </button>
        </aside>
      </div>
      <section v-if="feedback" class="feedback-section">
        <div class="feedback-summary"><strong>评分 {{ feedback.averageRating.toFixed(1) }} / 5</strong><span>{{ feedback.ratingCount }} 人评分 · {{ feedback.downloadCount }} 次下载</span></div>
        <div class="rating-editor">
          <div class="rating-heading"><strong>我的评分</strong><span v-if="myRating">点击星级即可更新</span><span v-else>请选择 1～5 星</span></div>
          <div class="stars" role="radiogroup" aria-label="我的评分"><t-button v-for="star in 5" :key="star" variant="text" class="star-button" :aria-label="`${star} 分`" :class="{ active: star <= myRating }" :disabled="feedbackBusy" @click="updateRating(star)">★</t-button></div>
        </div>
        <div class="comment-editor">
          <strong>发表评论</strong>
          <textarea v-model="commentDraft" maxlength="2000" placeholder="分享你对这个 Skill 的使用体验"></textarea>
          <div class="comment-editor__footer"><span>{{ commentDraft.length }}/2000</span><t-button theme="primary" :loading="feedbackBusy" :disabled="!commentDraft.trim()" @click="submitComment">发布评论</t-button></div>
        </div>
        <div class="feedback-list">
          <div class="comment-list-heading"><strong>用户评论</strong><span>{{ feedback.comments.totalElements }} 条</span></div>
          <article v-for="item in feedback.comments.content" :key="item.id" class="feedback-item"><div class="feedback-item__head"><strong>{{ item.userName }}</strong><time>{{ new Date(item.createdAt).toLocaleString() }}</time><t-button v-if="item.userId === authStore.user?.id" variant="text" theme="danger" size="small" :disabled="feedbackBusy" @click="removeComment(item.id)">删除</t-button></div><p>{{ item.comment }}</p></article>
          <p v-if="!feedback.comments.content.length" class="download-help">还没有评论，欢迎发表第一条评论。</p>
          <t-button v-else-if="!feedback.comments.last" variant="outline" class="load-more-comments" :loading="commentsLoading" @click="loadMoreComments">加载更多评论</t-button>
        </div>
      </section>
      <section v-if="wikiDocuments.length" class="wiki-related-section">
        <div class="section-heading"><div><h2>相关 Wiki 文档</h2><p>查看这个 Skill 的使用说明与团队套组文档</p></div><span>{{ wikiDocuments.length }} 篇</span></div>
        <RouterLink v-for="document in wikiDocuments" :key="document.id" class="wiki-related-card" :to="{ name: 'wiki', query: { documentId: String(document.id) } }"><span><strong>{{ document.title }}</strong><small>{{ document.documentType === 'SKILL_README' ? 'Skill README' : '团队套组说明' }} · {{ document.platformVisible ? '全公司可见' : '团队内部可见' }}</small></span><span class="wiki-related-card__arrow">查看 →</span></RouterLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.feedback-section{margin-top:22px;padding:22px;border:1px solid #ece1d2;border-radius:10px;background:#fff}.feedback-summary{display:flex;justify-content:space-between;align-items:center;color:#64748b;font-size:12px}.feedback-summary strong{color:#0f172a;font-size:20px}.rating-editor,.comment-editor{display:grid;gap:10px;margin:18px 0;padding-bottom:18px;border-bottom:1px solid #ece1d2}.rating-heading,.comment-editor__footer,.comment-list-heading,.feedback-item__head{display:flex;align-items:center;justify-content:space-between;gap:10px}.rating-heading span,.comment-editor__footer span,.comment-list-heading span,.feedback-item__head time{color:#94a3b8;font-size:11px}.stars{display:flex;gap:2px}.star-button{height:32px!important;padding:0 3px!important;color:#dfcfb8!important;font-size:25px!important;line-height:1!important}.star-button.active{color:#f59e0b!important}.comment-editor textarea{min-height:70px;padding:10px;border:1px solid #dfcfb8;border-radius:6px;font:inherit;resize:vertical}.feedback-item{padding:12px 0;border-bottom:1px solid #f6efe5}.feedback-item strong{font-size:13px;color:#334155}.feedback-item p{margin:7px 0 0;color:#475569;font-size:13px;white-space:pre-wrap}.feedback-item__head{justify-content:flex-start}.feedback-item__head time{margin-right:auto}.load-more-comments{display:block;margin:14px auto 0}
.wiki-related-section{margin-top:22px;padding:22px;border:1px solid #ece1d2;border-radius:10px;background:#fff}.wiki-related-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid #f6efe5;color:#334155;text-decoration:none}.wiki-related-card strong,.wiki-related-card small{display:block}.wiki-related-card small{margin-top:4px;color:#94a3b8;font-size:11px}.wiki-related-card__arrow{color:#e86600;font-size:12px}
.install-guide{display:grid;gap:8px;margin-top:14px;padding:13px;border:1px solid #f2d8bf;border-radius:8px;background:#fff8f1;color:#334155}.install-guide strong{font-size:13px}.install-guide__target{color:#e86600;font-size:12px}.install-location{display:grid;gap:4px}.install-location span{color:#64748b;font-size:11px}.install-location code{overflow-wrap:anywhere;padding:7px 8px;border-radius:5px;background:#fff;color:#7c3f12;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.install-guide small{color:#94a3b8;font-size:11px;line-height:1.5}
.detail-header__badges {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}
.stage-requirement {
  color: #0e7490;
  background: #cffafe;
}
.stage-design {
  color: #6d28d9;
  background: #ede9fe;
}
.stage-frontend_coding,
.stage-backend_coding {
  color: #b34a00;
  background: #ffe6c7;
}
.stage-testing {
  color: #b45309;
  background: #fef3c7;
}
.stage-released {
  color: #15803d;
  background: #dcfce7;
}
.stage-other {
  color: #475569;
  background: #ece1d2;
}
</style>
