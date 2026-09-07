<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getSkillCategories, getSkills, openDraft } from '../api/skills.api'
import { useAuthStore } from '../stores/auth'
import { hasPermission } from '../types/permissions'
import {
  DEVELOPMENT_STAGES,
  developmentStageLabel,
  type DevelopmentStage,
  type PageResponse,
  type SkillCategory,
  type SkillView,
} from '../types/skill'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const keywordInput = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : '',
)
const response = ref<PageResponse<SkillView> | null>(null)
const categories = ref<SkillCategory[]>([])
const loading = ref(false)
const errorMessage = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const canUpload = computed(() =>
  hasPermission(authStore.user?.permissions, 'skill:upload'),
)
const canEdit = computed(() =>
  hasPermission(authStore.user?.permissions, 'skill:edit'),
)
// 管理员（任一 admin:* 权限）可编辑所有 Skill；普通用户仅可编辑自己维护的
const isAdmin = computed(() =>
  Boolean(
    authStore.user?.permissions?.some((permission) =>
      permission.startsWith('admin:'),
    ),
  ),
)

function canEditSkill(skill: SkillView): boolean {
  if (!canEdit.value) return false
  if (isAdmin.value) return true
  const current = authStore.user
  if (!current) return false
  return skill.owners.some(
    (owner) =>
      owner.userId === current.id || owner.username === current.username,
  )
}

const selectedStage = computed(() =>
  typeof route.query.developmentStage === 'string'
    ? route.query.developmentStage
    : '',
)
const page = computed(() => Number(route.query.page || 0))
const selectedCategoryId = computed(() =>
  typeof route.query.categoryId === 'string' ? route.query.categoryId : '',
)

async function fetchSkills() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await getSkills({
      keyword:
        typeof route.query.keyword === 'string'
          ? route.query.keyword
          : undefined,
      developmentStage: (selectedStage.value as DevelopmentStage) || undefined,
      categoryId: selectedCategoryId.value
        ? Number(selectedCategoryId.value)
        : undefined,
      status: 'ACTIVE',
      page: page.value,
      size: 12,
      sort: 'timeUpdated,desc',
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

function selectStage(value?: DevelopmentStage) {
  updateQuery({
    developmentStage:
      value && selectedStage.value !== value ? value : undefined,
  })
}

function selectCategory(event: Event) {
  const value = (event.target as { value?: string } | null)?.value ?? ''
  updateQuery({ categoryId: value || undefined })
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

function openSkill(skillKey: string) {
  void router.push({ name: 'skill-detail', params: { skillKey } })
}

async function editSkill(skill: SkillView) {
  // 有活动草稿直接进编辑器；无草稿先开一个（Owner/管理员由后端鉴权）
  try {
    if (!skill.activeDraftVersionId) {
      await openDraft(skill.skillKey)
    }
    void router.push({
      name: 'skill-draft',
      params: { skillKey: skill.skillKey },
    })
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError(error)
      ? String(
          error.response?.data?.message ??
            '打开草稿失败（可能仅 Owner 可编辑）',
        )
      : '打开草稿失败'
  }
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
onMounted(() => {
  void fetchSkills()
  void getSkillCategories().then((items) => {
    categories.value = items
  })
})
</script>

<template>
  <div class="market-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">CATALOG</p>
        <h1>Skill 市场</h1>
        <p class="page-subtitle">浏览、下载内部 Agent Skill</p>
      </div>
      <div v-if="canUpload" class="page-actions">
        <button
          class="btn-primary"
          @click="router.push({ name: 'skill-create' })"
        >
          ＋ 新建 Skill
        </button>
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
      <label class="category-filter">
        <span>分类</span>
        <select :value="selectedCategoryId" @change="selectCategory">
          <option value="">全部分类</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </label>
      <span v-if="response" class="result-count"
        >共 {{ response.totalElements }} 个 Skill</span
      >
    </section>
    <div class="market-body">
      <aside class="stage-filter" aria-label="开发阶段筛选">
        <p class="filter-label">开发阶段</p>
        <button
          class="stage-option"
          :class="{ 'is-selected': !selectedStage }"
          @click="selectStage(undefined)"
        >
          全部
        </button>
        <button
          v-for="stage in DEVELOPMENT_STAGES"
          :key="stage.value"
          class="stage-option"
          :class="{ 'is-selected': selectedStage === stage.value }"
          @click="selectStage(stage.value)"
        >
          {{ stage.label }}
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
              <div class="skill-card__badges">
                <span
                  v-if="skill.developmentStage"
                  class="status-badge"
                  :class="`stage-${skill.developmentStage.toLowerCase()}`"
                  >{{ developmentStageLabel(skill.developmentStage) }}</span
                >
              </div>
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
              <div class="skill-card__actions">
                <button class="link-button" @click="openSkill(skill.skillKey)">
                  查看
                </button>
                <button
                  v-if="canEditSkill(skill) && skill.status === 'ACTIVE'"
                  class="link-button link-button--primary"
                  @click.stop="editSkill(skill)"
                >
                  编辑
                </button>
              </div>
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

<style scoped>
.page-actions {
  display: flex;
  gap: 10px;
}
.btn-primary,
.btn-secondary {
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
.btn-primary:disabled {
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
.category-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}
.category-filter select {
  height: 38px;
  min-width: 132px;
  padding: 0 30px 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  color: #334155;
  background: #fff;
  font: inherit;
  outline: none;
}
.category-filter select:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 2px rgb(99 102 241 / 15%);
}
.skill-card__actions {
  display: flex;
  gap: 10px;
}
.link-button--primary {
  padding: 5px 12px;
  border-radius: 6px;
  color: #fff;
  background: #4f46e5;
}
.link-button--primary:hover {
  background: #4338ca;
}
.inline-error {
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
}
.market-body {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.stage-filter {
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}
.filter-label {
  margin: 5px 10px 9px;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.stage-option {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  color: #64748b;
  background: transparent;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.stage-option:hover,
.stage-option.is-selected {
  color: #4f46e5;
  background: #eef2ff;
}
@media (max-width: 720px) {
  .market-body {
    grid-template-columns: 1fr;
  }
  .stage-filter {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }
  .filter-label {
    display: none;
  }
  .stage-option {
    width: auto;
    white-space: nowrap;
  }
}
.skill-card__badges {
  display: flex;
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
