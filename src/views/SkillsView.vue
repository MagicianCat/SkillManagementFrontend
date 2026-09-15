<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getSkills, openDraft } from '../api/skills.api'
import { useAuthStore } from '../stores/auth'
import { hasPermission } from '../types/permissions'
import {
  developmentStageLabel,
  type DevelopmentStage,
  type PageResponse,
  type SkillView,
} from '../types/skill'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const keywordInput = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : '',
)
const response = ref<PageResponse<SkillView> | null>(null)
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
const selectedStages = computed(() => new Set(selectedStage.value.split(',').filter(Boolean)))
const page = computed(() => Number(route.query.page || 0))
const selectedPlatform = computed(() => typeof route.query.platform === 'string' ? route.query.platform : '')
const selectedOsType = computed(() => typeof route.query.osType === 'string' ? route.query.osType : '')

const stageFilterTree: Array<{
  id: string
  label: string
  values: DevelopmentStage[]
  parallel?: boolean
  children?: Array<{ id: string; label: string; values: DevelopmentStage[] }>
}> = [
  { id: 'requirements', label: '需求', values: ['REQUIREMENT'] },
  { id: 'product', label: '产品', values: ['PRODUCT'] },
  {
    id: 'design', label: '设计阶段', values: ['ARCHITECTURE_DESIGN', 'UI_DESIGN'], parallel: true,
    children: [
      { id: 'architecture', label: '架构设计', values: ['ARCHITECTURE_DESIGN'] },
      { id: 'ui', label: 'UI 设计', values: ['UI_DESIGN'] },
    ],
  },
  {
    id: 'coding', label: '编码阶段', values: ['FRONTEND_CODING', 'BACKEND_CODING'], parallel: true,
    children: [
      { id: 'frontend', label: '前端编码', values: ['FRONTEND_CODING'] },
      { id: 'backend', label: '后端编码', values: ['BACKEND_CODING'] },
    ],
  },
  { id: 'security', label: '安全审核', values: ['SECURITY_REVIEW'] },
  { id: 'testing', label: '测试', values: ['TESTING'] },
  { id: 'deployment', label: '部署', values: ['DEPLOYMENT'] },
]

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
      status: 'ACTIVE',
      platform: selectedPlatform.value || undefined,
      osType: selectedOsType.value || undefined,
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

function selectStage(values: DevelopmentStage[]) {
  const next = new Set(selectedStages.value)
  const hasAll = values.every((value) => next.has(value))
  values.forEach((value) => (hasAll ? next.delete(value) : next.add(value)))
  updateQuery({
    developmentStage: [...next].join(',') || undefined,
  })
}

function isStageSelected(values: DevelopmentStage[]) {
  return values.every((value) => selectedStages.value.has(value))
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
  void router.push({ name: 'skill-detail', params: { skillKey }, query: { ...route.query } })
}

function skillStage(skill: SkillView): DevelopmentStage | null {
  return skill.category?.stage ?? skill.developmentStage
}

function skillStageClass(skill: SkillView): string {
  const stage = skillStage(skill)
  return stage ? `stage-${stage.toLowerCase()}` : ''
}

function handleSkillCardKeydown(event: KeyboardEvent, skillKey: string) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openSkill(skillKey)
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
      <label class="category-filter"><span>平台</span><select :value="selectedPlatform" @change="updateQuery({ platform: (($event.target as HTMLSelectElement).value || undefined) })"><option value="">默认平台</option><option value="CODEBUDDY">CodeBuddy</option><option value="OPENCODE">OpenCode</option></select></label>
      <label class="category-filter"><span>系统</span><select :value="selectedOsType" @change="updateQuery({ osType: (($event.target as HTMLSelectElement).value || undefined) })"><option value="">默认系统</option><option value="ANY">通用</option><option value="WINDOWS">Windows</option><option value="MACOS">macOS</option><option value="LINUX">Linux</option></select></label>
      <span v-if="response" class="result-count"
        >共 {{ response.totalElements }} 个 Skill</span
      >
    </section>
    <div class="market-body">
      <aside class="stage-filter" aria-label="开发阶段筛选">
        <p class="filter-label">开发阶段</p>
        <t-button class="stage-option" variant="text" :class="{ 'is-selected': !selectedStage }" @click="updateQuery({ developmentStage: undefined })">
          全部
        </t-button>
        <div v-for="node in stageFilterTree" :key="node.id" class="stage-tree-node">
          <t-button class="stage-option" variant="text" :class="{ 'is-selected': isStageSelected(node.values) }" @click="selectStage(node.values)">
            <span class="stage-option__marker">{{ isStageSelected(node.values) ? '✓' : '○' }}</span>{{ node.label }}<small v-if="node.parallel">并行</small>
          </t-button>
          <div v-if="node.children" class="stage-tree-children">
            <t-button v-for="child in node.children" :key="child.id" class="stage-option stage-option--child" variant="text" :class="{ 'is-selected': isStageSelected(child.values) }" @click="selectStage(child.values)">
              <span class="stage-option__marker">{{ isStageSelected(child.values) ? '✓' : '○' }}</span>{{ child.label }}
            </t-button>
          </div>
        </div>
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
            role="link"
            tabindex="0"
            @click="openSkill(skill.skillKey)"
            @keydown="handleSkillCardKeydown($event, skill.skillKey)"
          >
            <div class="skill-card__top">
              <div class="skill-icon">□</div>
              <div class="skill-card__badges">
                <span
                  v-if="skillStage(skill)"
                  class="status-badge"
                  :class="skillStageClass(skill)"
                  >{{ developmentStageLabel(skillStage(skill)) }}</span
                >
              </div>
            </div>
            <button
              class="skill-card__title"
              @click.stop="openSkill(skill.skillKey)"
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
                <button class="link-button" @click.stop="openSkill(skill.skillKey)">
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
  background: #e86600;
}
.btn-primary:hover:not(:disabled) {
  background: #c25400;
}
.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn-secondary {
  border: 1px solid #dfcfb8;
  color: #475569;
  background: #fff;
}
.btn-secondary:hover:not(:disabled) {
  background: #fbf6f0;
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
  border: 1px solid #ece1d2;
  border-radius: 7px;
  color: #334155;
  background: #fff;
  font: inherit;
  outline: none;
}
.category-filter select:focus {
  border-color: #ff9a3d;
  box-shadow: 0 0 0 2px rgb(232 102 0 / 20%);
}
.skill-card__actions {
  display: flex;
  gap: 10px;
}
.link-button--primary {
  padding: 5px 12px;
  border-radius: 6px;
  color: #fff;
  background: #e86600;
}
.link-button--primary:hover {
  background: #c25400;
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
  border: 1px solid #ece1d2;
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
  color: #e86600;
  background: #fff1e0;
}
.stage-tree-node + .stage-tree-node {
  margin-top: 3px;
}
.stage-tree-children {
  margin: 2px 0 5px 15px;
  padding-left: 8px;
  border-left: 1px solid #ffe0c2;
}
.stage-option--child {
  padding-top: 6px;
  padding-bottom: 6px;
  color: #7a6a58;
  font-size: 11px;
}
.stage-option__marker {
  display: inline-block;
  width: 18px;
  color: #e86600;
  font-size: 12px;
  font-weight: 700;
}
.stage-option small {
  margin-left: auto;
  color: #b34a00;
  font-size: 9px;
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
  color: #0f766e;
  background: #ccfbf1;
}
.stage-product {
  color: #c2410c;
  background: #ffedd5;
}
.stage-architecture_design {
  color: #6d28d9;
  background: #ede9fe;
}
.stage-ui_design {
  color: #be185d;
  background: #fce7f3;
}
.stage-design {
  color: #6d28d9;
  background: #ede9fe;
}
.stage-frontend_coding {
  color: #1d4ed8;
  background: #dbeafe;
}
.stage-backend_coding {
  color: #4338ca;
  background: #e0e7ff;
}
.stage-testing {
  color: #a16207;
  background: #fef3c7;
}
.stage-security_review {
  color: #b91c1c;
  background: #fee2e2;
}
.stage-deployment {
  color: #15803d;
  background: #dcfce7;
}
</style>
