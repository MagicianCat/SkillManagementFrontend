<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getSkills } from '../api/skills.api'
import type { LifecycleStatus, PageResponse, SkillView } from '../types/skill'

const route = useRoute()
const router = useRouter()
const statuses: Array<{ value: LifecycleStatus; label: string; icon: string }> =
  [
    { value: 'DRAFT', label: '草稿', icon: '✦' },
    { value: 'REVIEWING', label: '审核中', icon: '◌' },
    { value: 'APPROVED', label: '已批准', icon: '✓' },
    { value: 'PUBLISHED', label: '已发布', icon: '●' },
    { value: 'DEPRECATED', label: '已废弃', icon: '—' },
    { value: 'OFFLINE', label: '已下线', icon: '×' },
  ]
const keywordInput = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : '',
)
const response = ref<PageResponse<SkillView> | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const selectedStatus = computed(() =>
  typeof route.query.lifecycleStatus === 'string'
    ? route.query.lifecycleStatus
    : '',
)
const page = computed(() => Number(route.query.page || 0))

async function fetchSkills() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await getSkills({
      keyword:
        typeof route.query.keyword === 'string'
          ? route.query.keyword
          : undefined,
      lifecycleStatus: (selectedStatus.value as LifecycleStatus) || undefined,
      page: page.value,
      size: 12,
      sort: 'updatedAt,desc',
    })
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(
          error.response?.data?.message ?? 'Skill 列表加载失败，请稍后重试',
        )
      : 'Skill 列表加载失败，请稍后重试'
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

function onKeywordInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(
    () => updateQuery({ keyword: keywordInput.value.trim() || undefined }),
    300,
  )
}

function selectStatus(value: LifecycleStatus) {
  updateQuery({
    lifecycleStatus: selectedStatus.value === value ? undefined : value,
  })
}

function goToPage(nextPage: number) {
  if (!response.value || nextPage < 0 || nextPage >= response.value.totalPages)
    return
  void router.push({ query: { ...route.query, page: String(nextPage) } })
}

function openSkill(skillKey: string) {
  void router.push({ name: 'skill-detail', params: { skillKey } })
}

watch(
  () => route.query,
  () => {
    keywordInput.value =
      typeof route.query.keyword === 'string' ? route.query.keyword : ''
    void fetchSkills()
  },
  { deep: true },
)
onMounted(fetchSkills)
</script>

<template>
  <div class="market-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">CATALOG</p>
        <h1>Skill 市场</h1>
        <p class="page-subtitle">浏览、下载内部 Agent Skill</p>
      </div>
    </div>
    <section class="market-toolbar" aria-label="Skill 搜索">
      <label class="search-box"
        ><span aria-hidden="true">⌕</span
        ><input
          v-model="keywordInput"
          type="search"
          placeholder="根据 skill 名称搜索..."
          @input="onKeywordInput"
      /></label>
      <span v-if="response" class="result-count"
        >共 {{ response.totalElements }} 个 Skill</span
      >
    </section>
    <div class="market-body">
      <aside class="stage-filter" aria-label="开发阶段筛选">
        <p class="filter-label">生命周期</p>
        <button
          class="stage-option"
          :class="{ 'is-selected': !selectedStatus }"
          @click="updateQuery({ lifecycleStatus: undefined })"
        >
          <span>全部 Skill</span>
        </button>
        <button
          v-for="status in statuses"
          :key="status.value"
          class="stage-option"
          :class="{ 'is-selected': selectedStatus === status.value }"
          @click="selectStatus(status.value)"
        >
          <span
            ><i>{{ status.icon }}</i
            >{{ status.label }}</span
          >
        </button>
      </aside>
      <section class="skill-results" aria-live="polite">
        <div v-if="loading" class="result-state">正在加载 Skill…</div>
        <div v-else-if="errorMessage" class="result-state result-state--error">
          {{ errorMessage }}
        </div>
        <div v-else-if="!response?.items.length" class="result-state">
          没有找到匹配的 Skill
        </div>
        <div v-else class="skill-grid">
          <article
            v-for="skill in response.items"
            :key="skill.id"
            class="skill-card"
          >
            <div class="skill-card__top">
              <div class="skill-icon">□</div>
              <span
                class="status-badge"
                :class="`status-${skill.status.toLowerCase()}`"
                >{{ skill.status === 'ACTIVE' ? '有效' : '已归档' }}</span
              >
            </div>
            <button
              class="skill-card__title"
              @click="openSkill(skill.skillKey)"
            >
              {{ skill.displayName }}<small>{{ skill.skillKey }}</small>
            </button>
            <p class="skill-card__description">
              {{ skill.description || '暂无描述' }}
            </p>
            <div class="skill-card__meta">
              <span v-if="skill.latestPublishedVersion"
                >最新 v{{ skill.latestPublishedVersion }}</span
              ><span v-else>尚未发布版本</span
              ><span v-if="skill.activeDraftVersionId" class="draft-note"
                >有活动草稿</span
              >
            </div>
            <div class="skill-card__footer">
              <div class="tag-list">
                <span v-for="tag in skill.tags.slice(0, 2)" :key="tag.id">{{
                  tag.name
                }}</span>
              </div>
              <button class="link-button" @click="openSkill(skill.skillKey)">
                查看版本 →
              </button>
            </div>
          </article>
        </div>
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
    </div>
  </div>
</template>
