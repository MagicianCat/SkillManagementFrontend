<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import {
  getSkill,
  getSkillVersions,
  downloadSkillVersion,
} from '../api/skills.api'
import { saveBlobResponse } from '../utils/download'
import type { SkillView, VersionView } from '../types/skill'

const route = useRoute()
const router = useRouter()
const skill = ref<SkillView | null>(null)
const versions = ref<VersionView[]>([])
const selectedId = ref<number | null>(null)
const platform = ref('CODEBUDDY')
const osType = ref('ANY')
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
    const [skillResult, versionsResult] = await Promise.all([
      getSkill(skillKey.value),
      getSkillVersions(skillKey.value),
    ])
    skill.value = skillResult
    versions.value = versionsResult
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
        <span class="status-badge status-active">{{
          skill.status === 'ACTIVE' ? '有效' : '已归档'
        }}</span>
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
    </template>
  </div>
</template>
