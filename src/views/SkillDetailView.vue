<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  getSkill,
  getSkillVersions,
  downloadSkillVersion,
  getSkillFeedback,
  saveSkillFeedback,
  deleteSkillFeedback,
} from '../api/skills.api'
import { saveBlobResponse } from '../utils/download'
import {
  developmentStageLabel,
  type SkillView,
  type VersionView,
  type SkillFeedbackPage,
} from '../types/skill'

const route = useRoute()
const router = useRouter()
const skill = ref<SkillView | null>(null)
const versions = ref<VersionView[]>([])
const selectedId = ref<number | null>(null)
const platform = ref(typeof route.query.platform === 'string' ? route.query.platform : 'CODEBUDDY')
const osType = ref(typeof route.query.osType === 'string' ? route.query.osType : 'ANY')
const feedback = ref<SkillFeedbackPage | null>(null)
const myRating = ref(0)
const myComment = ref('')
const feedbackBusy = ref(false)
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
    const [skillResult, versionsResult, feedbackResult] = await Promise.all([
      getSkill(skillKey.value),
      getSkillVersions(skillKey.value),
      getSkillFeedback(skillKey.value),
    ])
    skill.value = skillResult
    versions.value = versionsResult
    feedback.value = feedbackResult
    myRating.value = feedbackResult.mine?.rating ?? 0
    myComment.value = feedbackResult.mine?.comment ?? ''
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

async function saveFeedback() {
  if (!myRating.value) return
  feedbackBusy.value = true
  try { await saveSkillFeedback(skillKey.value, myRating.value, myComment.value); feedback.value = await getSkillFeedback(skillKey.value); }
  finally { feedbackBusy.value = false }
}
async function removeFeedback() {
  feedbackBusy.value = true
  try { await deleteSkillFeedback(skillKey.value); myRating.value = 0; myComment.value = ''; feedback.value = await getSkillFeedback(skillKey.value); }
  finally { feedbackBusy.value = false }
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
        <div class="feedback-summary"><strong>评分 {{ feedback.averageRating.toFixed(1) }} / 5</strong><span>{{ feedback.ratingCount }} 条评价 · {{ feedback.downloadCount }} 次下载</span></div>
        <div class="feedback-editor"><div class="stars" role="radiogroup" aria-label="评分"><button v-for="star in 5" :key="star" type="button" :aria-label="`${star} 分`" :class="{ active: star <= myRating }" @click="myRating = star">★</button></div><textarea v-model="myComment" maxlength="2000" placeholder="分享你对这个 Skill 的使用体验（可选）"></textarea><div><button class="download-button" :disabled="feedbackBusy || !myRating" @click="saveFeedback">提交评价</button><button v-if="feedback.mine" class="link-button" :disabled="feedbackBusy" @click="removeFeedback">删除我的评价</button></div></div>
        <div class="feedback-list"><article v-for="item in feedback.items.content" :key="item.id" class="feedback-item"><div><strong>{{ item.userName }}</strong><span class="stars readonly">{{ '★'.repeat(item.rating) }}{{ '☆'.repeat(5 - item.rating) }}</span></div><p v-if="item.comment">{{ item.comment }}</p></article><p v-if="!feedback.items.content.length" class="download-help">还没有评价，欢迎成为第一位评价者。</p></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.feedback-section{margin-top:22px;padding:22px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.feedback-summary{display:flex;justify-content:space-between;align-items:center;color:#64748b;font-size:12px}.feedback-summary strong{color:#0f172a;font-size:20px}.feedback-editor{display:grid;gap:10px;margin:18px 0;padding-bottom:18px;border-bottom:1px solid #e2e8f0}.stars{display:flex;gap:2px}.stars button{border:0;background:transparent;color:#cbd5e1;font-size:25px;cursor:pointer}.stars button.active,.stars.readonly{color:#f59e0b}.stars.readonly{font-size:14px;margin-left:8px}.feedback-editor textarea{min-height:70px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;resize:vertical}.feedback-item{padding:12px 0;border-bottom:1px solid #f1f5f9}.feedback-item strong{font-size:13px;color:#334155}.feedback-item p{margin:7px 0 0;color:#475569;font-size:13px;white-space:pre-wrap}
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
  color: #1d4ed8;
  background: #dbeafe;
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
  background: #e2e8f0;
}
</style>
