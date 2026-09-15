<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { getSkillCategories } from '../api/skills.api'
import SkillRecommendationCard from '../features/dev-pipeline/SkillRecommendationCard.vue'
import {
  allRecommendations,
  flowNodes,
  recommendationSections,
  type FlowNode,
  type RecommendationStep,
} from '../features/dev-pipeline/pipeline-content'
import type { SkillCategory } from '../types/skill'

const expandedFlowNodes = ref(new Set(['requirements']))
const expandedRecommendationSections = ref(new Set<string>())
const categories = ref<SkillCategory[]>([])
const categoryLoadError = ref(false)

const categoryByKey = computed(() => new Map(categories.value.map((category) => [category.key, category])))

const flowRows: Array<{ id: string; parallel: boolean; label?: string; nodes: FlowNode[] }> = [
  { id: 'requirements-row', parallel: false, nodes: [flowNodes[0]] },
  { id: 'product-row', parallel: false, nodes: [flowNodes[1]] },
  { id: 'design-row', parallel: true, label: '架构与 UI 设计并行', nodes: [flowNodes[2], flowNodes[3]] },
  { id: 'coding-row', parallel: true, label: '后端与前端编码并行', nodes: [flowNodes[4], flowNodes[5]] },
  { id: 'security-row', parallel: false, nodes: [flowNodes[6]] },
  { id: 'testing-row', parallel: false, nodes: [flowNodes[7]] },
  { id: 'deployment-row', parallel: false, nodes: [flowNodes[8]] },
]

const usedCategoryKeys = computed(() => new Set(flowNodes.flatMap((node) => node.categories.map((category) => category.key))))

const fallbackCategoryNames = computed(() => {
  const names = new Map<string, string>()
  flowNodes.forEach((node) => node.categories.forEach((category) => names.set(category.key, category.fallbackName)))
  return names
})

const totalVideoSlots = computed(() => allRecommendations.length)

const recommendationSubsections = computed(() => new Map(
  recommendationSections.map((section) => [
    section.id,
    section.subsections || [{
      id: `${section.id}-skills`,
      name: section.name,
      en: section.en,
      description: section.description,
      steps: section.steps || [],
    }],
  ]),
))

function categoryFor(key: string) {
  return categoryByKey.value.get(key)
}

function fallbackCategoryName(key: string) {
  return fallbackCategoryNames.value.get(key) || key
}

function recommendationSkillCount(steps: RecommendationStep[]) {
  return steps.reduce((total, item) => total + item.skills.length, 0)
}

function toggleFlowNode(nodeId: string) {
  const next = new Set(expandedFlowNodes.value)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  expandedFlowNodes.value = next
}

function isExpanded(nodeId: string) {
  return expandedFlowNodes.value.has(nodeId)
}

function isRecommendationExpanded(sectionId: string) {
  return expandedRecommendationSections.value.has(sectionId)
}

function toggleRecommendationSection(sectionId: string) {
  const next = new Set(expandedRecommendationSections.value)
  if (next.has(sectionId)) next.delete(sectionId)
  else next.add(sectionId)
  expandedRecommendationSections.value = next
}

function setAllRecommendationSections(expanded: boolean) {
  expandedRecommendationSections.value = expanded
    ? new Set(recommendationSections.map((section) => section.id))
    : new Set()
}

async function focusRecommendationSection(sectionId: string) {
  expandedRecommendationSections.value = new Set([...expandedRecommendationSections.value, sectionId])
  await nextTick()
  document.getElementById(`recommendation-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  try {
    const result = await getSkillCategories()
    categories.value = result.filter((category) => usedCategoryKeys.value.has(category.key))
  } catch {
    categoryLoadError.value = true
  }
})
</script>

<template>
  <main class="devpipeline-page">
    <header class="devpipeline-hero">
      <p class="devpipeline-eyebrow">TAIKANG · SDLC BEST PRACTICES</p>
      <h1>研发全链路最佳实践</h1>
      <p class="devpipeline-lead">
        以 SecondShelf 示例项目为主线，从需求、产品、架构与 UI，到编码、安全、测试和部署，
        用可追踪的 Skill 和真实交付物把研发流程串起来。
      </p>
      <div class="devpipeline-stats">
        <div class="stat"><strong>9</strong><span>研发阶段</span></div>
        <div class="stat"><strong>{{ totalVideoSlots }}</strong><span>推荐 Skill</span></div>
        <div class="stat"><strong>2</strong><span>并行设计支线</span></div>
      </div>
    </header>

    <section id="flow-tree" class="devpipeline-section" aria-labelledby="flow-tree-heading">
      <div class="devpipeline-section-head">
        <div>
          <p class="section-kicker">01 · PROCESS MAP</p>
          <h2 id="flow-tree-heading">全链路流程树</h2>
        </div>
      </div>

      <div class="flow-tree-card">
        <div v-if="categoryLoadError" class="category-sync-note" role="status">当前分类接口暂时不可用，已使用平台最近一次分类名称展示。</div>

        <div class="flow-tree" aria-label="研发全链路流程">
          <div v-for="(row, rowIndex) in flowRows" :key="row.id" class="flow-row-wrap" :class="{ 'flow-row-wrap--parallel': row.parallel }">
            <div v-if="row.label" class="flow-row-label">{{ row.label }}</div>
            <div class="flow-row" :class="{ 'flow-row--parallel': row.parallel }">
              <article v-for="node in row.nodes" :key="node.id" :class="['flow-node', `flow-node--${node.tone}`]">
                <button class="flow-node__button" type="button" :aria-expanded="isExpanded(node.id)" :aria-controls="`${node.id}-categories`" @click="toggleFlowNode(node.id)">
                  <span class="flow-node__no">{{ node.no }}</span>
                  <span class="flow-node__copy"><strong>{{ node.name }}</strong><small>{{ node.en }} · {{ node.phaseLabel }}</small></span>
                  <span class="flow-node__chevron" aria-hidden="true">⌄</span>
                </button>
                <p class="flow-node__description">{{ node.description }}</p>
                <div v-if="isExpanded(node.id)" :id="`${node.id}-categories`" class="flow-node__details">
                  <p class="flow-node__dependency">{{ node.dependency }}</p>
                  <div class="category-pills" aria-label="相关分类">
                    <span v-for="item in node.categories" :key="item.key" class="category-pill">{{ categoryFor(item.key)?.name || item.fallbackName }}</span>
                  </div>
                </div>
              </article>
            </div>
            <div v-if="rowIndex < flowRows.length - 1" class="flow-connector" aria-hidden="true"><span>↓</span></div>
          </div>
        </div>

        <p class="flow-note">发布后的监控、缺陷和 as-built 文档会回流到下一轮需求；小项只展示本次 36 个推荐 Skill 实际使用到的真实平台分类。</p>
      </div>
    </section>

    <section id="recommended-skills" class="devpipeline-section" aria-labelledby="recommended-heading">
      <div class="devpipeline-section-head">
        <div>
          <p class="section-kicker">02 · RECOMMENDED SKILLS</p>
          <h2 id="recommended-heading">研发全流程推荐 Skill</h2>
        </div>
      </div>

      <nav class="recommendation-nav" aria-label="快速定位研发阶段">
        <div class="recommendation-nav__actions">
          <button type="button" class="recommendation-nav__action" @click="setAllRecommendationSections(true)">全部展开</button>
          <button type="button" class="recommendation-nav__action" @click="setAllRecommendationSections(false)">全部收起</button>
        </div>
        <div class="recommendation-nav__stages">
          <button
            v-for="section in recommendationSections"
            :key="section.id"
            type="button"
            class="recommendation-nav__stage"
            @click="focusRecommendationSection(section.id)"
          >
            <span>{{ section.no }}</span>{{ section.name }}
          </button>
        </div>
      </nav>

      <div class="recommendation-sections">
        <article v-for="section in recommendationSections" :id="`recommendation-${section.id}`" :key="section.id" class="recommendation-section">
          <header class="recommendation-section__head">
            <button
              type="button"
              class="recommendation-section__toggle"
              :aria-expanded="isRecommendationExpanded(section.id)"
              :aria-controls="`recommendation-content-${section.id}`"
              @click="toggleRecommendationSection(section.id)"
            >
              <span class="recommendation-section__no">{{ section.no }}</span>
              <span class="recommendation-section__title"><strong>{{ section.name }}</strong><small>{{ section.en }}</small><span>{{ section.description }}</span></span>
              <span class="recommendation-section__chevron" aria-hidden="true">⌄</span>
            </button>
            <span class="recommendation-section__phase">{{ section.phaseLabel }}</span>
          </header>
          <div v-if="isRecommendationExpanded(section.id)" :id="`recommendation-content-${section.id}`" class="recommendation-section__content">
            <div class="deliverables">
              <span class="deliverables-label">示例交付物</span>
              <span v-for="item in section.deliverables" :key="item" class="deliverable-chip">{{ item }}</span>
            </div>
            <div class="recommendation-subsections">
              <section v-for="subsection in recommendationSubsections.get(section.id)" :key="subsection.id" class="recommendation-subsection">
                <header class="recommendation-subsection__head">
                  <div><h4>{{ subsection.name }} <small>{{ subsection.en }}</small></h4><p>{{ subsection.description }}</p></div>
                  <span>{{ recommendationSkillCount(subsection.steps) }} 个 Skill</span>
                </header>
                <div class="recommendation-steps">
                  <div v-for="item in subsection.steps" :key="item.id" class="recommendation-step">
                    <div class="recommendation-step__marker" aria-hidden="true">
                      <span class="recommendation-step__number">{{ item.no }}</span>
                      <span class="recommendation-step__line"></span>
                    </div>
                    <div class="recommendation-step__content">
                      <header class="recommendation-step__head">
                        <div>
                          <h5>{{ item.label }} <small v-if="item.relation === 'alternative'">二选一</small></h5>
                          <p v-if="item.description">{{ item.description }}</p>
                        </div>
                        <span>{{ item.skills.length > 1 ? '可选替代' : '执行步骤' }}</span>
                      </header>
                      <div class="recommendation-step__skills" :class="{ 'recommendation-step__skills--alternatives': item.skills.length > 1 }">
                        <SkillRecommendationCard v-for="skill in item.skills" :key="skill.skillKey" :skill="skill" :category="categoryFor(skill.categoryKey)" :fallback-category="fallbackCategoryName(skill.categoryKey)" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.devpipeline-page { --ink: #172033; --muted: #667085; --line: #e6eaf0; --surface: #fff; --canvas: #f7f9fc; --orange: #f06412; width: min(100%, 1220px); margin: 0 auto; color: var(--ink); }
.devpipeline-hero { position: relative; overflow: hidden; padding: 42px 40px 36px; border-radius: 24px; color: #fff; background: linear-gradient(130deg, #182541 0%, #273b67 70%, #31507a 100%); box-shadow: 0 20px 52px rgb(22 38 69 / 18%); }
.devpipeline-hero::after { position: absolute; right: -88px; bottom: -150px; width: 390px; height: 390px; border: 1px solid rgb(255 255 255 / 18%); border-radius: 50%; content: ''; }
.devpipeline-eyebrow, .section-kicker { margin: 0 0 10px; color: #ff9a59; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
.devpipeline-hero h1 { position: relative; z-index: 1; margin: 0; font-size: clamp(28px, 4vw, 44px); letter-spacing: -.04em; }
.devpipeline-lead { position: relative; z-index: 1; max-width: 780px; margin: 16px 0 0; color: rgb(255 255 255 / 78%); font-size: 14px; line-height: 1.8; }
.devpipeline-stats { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 12px; max-width: 720px; margin-top: 28px; }
.stat { display: grid; padding: 13px 16px; border: 1px solid rgb(255 255 255 / 17%); border-radius: 13px; background: rgb(255 255 255 / 8%); backdrop-filter: blur(5px); }
.stat strong { color: #ffac75; font-size: 25px; line-height: 1.1; }
.stat span { margin-top: 5px; color: rgb(255 255 255 / 72%); font-size: 11px; }
.devpipeline-section { margin-top: 38px; }
.devpipeline-section-head { display: flex; align-items: end; justify-content: space-between; gap: 28px; }
.devpipeline-section-head h2 { margin: 0; color: var(--ink); font-size: 24px; letter-spacing: -.03em; }
.devpipeline-section-head > p { max-width: 660px; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.75; }
.devpipeline-section-head .section-kicker { margin-bottom: 7px; color: var(--orange); font-size: 10px; }
.flow-tree-card { margin-top: 18px; padding: 22px; border: 1px solid var(--line); border-radius: 20px; background: var(--canvas); }
.category-sync-note { margin-bottom: 16px; padding: 9px 12px; border: 1px solid #f2d19b; border-radius: 10px; color: #8a5b16; background: #fff8e9; font-size: 12px; }
.flow-tree { display: grid; gap: 0; max-width: 1060px; margin: 0 auto; }
.flow-row-wrap { position: relative; }
.flow-row-label { margin-bottom: 8px; color: #8791a1; font-size: 11px; font-weight: 750; letter-spacing: .04em; text-align: center; }
.flow-row { display: flex; justify-content: center; }
.flow-row--parallel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.flow-node { width: min(100%, 620px); border: 1px solid var(--line); border-top: 4px solid var(--node-color, var(--orange)); border-radius: 15px; background: var(--surface); box-shadow: 0 5px 16px rgb(25 37 61 / 5%); }
.flow-node--requirement { --node-color: #5268c9; } .flow-node--product { --node-color: #8b5bc7; } .flow-node--architecture { --node-color: #167c91; } .flow-node--ui { --node-color: #d14a75; } .flow-node--backend { --node-color: #137c70; } .flow-node--frontend { --node-color: #3f67b6; } .flow-node--security { --node-color: #ba3e51; } .flow-node--testing { --node-color: #be7b13; } .flow-node--deployment { --node-color: #53657f; }
.flow-node__button { display: flex; width: 100%; align-items: center; gap: 12px; padding: 14px 16px 9px; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.flow-node__button:focus-visible { outline: 3px solid rgb(240 100 18 / 28%); outline-offset: -3px; }
.flow-node__no { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 10px; color: #fff; background: var(--node-color, var(--orange)); font-size: 11px; font-weight: 800; }
.flow-node__copy { display: grid; gap: 3px; min-width: 0; } .flow-node__copy strong { font-size: 15px; } .flow-node__copy small { color: #7b8493; font-size: 10px; }
.flow-node__chevron { margin-left: auto; color: var(--node-color, var(--orange)); font-size: 20px; line-height: 1; transition: transform .18s ease; }
.flow-node__button[aria-expanded='true'] .flow-node__chevron { transform: rotate(180deg); }
.flow-node__description { margin: 0; padding: 0 16px 12px 62px; color: var(--muted); font-size: 12px; line-height: 1.6; }
.flow-node__details { padding: 12px 16px 15px; border-top: 1px solid #edf0f4; background: #fbfcfe; }
.flow-node__dependency { margin: 0 0 9px; color: #8791a1; font-size: 11px; }
.category-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.category-pill { padding: 5px 9px; border: 1px solid color-mix(in srgb, var(--node-color) 25%, white); border-radius: 999px; color: color-mix(in srgb, var(--node-color) 82%, #172033); background: color-mix(in srgb, var(--node-color) 8%, white); font-size: 11px; font-weight: 650; }
.flow-connector { display: grid; height: 35px; place-items: center; color: #99a3b2; font-size: 20px; }
.flow-note { max-width: 900px; margin: 17px auto 0; color: #7b8493; font-size: 12px; line-height: 1.7; text-align: center; }
.recommendation-nav { display: grid; gap: 10px; margin-top: 16px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: #f8fafc; }
.recommendation-nav__actions, .recommendation-nav__stages { display: flex; flex-wrap: wrap; gap: 7px; }
.recommendation-nav__action, .recommendation-nav__stage { border: 1px solid #d9e0ea; border-radius: 8px; color: #536783; background: #fff; font-size: 11px; cursor: pointer; }
.recommendation-nav__action { padding: 7px 10px; font-weight: 750; }
.recommendation-nav__action:hover, .recommendation-nav__stage:hover { border-color: #9eb2ca; background: #f1f5fa; }
.recommendation-nav__stage { padding: 6px 9px; }
.recommendation-nav__stage span { margin-right: 5px; color: var(--orange); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; font-weight: 800; }
.recommendation-nav__action:focus-visible, .recommendation-nav__stage:focus-visible { outline: 2px solid #2f7dcc; outline-offset: 2px; }
.recommendation-sections { display: grid; gap: 12px; margin-top: 18px; }
.recommendation-section { scroll-margin-top: 20px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
.recommendation-section__head { display: flex; align-items: center; gap: 13px; padding: 16px 20px; }
.recommendation-section__toggle { display: flex; min-width: 0; flex: 1; align-items: center; gap: 13px; padding: 0; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.recommendation-section__toggle:focus-visible { outline: 3px solid rgb(240 100 18 / 25%); outline-offset: 5px; border-radius: 8px; }
.recommendation-section__no { display: grid; width: 40px; height: 40px; flex: 0 0 40px; place-items: center; border-radius: 11px; color: #fff; background: #53657f; font-size: 11px; font-weight: 800; }
.recommendation-section:nth-child(3n + 1) .recommendation-section__no { background: #5268c9; } .recommendation-section:nth-child(3n + 2) .recommendation-section__no { background: #8b5bc7; } .recommendation-section:nth-child(3n) .recommendation-section__no { background: #137c70; }
.recommendation-section__title { display: grid; min-width: 0; gap: 4px; }
.recommendation-section__title strong { font-size: 18px; }
.recommendation-section__title small { color: #8b95a5; font-size: 11px; font-weight: 600; }
.recommendation-section__title > span { color: var(--muted); font-size: 12px; line-height: 1.6; }
.recommendation-section__chevron { margin-left: auto; color: #60718a; font-size: 22px; line-height: 1; transition: transform .18s ease; }
.recommendation-section__toggle[aria-expanded='true'] .recommendation-section__chevron { transform: rotate(180deg); }
.recommendation-section__phase { margin-left: auto; padding: 5px 9px; border-radius: 999px; color: #53657f; background: #eef2f7; font-size: 10px; font-weight: 750; white-space: nowrap; }
.recommendation-section__content { padding: 0 20px 20px; }
.deliverables { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 16px; } .deliverables-label { margin-right: 2px; color: #7a8494; font-size: 11px; font-weight: 750; } .deliverable-chip { padding: 4px 8px; border-radius: 6px; color: #53657f; background: #f0f3f7; font-size: 11px; }
.recommendation-subsections { display: grid; gap: 14px; margin-top: 18px; }
.recommendation-subsection { padding: 15px; border: 1px solid #e8edf3; border-radius: 14px; background: #fbfcfe; }
.recommendation-subsection__head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.recommendation-subsection__head h4 { margin: 0; font-size: 15px; }
.recommendation-subsection__head h4 small { margin-left: 5px; color: #8b95a5; font-size: 10px; font-weight: 600; }
.recommendation-subsection__head p { margin: 5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.6; }
.recommendation-subsection__head > span { flex: 0 0 auto; padding: 4px 7px; border-radius: 5px; color: #63738b; background: #eef2f7; font-size: 10px; }
.recommendation-steps { display: grid; gap: 16px; margin-top: 14px; }
.recommendation-step { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; }
.recommendation-step__marker { display: flex; flex-direction: column; align-items: center; min-height: 100%; }
.recommendation-step__number { display: grid; width: 29px; height: 29px; flex: 0 0 29px; place-items: center; border: 1px solid #c8d5ec; border-radius: 50%; color: #5268c9; background: #edf2fc; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; font-weight: 800; }
.recommendation-step__line { width: 1px; flex: 1; margin-top: 7px; background: #dce4ef; }
.recommendation-step:last-child .recommendation-step__line { display: none; }
.recommendation-step__content { min-width: 0; }
.recommendation-step__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 2px 0 9px; }
.recommendation-step__head h5 { margin: 0; color: #273b67; font-size: 13px; }
.recommendation-step__head h5 small { margin-left: 5px; padding: 3px 6px; border-radius: 5px; color: #7b5d1d; background: #fff4d9; font-size: 10px; font-weight: 700; }
.recommendation-step__head p { margin: 4px 0 0; color: #7b8493; font-size: 11px; line-height: 1.55; }
.recommendation-step__head > span { flex: 0 0 auto; padding: 4px 7px; border-radius: 5px; color: #63738b; background: #eef2f7; font-size: 10px; white-space: nowrap; }
.recommendation-step__skills { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.recommendation-step__skills--alternatives { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 760px) { .devpipeline-hero { padding: 30px 22px 26px; border-radius: 18px; } .devpipeline-stats { grid-template-columns: repeat(2, 1fr); } .devpipeline-section-head { display: grid; gap: 10px; } .flow-tree-card, .recommendation-section { border-radius: 16px; } .recommendation-section__head, .recommendation-section__content { padding-right: 14px; padding-left: 14px; } .flow-row--parallel, .recommendation-step__skills--alternatives { grid-template-columns: 1fr; } .recommendation-section__phase { align-self: center; font-size: 9px; } .recommendation-section__title strong { font-size: 16px; } .recommendation-subsection__head, .recommendation-step__head { align-items: flex-start; } }
@media (prefers-reduced-motion: reduce) { .flow-node__chevron { transition: none; } }
</style>
