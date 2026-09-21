<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getSkillDetail,
  listGenerations,
  type GenerationPage,
  type SkillDetail,
} from '../api/skill-usage.api'
import {
  formatDuration,
  formatNumber,
  formatTime,
  formatTokens,
  stageLabel,
  useEfficiencyCharts,
  useEfficiencyPage,
} from '../components/skill-usage/efficiency-shared'

const route = useRoute()
const router = useRouter()
const skillKey = String(route.params.skillKey ?? '')
const detail = ref<SkillDetail | null>(null)
const generations = ref<GenerationPage | null>(null)
const page = ref(1)
const { preset, fromDate, toDate, loading, errorMessage, applyPreset, filters, errorText } = useEfficiencyPage()
const charts = useEfficiencyCharts()

const trendRef = ref<HTMLElement | null>(null)
const teamRef = ref<HTMLElement | null>(null)
const projectRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const fileTypeRef = ref<HTMLElement | null>(null)

function render() {
  const d = detail.value
  if (!d) return
  charts.mountReactive(trendRef.value, () => charts.trendLine(d.trend.map((i) => i.bucket), d.trend.map((i) => i.generations), 'Generation数'))
  const tm = d.teamRanking.slice(0, 8)
  charts.mountReactive(teamRef.value, () => charts.horizontalBar(tm.map((i) => i.name).reverse(), tm.map((i) => i.generations).reverse()))
  const pj = d.projectRanking.slice(0, 8)
  charts.mountReactive(projectRef.value, () => charts.horizontalBar(pj.map((i) => i.name).reverse(), pj.map((i) => i.generations).reverse(), '#60a5fa'))
  const sd = d.stageDistribution.slice(0, 8)
  charts.mountReactive(stageRef.value, () => charts.donut(sd.map((i) => ({ name: stageLabel(i.key), value: i.generations }))))
  const ft = d.fileTypes.slice(0, 8)
  charts.mountReactive(fileTypeRef.value, () => charts.horizontalBar(ft.map((i) => i.category).reverse(), ft.map((i) => i.linesAdded).reverse(), '#34d399'))
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const f = filters()
    const [d, g] = await Promise.all([getSkillDetail(skillKey, f), listGenerations(f, page.value - 1, 20)])
    detail.value = d
    generations.value = g
    await nextTick()
    render()
  } catch (error) {
    errorMessage.value = errorText(error, 'Skill 效果数据加载失败')
  } finally { loading.value = false }
}

function search() { page.value = 1; void load() }
function changePage(next: number) { page.value = next; void load() }
function goTeam(teamId: number) { void router.push({ name: 'skill-usage-team', params: { teamId } }) }
function goProject(projectKey: string | null) { if (projectKey) void router.push({ name: 'skill-usage-project', params: { projectKey } }) }
function goSkill(key: string) { if (key !== skillKey) void router.push({ name: 'skill-usage-skill', params: { skillKey: key } }) }
function back() { void router.push({ name: 'skill-usage-dashboard' }) }

function statusTheme(status: string) { return status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : status === 'RUNNING' ? 'warning' : 'default' }
function statusLabel(status: string) { return ({ COMPLETED: '已完成', FAILED: '失败', RUNNING: '进行中', CANCELLED: '已取消', PARTIAL: '部分完成' } as Record<string, string>)[status] ?? status }

watch(detail, async () => { await nextTick(); render() })
onMounted(() => { applyPreset('30d'); window.addEventListener('resize', charts.resize); void load() })
onBeforeUnmount(() => { window.removeEventListener('resize', charts.resize); charts.dispose() })
</script>

<template>
  <main class="usage-page">
    <header class="usage-heading">
      <div>
        <button class="back-link" @click="back">← 返回看板</button>
        <p class="eyebrow">SKILL EFFICIENCY</p>
        <h1>{{ skillKey }}</h1>
        <p>Skill 效果详情：Generation 影响数、项目覆盖、关联代码量与 Token。</p>
      </div>
    </header>

    <p v-if="errorMessage" class="usage-alert" role="alert">{{ errorMessage }}</p>
    <section class="usage-filters">
      <div class="preset-group"><button v-for="item in [{ key: 'today', label: '今天' }, { key: '7d', label: '近 7 天' }, { key: '30d', label: '近 30 天' }, { key: '90d', label: '近 90 天' }]" :key="item.key" :class="{ active: preset === item.key }" @click="applyPreset(item.key); search()">{{ item.label }}</button></div>
      <label>开始日期<input v-model="fromDate" type="date" @change="preset = 'custom'" /></label>
      <label>结束日期<input v-model="toDate" type="date" @change="preset = 'custom'" /></label>
      <t-button theme="primary" :loading="loading" @click="search">查询</t-button>
    </section>

    <template v-if="detail">
      <section class="summary-grid">
        <article><span>调用次数</span><strong>{{ formatNumber(detail.summary.invocations) }}</strong><small>次</small></article>
        <article><span>Generation影响数</span><strong>{{ formatNumber(detail.summary.generations) }}</strong><small>轮</small></article>
        <article><span>使用人数</span><strong>{{ detail.summary.users }}</strong><small>人</small></article>
        <article><span>项目覆盖</span><strong>{{ detail.summary.projects }}</strong><small>个项目</small></article>
        <article><span>关联AI代码量</span><strong>{{ formatNumber(detail.summary.linesAdded) }}</strong><small>行</small></article>
        <article><span>关联Token</span><strong>{{ formatTokens(detail.summary.totalTokens) }}</strong><small>不可跨 Skill 求和</small></article>
      </section>

      <section class="usage-card"><div class="card-heading"><div><h2>Generation 影响趋势</h2></div></div><div ref="trendRef" class="chart-box chart-tall"></div></section>

      <section class="dashboard-grid">
        <article class="usage-card"><div class="card-heading"><div><h2>团队分布</h2></div></div><div ref="teamRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="t in detail.teamRanking.slice(0, 5)" :key="t.key" @click="goTeam(Number(t.key))"><span>{{ t.name }}</span><em>{{ t.generations }} 轮</em></li></ul>
        </article>
        <article class="usage-card"><div class="card-heading"><div><h2>项目分布</h2></div></div><div ref="projectRef" class="chart-box"></div>
          <ul class="rank-list"><li v-for="p in detail.projectRanking.slice(0, 5)" :key="p.key" @click="goProject(p.key)"><span>{{ p.name }}</span><em>{{ p.generations }} 轮</em></li></ul>
        </article>
        <article class="usage-card"><div class="card-heading"><div><h2>研发阶段分布</h2></div></div><div ref="stageRef" class="chart-box"></div></article>
        <article class="usage-card"><div class="card-heading"><div><h2>文件类型</h2></div></div><div ref="fileTypeRef" class="chart-box"></div></article>
      </section>

      <section class="usage-card">
        <div class="card-heading"><div><h2>Skill 组合关系</h2><p>与本 Skill 在同一 Generation 中共现的其它 Skill</p></div></div>
        <div v-if="detail.skillCombos.length" class="combo-list">
          <span v-for="c in detail.skillCombos" :key="c.skillKey" class="combo-chip" @click="goSkill(c.skillKey)">{{ c.displayName || c.skillKey }}<em>{{ c.coGenerations }} 轮</em></span>
        </div>
        <p v-else class="empty-state">当前范围内无组合使用</p>
      </section>
    </template>

    <section class="usage-card events-card">
      <div class="card-heading"><div><h2>Generation 明细</h2></div><span v-if="generations">共 {{ generations.totalElements }} 条</span></div>
      <t-table row-key="id" :data="generations?.items ?? []" :loading="loading" :columns="[
        { colKey: 'startedAt', title: '时间', width: 160 }, { colKey: 'member', title: '成员', width: 140 },
        { colKey: 'project', title: '项目', width: 140 }, { colKey: 'stage', title: '研发阶段', width: 120 },
        { colKey: 'lines', title: '代码增量', width: 110 }, { colKey: 'tokens', title: 'Token', width: 110 },
        { colKey: 'duration', title: '耗时', width: 100 }, { colKey: 'status', title: '状态', width: 100 },
      ]" bordered stripe>
        <template #startedAt="{ row }">{{ formatTime(row.startedAt) }}</template>
        <template #member="{ row }"><strong>{{ row.displayName }}</strong><small class="cell-subtitle">{{ row.teamNames || '-' }}</small></template>
        <template #project="{ row }"><a class="cell-link" @click="goProject(row.projectKey)">{{ row.projectName || '-' }}</a></template>
        <template #stage="{ row }">{{ stageLabel(row.primaryStage) }}</template>
        <template #lines="{ row }"><span class="lines-added">+{{ row.linesAdded }}</span> <span class="lines-deleted">-{{ row.linesDeleted }}</span></template>
        <template #tokens="{ row }">{{ formatTokens(row.totalTokens) }}</template>
        <template #duration="{ row }">{{ formatDuration(row.durationMs) }}</template>
        <template #status="{ row }"><t-tag :theme="statusTheme(row.status)">{{ statusLabel(row.status) }}</t-tag></template>
      </t-table>
      <t-pagination v-if="generations && generations.totalElements" :current="page" :total="generations.totalElements" :page-size="20" :total-content="false" show-jumper @change="changePage" />
    </section>
  </main>
</template>

<style scoped>
.usage-page{width:min(100%,1360px);margin:0 auto;color:var(--text-1)}
.usage-heading{margin-bottom:14px}
.usage-heading h1{margin:5px 0 8px;font-size:28px;color:var(--text-1);letter-spacing:-0.03em}
.usage-heading p:not(.eyebrow){margin:0;color:var(--text-2);font-size:13px}
.back-link{border:0;background:transparent;color:var(--accent-300);font-size:12px;cursor:pointer;padding:0}
.usage-alert{margin:12px 0;padding:12px 14px;border:1px solid rgb(251 191 36 / 30%);border-radius:9px;color:var(--warning);background:var(--warning-soft)}
.usage-filters{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:13px;border:1px solid var(--border-1);border-radius:13px;background:var(--surface-1);box-shadow:var(--inner-highlight);backdrop-filter:blur(12px)}
.usage-filters label{display:grid;gap:4px;color:var(--text-2);font-size:11px}
.usage-filters input{height:32px;padding:0 8px;border:1px solid var(--border-2);border-radius:6px;color:var(--text-1);background:var(--surface-1);font:inherit;font-size:12px}
.preset-group{display:flex;gap:4px}
.preset-group button{height:32px;padding:0 10px;border:1px solid var(--border-2);border-radius:6px;color:var(--text-2);background:var(--surface-1);font:inherit;font-size:12px;cursor:pointer}
.preset-group button.active{border-color:var(--border-accent);color:var(--accent-300);background:var(--accent-soft)}
.summary-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
.summary-grid article{display:grid;min-height:92px;gap:8px;padding:14px 16px;border:1px solid var(--border-1);border-radius:10px;background:var(--surface-1);box-shadow:var(--inner-highlight);backdrop-filter:blur(12px)}
.summary-grid span,.summary-grid small{color:var(--text-2);font-size:12px}
.summary-grid strong{color:var(--text-1);font-size:22px;letter-spacing:-.04em}
.summary-grid small{font-size:11px}
.usage-card{min-width:0;padding:16px;border:1px solid var(--border-1);border-radius:10px;background:var(--surface-1);box-shadow:var(--inner-highlight);backdrop-filter:blur(12px);margin-bottom:12px}
.card-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}
.card-heading h2{font-size:15px;margin:0;color:var(--text-1)}
.card-heading p{margin:4px 0 0;color:var(--text-3);font-size:11px}
.card-heading span{color:var(--text-3);font-size:11px}
.dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.chart-box{width:100%;height:220px}
.chart-tall{height:280px}
.rank-list{list-style:none;margin:8px 0 0;padding:8px 0 0;border-top:1px solid var(--border-1);display:grid;gap:2px}
.rank-list li{display:flex;justify-content:space-between;gap:8px;padding:5px 6px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--text-2)}
.rank-list li:hover{background:var(--surface-2);color:var(--text-1)}
.rank-list em{font-style:normal;color:var(--text-3);font-size:11px}
.combo-list{display:flex;flex-wrap:wrap;gap:8px}
.combo-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--border-1);border-radius:999px;background:var(--surface-2);color:var(--text-1);font-size:12px;cursor:pointer}
.combo-chip:hover{border-color:var(--border-accent);color:var(--accent-300)}
.combo-chip em{font-style:normal;color:var(--text-3);font-size:11px}
.empty-state{padding:24px 0;color:var(--text-3);font-size:12px;text-align:center}
.cell-subtitle{display:block;color:var(--text-3);font-size:11px}
.cell-link{color:var(--accent-300);cursor:pointer}
.lines-added{color:#34d399;font-weight:600}
.lines-deleted{color:#f87171;font-weight:600}
.events-card{margin-top:0}
@media(max-width:1100px){.summary-grid{grid-template-columns:repeat(3,1fr)}.dashboard-grid{grid-template-columns:1fr}}
@media(max-width:760px){.summary-grid{grid-template-columns:repeat(2,1fr)}}
</style>
