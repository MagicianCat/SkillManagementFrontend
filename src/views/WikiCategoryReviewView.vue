<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorInfo } from '../api/http'
import { searchWikiTeams } from '../api/wiki.api'
import {
  getWikiCategoryBatch, getWikiCategoryItems, getWikiCategoryMetrics,
  listWikiCategoryBatches, reviewWikiCategory, reviewWikiCategories,
  retryWikiCategoryBatch, cancelWikiCategoryBatch,
} from '../api/wiki-category-batch.api'
import type { ReviewCommand, WikiCategoryBatch, WikiCategoryItem, WikiCategoryItemsPage } from '../api/wiki-category-batch.api'
import type { WikiKnowledgeCategory, WikiTeam } from '../types/skill'
import ReviewTypeTabs from '../components/ReviewTypeTabs.vue'

const route = useRoute()
const router = useRouter()
const batchId = computed(() => Number(route.query.batchId) || null)
const batches = ref<WikiCategoryBatch[]>([])
const batch = ref<WikiCategoryBatch | null>(null)
const page = ref<WikiCategoryItemsPage | null>(null)
const pageNumber = ref(0)
const statusFilter = ref('SUGGESTED')
const selected = ref<Set<number>>(new Set())
const finalCategories = ref<Record<number, WikiKnowledgeCategory>>({})
const teams = ref<WikiTeam[]>([])
const metrics = ref<{ reviewed: number; matched: number; accuracy: number } | null>(null)
const loading = ref(false)
const acting = ref(false)
const error = ref('')
const notice = ref('')
const actionItem = ref<WikiCategoryItem | null>(null)
const actionKind = ref<ReviewCommand['reviewAction']>('ACCEPT')
const showAction = ref(false)
const showBatch = ref(false)
const showCancel = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const categories: Array<{ value: WikiKnowledgeCategory; label: string }> = [
  { value: 'SKILL_TOOL', label: 'Skill 与工具' },
  { value: 'PROJECT_CONTEXT', label: '项目上下文' },
  { value: 'INTERNAL_KNOWLEDGE', label: '企业内部知识' },
  { value: 'FDE_WIKI', label: 'FDE 专区' },
  { value: 'OTHER', label: '其他' },
]
const statusOptions = [
  { label: '待审核', value: 'SUGGESTED' },
  { label: '已采纳', value: 'CONFIRMED_AI' },
  { label: '已改选', value: 'MANUAL_CORRECTED' },
  { label: '确认其他', value: 'CONFIRMED_OTHER' },
  { label: '失败', value: 'FAILED' },
  { label: '失效', value: 'STALE' },
  { label: '全部', value: '' },
]
const batchOptions = computed(() => batches.value.map(item => ({ label: `批次 #${item.id} · ${batchStatusLabel(item.status)}`, value: item.id })))
const pendingItems = computed(() => page.value?.items.filter(item => canBatchSelect(item)) ?? [])
const allSelected = computed(() => pendingItems.value.length > 0 && pendingItems.value.every(item => selected.value.has(item.id)))
const selectedItems = computed(() => pendingItems.value.filter(item => selected.value.has(item.id)))
const teamNames = computed(() => new Map(teams.value.map(team => [team.id, team.name])))
function categoryLabel(value: WikiKnowledgeCategory | null) { return categories.find(item => item.value === value)?.label ?? '—' }
function batchStatusLabel(value: string) { return ({ PENDING: '待启动', RUNNING: '分析中', READY_FOR_REVIEW: '待审核', PARTIAL_FAILED: '部分失败', REVIEW_COMPLETED: '审核完成', FAILED: '失败', CANCELLED: '已停止' } as Record<string, string>)[value] ?? value }
function itemStatusLabel(value: string) { return ({ PENDING: '待分析', PROCESSING: '分析中', SUGGESTED: '待审核', CONFIRMED_AI: '已采纳', MANUAL_CORRECTED: '已改选', CONFIRMED_OTHER: '确认其他', FAILED: '分析失败', STALE: '已失效', SKIPPED: '已跳过' } as Record<string, string>)[value] ?? value }
function itemStatusTheme(value: string) { return value === 'SUGGESTED' ? 'warning' : ['CONFIRMED_AI', 'MANUAL_CORRECTED', 'CONFIRMED_OTHER'].includes(value) ? 'success' : ['FAILED', 'STALE'].includes(value) ? 'danger' : 'default' }
function canBatchSelect(item: WikiCategoryItem) { return item.status === 'SUGGESTED' && Boolean(item.suggested_category && item.suggested_category !== 'OTHER') }
function teamLabel(teamId: number | null) { return teamId == null ? '平台直接文档' : teamNames.value.get(teamId) ?? `团队 #${teamId}` }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }

async function load() {
  loading.value = true
  error.value = ''
  try {
    batches.value = await listWikiCategoryBatches()
    if (!batchId.value && batches.value.length) {
      await router.replace({ name: 'wiki-category-review', query: { batchId: String(batches.value[0]!.id) } })
      return
    }
    if (!batchId.value) { batch.value = null; page.value = null; metrics.value = null; return }
    const [current, items, stats] = await Promise.all([
      getWikiCategoryBatch(batchId.value),
      getWikiCategoryItems(batchId.value, { status: statusFilter.value || undefined, page: pageNumber.value, size: 20 }),
      getWikiCategoryMetrics(batchId.value),
    ])
    batch.value = current
    page.value = items
    metrics.value = stats
    for (const item of items.items) if (!finalCategories.value[item.id]) finalCategories.value[item.id] = item.suggested_category ?? 'OTHER'
  } catch (failure) { error.value = apiErrorInfo(failure).message }
  finally { loading.value = false }
}
function command(item: WikiCategoryItem, action: ReviewCommand['reviewAction']): ReviewCommand {
  return {
    itemId: item.id, expectedWikiVersionNo: item.source_version_no,
    inputFingerprint: item.input_fingerprint, reviewAction: action,
    finalCategory: action === 'KEEP_OTHER' ? 'OTHER' : action === 'OVERRIDE'
      ? finalCategories.value[item.id]! : item.suggested_category!,
  }
}
function changeStatus(value: string) { statusFilter.value = value; pageNumber.value = 0; selected.value = new Set(); void load() }
function changeBatch(value: string | number) { void router.push({ name: 'wiki-category-review', query: { batchId: String(value) } }) }
function toggle(id: number) { const next = new Set(selected.value); if (next.has(id)) next.delete(id); else next.add(id); selected.value = next }
function toggleAll() { selected.value = allSelected.value ? new Set() : new Set(pendingItems.value.map(item => item.id)) }
function openAction(item: WikiCategoryItem, kind: ReviewCommand['reviewAction']) { actionItem.value = item; actionKind.value = kind; showAction.value = true }
function actionTitle() { return actionKind.value === 'ACCEPT' ? '采纳 AI 分类建议' : actionKind.value === 'KEEP_OTHER' ? '确认保留“其他”' : '确认改选知识分类' }
function actionCategory() { if (!actionItem.value) return '—'; return categoryLabel(command(actionItem.value, actionKind.value).finalCategory) }
async function confirmAction() {
  if (!actionItem.value || acting.value) return
  acting.value = true; error.value = ''; notice.value = ''
  try { await reviewWikiCategory(command(actionItem.value, actionKind.value)); showAction.value = false; notice.value = '分类审核已保存'; await load() }
  catch (failure) { error.value = apiErrorInfo(failure).message }
  finally { acting.value = false }
}
async function confirmBatch() {
  if (!batchId.value || !selectedItems.value.length || acting.value) return
  acting.value = true; error.value = ''; notice.value = ''
  try {
    const results = await reviewWikiCategories(batchId.value, selectedItems.value.map(item => command(item, 'ACCEPT')))
    const failed = results.filter(item => item.status === 'FAILED')
    notice.value = `已采纳 ${results.length - failed.length} 篇，失败 ${failed.length} 篇${failed.length ? '；请刷新后逐项检查失败原因' : ''}`
    showBatch.value = false; selected.value = new Set(); await load()
  } catch (failure) { error.value = apiErrorInfo(failure).message }
  finally { acting.value = false }
}
async function retry() { if (!batchId.value || acting.value) return; acting.value = true; error.value = ''; try { await retryWikiCategoryBatch(batchId.value); notice.value = '已提交失败项重试'; await load() } catch (failure) { error.value = apiErrorInfo(failure).message } finally { acting.value = false } }
async function confirmCancel() { if (!batchId.value || acting.value) return; acting.value = true; error.value = ''; try { await cancelWikiCategoryBatch(batchId.value); showCancel.value = false; notice.value = '已停止领取新任务'; await load() } catch (failure) { error.value = apiErrorInfo(failure).message } finally { acting.value = false } }
function changePage(value: number) { pageNumber.value = value - 1; selected.value = new Set(); void load() }
watch(batchId, () => { pageNumber.value = 0; selected.value = new Set(); void load() })
onMounted(() => { void searchWikiTeams('', 0, 50).then(result => { teams.value = result.items }).catch(() => {}); void load(); timer = setInterval(() => { if (batch.value?.status === 'RUNNING' && !loading.value) void load() }, 5000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="market-page category-review-page">
    <div class="page-heading">
      <div><p class="eyebrow">REVIEW · WIKI CATEGORY</p><h1>审核中心</h1><p class="page-subtitle">核对历史 Wiki 的 AI 分类建议，人工确认后更新当前分类</p></div>
      <t-button variant="outline" @click="router.push({ name: 'wiki' })">返回团队 Wiki</t-button>
    </div>
    <ReviewTypeTabs active="category" />

    <section class="market-toolbar batch-toolbar" aria-label="分类批次">
      <t-select :value="batchId" class="batch-select" placeholder="选择分类批次" :options="batchOptions" @change="changeBatch" />
      <t-button variant="outline" :loading="loading" @click="load">刷新</t-button>
      <t-button v-if="batch?.status === 'RUNNING'" variant="outline" theme="danger" :disabled="acting" @click="showCancel = true">停止任务</t-button>
      <t-button v-if="batch && ['PARTIAL_FAILED', 'READY_FOR_REVIEW'].includes(batch.status) && batch.failed_count + batch.skipped_count > 0" variant="outline" :loading="acting" @click="retry">重试失败项</t-button>
    </section>

    <t-alert v-if="error" theme="error" :message="error" close-btn @close="error = ''" />
    <t-alert v-if="notice" theme="success" :message="notice" close-btn @close="notice = ''" />
    <t-empty v-if="!batches.length && !loading" description="暂无分类批次，请从团队 Wiki 发起批量 AI 分类" />

    <t-alert v-if="batch?.prompt_version && batch.prompt_version !== 'wiki-category-v4'" theme="warning" message="此批次使用旧版分类规则，分类建议可能与当前规则不同。建议从团队 Wiki 重新发起批量 AI 分类，再审核新批次；旧结果仍保留供对照。" class="old-prompt-notice" />

    <t-card v-if="batch" :bordered="true" class="batch-summary">
      <div class="summary-heading"><div><strong>批次 #{{ batch.id }}</strong><span>{{ batch.prompt_version }} · 创建于 {{ formatTime(batch.created_at) }}</span></div><t-tag :theme="batch.status === 'REVIEW_COMPLETED' ? 'success' : batch.status === 'PARTIAL_FAILED' ? 'danger' : 'warning'" variant="light">{{ batchStatusLabel(batch.status) }}</t-tag></div>
      <div class="summary-grid"><div><strong>{{ batch.candidate_count }}</strong><span>候选文档</span></div><div><strong>{{ batch.succeeded_count }}</strong><span>AI 建议</span></div><div><strong>{{ batch.failed_count }}</strong><span>分析失败</span></div><div><strong>{{ batch.skipped_count }}</strong><span>已失效</span></div><div><strong>{{ batch.reviewed_count }}</strong><span>已审核</span></div></div>
      <p v-if="metrics" class="metrics-note">本批已审核模型样本中，AI 建议与人工分类一致 {{ metrics.matched }}/{{ metrics.reviewed }}（{{ metrics.reviewed ? `${(metrics.accuracy * 100).toFixed(1)}%` : '暂无数据' }}）。规则建议不计入模型准确率；模型概率仅供参考。</p>
    </t-card>

    <template v-if="batch">
      <section class="market-toolbar item-toolbar" aria-label="分类建议筛选">
        <div class="status-tabs" role="tablist" aria-label="处理状态">
          <button v-for="option in statusOptions" :key="option.value" type="button" role="tab" class="status-tab" :class="{ 'is-selected': statusFilter === option.value }" :aria-selected="statusFilter === option.value" @click="changeStatus(option.value)">{{ option.label }}</button>
        </div>
        <span v-if="page" class="result-count">共 {{ page.totalElements }} 篇</span>
      </section>
      <t-card v-if="selected.size" :bordered="true" class="batch-bar">
        <span>已选 {{ selected.size }} 篇</span><t-space><t-button theme="primary" size="small" @click="showBatch = true">批量采纳建议</t-button><t-button variant="outline" size="small" @click="selected = new Set()">清空</t-button></t-space>
      </t-card>
      <t-loading :loading="loading" text="正在加载分类建议…" class="review-loading">
        <t-empty v-if="!page?.items.length" :description="batch.status === 'RUNNING' && statusFilter === 'SUGGESTED' ? 'AI 正在分析文档，建议生成后会显示在这里' : '没有匹配的分类任务'" />
        <template v-else>
          <t-card v-if="pendingItems.length" :bordered="true" class="select-all-card"><t-checkbox :checked="allSelected" @change="toggleAll">全选本页可批量采纳的建议（{{ pendingItems.length }} 篇）</t-checkbox></t-card>
          <div class="review-list">
            <t-card v-for="item in page.items" :key="item.id" :bordered="true" class="review-item-card">
              <div class="review-item-check"><t-checkbox v-if="canBatchSelect(item)" :checked="selected.has(item.id)" :aria-label="`选择${item.title}`" @change="toggle(item.id)" /></div>
              <div class="review-item-main">
                <div class="review-item-title-row"><t-link theme="primary" hover="color" @click="router.push({ name: 'wiki', query: { documentId: String(item.wiki_document_id) } })">{{ item.title }}</t-link><t-tag :theme="itemStatusTheme(item.status)" variant="light">{{ itemStatusLabel(item.status) }}</t-tag></div>
                <p class="review-item-meta">{{ teamLabel(item.team_id) }} · Wiki #{{ item.wiki_document_id }} · 当前分类：{{ categoryLabel(item.current_category) }}<template v-if="item.platform_category"> · 平台公开版：{{ categoryLabel(item.platform_category) }}</template></p>
                <p v-if="item.suggested_category" class="recommendation">{{ item.model_key === 'rule:asdm' ? 'ASDM 规则建议' : 'AI 建议' }} <strong>{{ categoryLabel(item.suggested_category) }}</strong><span v-if="item.selected_probability != null"> · 模型概率 {{ Math.round(item.selected_probability * 100) }}%</span></p>
                <p v-if="item.error_code" class="review-item-meta">错误码：{{ item.error_code }}</p>
                <p v-if="item.review_category" class="review-item-meta">人工确认：{{ categoryLabel(item.review_category) }}</p>
                <div v-if="item.status === 'SUGGESTED'" class="review-actions"><t-button size="small" theme="primary" :disabled="acting || !item.suggested_category || item.suggested_category === 'OTHER'" @click="openAction(item, 'ACCEPT')">采纳建议</t-button><t-select v-model="finalCategories[item.id]" size="small" class="category-select" :options="categories" placeholder="选择分类" /><t-button size="small" variant="outline" :disabled="acting || !finalCategories[item.id] || finalCategories[item.id] === item.suggested_category || finalCategories[item.id] === 'OTHER'" @click="openAction(item, 'OVERRIDE')">确认改选</t-button><t-button size="small" variant="outline" :disabled="acting" @click="openAction(item, 'KEEP_OTHER')">确认保留其他</t-button></div>
              </div>
              <t-button class="detail-button" variant="outline" size="small" @click="router.push({ name: 'wiki', query: { documentId: String(item.wiki_document_id) } })">查看原文</t-button>
            </t-card>
          </div>
        </template>
      </t-loading>
      <t-pagination v-if="page && page.totalPages > 1" :current="pageNumber + 1" :total="page.totalElements" :page-size="20" :total-content="false" show-jumper @current-change="changePage" />
    </template>

    <t-dialog v-model:visible="showAction" :header="actionTitle()" :confirm-btn="{ content: '确认分类', loading: acting }" cancel-btn="取消" @confirm="confirmAction"><p>《{{ actionItem?.title }}》将分类为<strong>{{ actionCategory() }}</strong>。确认后更新 Wiki 当前分类；团队 Wiki 的平台公开版仍按原有推广审核流程更新。</p></t-dialog>
    <t-dialog v-model:visible="showBatch" header="批量采纳 AI 建议" :confirm-btn="{ content: '确认采纳', loading: acting, disabled: !selectedItems.length }" cancel-btn="取消" @confirm="confirmBatch"><p>将处理本页选中的 <strong>{{ selectedItems.length }}</strong> 篇 Wiki。请确认已核对这些文档的分类建议。</p></t-dialog>
    <t-dialog v-model:visible="showCancel" header="停止批量分类" :confirm-btn="{ content: '停止任务', theme: 'danger', loading: acting }" cancel-btn="继续运行" @confirm="confirmCancel"><p>停止领取新的分析任务；已经生成的建议仍可继续审核。</p></t-dialog>
  </div>
</template>

<style scoped>
.category-review-page :deep(.t-alert){margin-bottom:16px}.batch-toolbar{gap:12px}.batch-select{width:min(360px,100%)}.batch-summary{margin-bottom:18px}.summary-heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.summary-heading>div{display:flex;align-items:baseline;gap:12px}.summary-heading strong{font-size:18px}.summary-heading span,.metrics-note{color:var(--text-2);font-size:12px}.summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:20px 0 8px}.summary-grid>div{display:flex;flex-direction:column;gap:4px;padding:14px;border:1px solid var(--border-1);border-radius:var(--radius-sm);background:var(--surface-2)}.summary-grid strong{font-size:23px;color:var(--text-1)}.summary-grid span{font-size:12px;color:var(--text-2)}.metrics-note{margin:12px 0 0}.item-toolbar{justify-content:space-between}.result-count{color:var(--text-2);white-space:nowrap}.batch-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.review-loading{min-height:180px}.select-all-card{margin-bottom:12px}.review-list{display:grid;gap:12px}.review-item-card :deep(.t-card__body){display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:12px}.review-item-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.review-item-meta{margin:8px 0;color:var(--text-2);font-size:12px}.recommendation{margin:10px 0;color:var(--text-1);font-size:13px}.recommendation strong{color:var(--accent-300)}.review-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}.category-select{width:190px}.detail-button{white-space:nowrap}@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.review-item-card :deep(.t-card__body){grid-template-columns:auto minmax(0,1fr)}.detail-button{grid-column:2}.batch-toolbar{flex-wrap:wrap}.item-toolbar{align-items:flex-start}}
</style>
