/**
 * Mock 引擎（mock/dev-pipeline-demo 专用）：前端定时器驱动「编码 → 安全审核 → 测试 → 部署」
 * 四个 mock 阶段的运行，不真实调用 agent。后端只负责在验收后插入 PENDING 阶段占位；
 * 本引擎在浏览器端通过 store 的 mockOverlay 叠加展示态（快照轮询后自动回放），让现有 DAG / 当前阶段面板
 * 用原有渲染逻辑直接展示虚拟 agent 编排与状态推进，并驱动虚拟 IDE / 测试进度窗口与时间线。
 *
 * 真实四阶段（需求/PRD/架构/UI）数据不经过本引擎，渲染路径完全不变。
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { WorkflowStage, WorkflowAgentNode, WorkflowEdge, WorkflowEvent } from '../../../types/workflow'
import { createProjectDocument } from '../../../api/projects.api'
import {
  DETAILED_DESIGN_DOC,
  TEST_CASES_DOC,
  DEPLOY_CHECKLIST_DOC,
  IDE_CODE_LINES,
  IDE_DIFF_LINES,
  MOCK_TEST_CASES,
  SECURITY_FINDING,
  type DiffLine,
} from './mockContent'

const MOCK_KEYS = ['BACKEND_CODING', 'SECURITY_REVIEW', 'TESTING', 'DEPLOYMENT'] as const
type MockKey = (typeof MOCK_KEYS)[number]

const STAGE_NAME: Record<MockKey, string> = {
  BACKEND_CODING: '编码',
  SECURITY_REVIEW: '安全审核',
  TESTING: '测试',
  DEPLOYMENT: '部署',
}

/** 每个 mock 阶段内部的虚拟 agent 编排（顺序链 + 安全回环）。 */
const STAGE_AGENTS: Record<MockKey, { key: string; name: string }[]> = {
  BACKEND_CODING: [
    { key: 'detail', name: '详细设计' },
    { key: 'plan', name: '执行规划' },
    { key: 'coder', name: '编码' },
  ],
  SECURITY_REVIEW: [{ key: 'reviewer', name: '代码审查' }],
  TESTING: [
    { key: 'case', name: '测试用例设计' },
    { key: 'run', name: '测试执行' },
  ],
  DEPLOYMENT: [{ key: 'deploy', name: '部署' }],
}

/** 阶段内 agent 顺序边；安全阶段额外有一条指向编码的返工回环（视觉呈现退回）。 */
function stageEdgesFor(key: MockKey): WorkflowEdge[] {
  const agents = STAGE_AGENTS[key]
  const edges: WorkflowEdge[] = agents.slice(0, -1).map((a, i) => ({ from: a.key, to: agents[i + 1].key, edgeType: 'NORMAL' }))
  if (key === 'SECURITY_REVIEW') edges.push({ from: 'reviewer', to: 'coder', edgeType: 'LOOP', incrementsLoop: true, conditionValue: 'SECURITY_ISSUE' })
  if (key === 'BACKEND_CODING') edges.push({ from: 'reviewer', to: 'coder', edgeType: 'LOOP', incrementsLoop: true, conditionValue: 'SECURITY_ISSUE' })
  return edges
}

export interface MockStores {
  stages: Ref<WorkflowStage[]>
  workflowRun: Ref<{ id: string | number; status: string } | null>
  pushEvent: (event: WorkflowEvent) => void
  /** 让 workspace 选中某个阶段（保证当前阶段面板跟随 mock 推进）。 */
  select: (stageId: string) => void
  projectKey: Ref<string>
  /** 把 mock 阶段的展示态写入 store overlay（随后端快照回放，不被轮询覆盖）。 */
  setOverlay: (stageId: string, patch: Partial<WorkflowStage>) => void
  clearOverlay: () => void
}

export interface TestCaseProgress { id: string; title: string; status: 'PENDING' | 'RUNNING' | 'PASSED' }

/** 录制节奏（用户要求：编码 30s，其余均匀分配，产物生成后留查看时间）：
 *  编码阶段≈100s（详细设计40s+执行规划20s+编码30s+文档停留10s），安全≈80s（首审35s+修复复审45s），
 *  测试≈85s（用例设计40s+执行45s），部署40s，衔接缓冲若干。总时长约 5 分钟。 */
const DETAIL_MS = 40_000       // 详细设计
const PLAN_MS = 20_000         // 执行规划
const CODING_MS = 30_000       // 编码 agent（虚拟 IDE 逐行生成）
const CODING_DWELL_MS = 10_000 // 编码完成后停留，便于查看详细设计文档
const SECURITY_MS = 35_000     // 代码审查（首次）
const TEST_DESIGN_MS = 40_000  // 测试用例设计
const DEPLOY_MS = 40_000       // 部署（清单入库后再停留 DEPLOY_DWELL_MS 便于查看）
const DEPLOY_DWELL_MS = 15_000 // 部署清单停留
const STAGE_GAP_MS = 3_000     // 阶段衔接缓冲
const FIX_REVIEW_MS = 25_000   // 安全修复 + 复审
const TEST_CASE_MS = 4_500     // 单条测试用例执行耗时（10 条 ≈ 45s）

export function useMockEngine(stores: MockStores) {
  const active = ref(false)
  const finished = ref(false)
  /** 虚拟 IDE 面板状态。 */
  const ideVisible = ref(false)
  const ideFile = ref('ExtractionService.java')
  const ideLines = ref<string[]>([])
  const ideTyping = ref(false)
  const ideDiff = ref<DiffLine[]>([])
  const ideDiffVisible = ref(false)
  /** 测试进度面板状态。 */
  const testVisible = ref(false)
  const testCases = ref<TestCaseProgress[]>([])
  /** 当前 mock 阶段 key（驱动工作台面板显隐）。 */
  const currentMockKey = ref<MockKey | null>(null)

  let timer: ReturnType<typeof setTimeout> | null = null
  let started = false
  let sequence = 900_000

  const testPassedCount = computed(() => testCases.value.filter((c) => c.status === 'PASSED').length)

  function later(ms: number, fn: () => void) { timer = setTimeout(fn, ms) }
  function clear() { if (timer) { clearTimeout(timer); timer = null } }

  function emit(type: string, data: Record<string, unknown>) {
    stores.pushEvent({ id: `mock-${++sequence}`, type, data, createdAt: new Date().toISOString() })
  }

  function stageByKey(key: MockKey): WorkflowStage | undefined {
    return stores.stages.value.find((s) => String(s.key).toUpperCase() === key)
  }

  /** 写入某 mock 阶段的 overlay（agents/status/currentAgent/edges），不动其它字段；后端快照回放保持。
   *  mock 阶段统一 loop 展示为 1/3（后端占位无 maxLoopCount，否则角标显示 1/0）。 */
  function patchStage(key: MockKey, patch: Partial<WorkflowStage>) {
    const stage = stageByKey(key)
    if (!stage) return
    stores.setOverlay(String(stage.id), { maxLoopCount: 3, ...patch })
  }

  function setAgents(key: MockKey, activeIndex: number, doneUpTo: number) {
    const agents: WorkflowAgentNode[] = STAGE_AGENTS[key].map((a, i) => ({
      id: `mock-${key}-${a.key}`,
      key: a.key,
      name: a.name,
      displayName: a.name,
      status: i < doneUpTo ? 'COMPLETED' : i === activeIndex ? 'RUNNING' : 'PENDING',
    }))
    const currentAgent = activeIndex >= 0 && activeIndex < agents.length ? agents[activeIndex].name : null
    patchStage(key, { agents, currentAgent, edges: stageEdgesFor(key) })
  }

  /** 产出文档真实入库，并把 artifact 挂到对应 mock 阶段（overlay 合并 artifacts）。 */
  async function attachArtifact(key: MockKey, title: string, docType: string, markdown: string) {
    try {
      const doc = await createProjectDocument(stores.projectKey.value, { documentType: docType, title, markdownContent: markdown })
      const stage = stageByKey(key)
      if (!stage) return
      const artifacts = [...(stage.artifacts ?? []), { id: String(doc.id), name: doc.title, revision: 1, revisionId: doc.draft?.id, status: doc.status }]
      stores.setOverlay(String(stage.id), { artifacts })
      emit('artifact.revision.created', { stageName: STAGE_NAME[key], summary: `生成《${title}》`, revision: 1 })
    } catch (failure) {
      // 产物入库失败要可见（不再静默吞掉），便于现场排查权限/类型问题。
      console.error('[mock] attachArtifact failed:', docType, failure)
      emit('tool.failed', { stageName: STAGE_NAME[key], message: `《${title}》入库失败：${(failure as Error)?.message ?? '未知错误'}` })
    }
  }

  /* ---------------- 剧本步骤 ---------------- */

  function runCoding() {
    currentMockKey.value = 'BACKEND_CODING'
    patchStage('BACKEND_CODING', { status: 'RUNNING' })
    const stage = stageByKey('BACKEND_CODING'); if (stage) stores.select(String(stage.id))
    emit('stage.status.changed', { stageName: '编码', message: '编码阶段开始：详细设计 → 执行规划 → 编码' })
    // 1. 详细设计（运行 DETAIL_MS）
    setAgents('BACKEND_CODING', 0, 0)
    emit('agent.message.delta', { stageName: '编码', agentName: '详细设计', message: '基于架构设计文档展开模块、类与数据表设计…' })
    later(DETAIL_MS, () => {
      void attachArtifact('BACKEND_CODING', '销售沟通记录与管理工具 — 详细设计文档', 'DETAILED_DESIGN', DETAILED_DESIGN_DOC)
      setAgents('BACKEND_CODING', 1, 1)
      emit('agent.message.delta', { stageName: '编码', agentName: '执行规划', message: '拆分实施任务：接入层 → 记录服务 → AI 整理 → 看板查询，排定依赖顺序。' })
      // 2. 执行规划（运行 PLAN_MS，无产物）
      later(PLAN_MS, () => {
        setAgents('BACKEND_CODING', 2, 2)
        emit('tool.started', { stageName: '编码', agentName: '编码', message: '打开虚拟 IDE，开始实现 ExtractionService（六要素抽取）' })
        startIde()
      })
    })
  }

  function startIde() {
    ideVisible.value = true
    ideTyping.value = true
    ideLines.value = []
    // 编码 agent 运行 CODING_MS：把逐行生成摊到整个时长，生成完停留展示，便于点开虚拟 IDE。
    const perLine = Math.max(600, Math.floor((CODING_MS - 8_000) / IDE_CODE_LINES.length))
    let i = 0
    const typeNext = () => {
      if (i < IDE_CODE_LINES.length) {
        ideLines.value = IDE_CODE_LINES.slice(0, ++i)
        timer = setTimeout(typeNext, perLine)
      } else {
        ideTyping.value = false
        emit('agent.message.delta', { stageName: '编码', agentName: '编码', message: '完成 ExtractionService.extractSixElements 实现' })
        later(8_000, finishCoding)
      }
    }
    typeNext()
  }

  function finishCoding() {
    patchStage('BACKEND_CODING', { status: 'COMPLETED' })
    setAgents('BACKEND_CODING', -1, STAGE_AGENTS.BACKEND_CODING.length)
    emit('stage.status.changed', { stageName: '编码', message: '编码阶段完成' })
    // 停留一段时间，便于查看《详细设计文档》产物，再进入安全审核。
    later(CODING_DWELL_MS, runSecurity)
  }

  function runSecurity() {
    currentMockKey.value = 'SECURITY_REVIEW'
    ideVisible.value = false
    patchStage('SECURITY_REVIEW', { status: 'RUNNING' })
    const stage = stageByKey('SECURITY_REVIEW'); if (stage) stores.select(String(stage.id))
    setAgents('SECURITY_REVIEW', 0, 0)
    emit('stage.status.changed', { stageName: '安全审核', message: '安全审核开始：代码审查' })
    // 代码审查 agent 运行 SECURITY_MS 后发现问题
    later(SECURITY_MS, () => {
      // 发现问题 → 退回编码
      emit('tool.failed', { stageName: '安全审核', agentName: '代码审查', message: SECURITY_FINDING })
      patchStage('SECURITY_REVIEW', { status: 'HUMAN_REQUIRED', attention: true })
      patchStage('BACKEND_CODING', { status: 'RUNNING' })
      currentMockKey.value = 'BACKEND_CODING'
      const coding = stageByKey('BACKEND_CODING'); if (coding) stores.select(String(coding.id))
      setAgents('BACKEND_CODING', 2, 2)
      later(STAGE_GAP_MS, showFixDiff)
    })
  }

  function showFixDiff() {
    ideVisible.value = true
    ideDiffVisible.value = true
    ideDiff.value = []
    emit('tool.started', { stageName: '编码', agentName: '编码', message: '修复安全问题：为网关调用补充超时与凭证注入' })
    // 修复 diff 逐行展示，停留时间拉长便于查看
    const perDiff = Math.max(700, Math.floor(FIX_REVIEW_MS / IDE_DIFF_LINES.length))
    let i = 0
    const diffNext = () => {
      if (i < IDE_DIFF_LINES.length) {
        ideDiff.value = IDE_DIFF_LINES.slice(0, ++i)
        timer = setTimeout(diffNext, perDiff)
      } else {
        emit('agent.message.delta', { stageName: '编码', agentName: '编码', message: '安全修复完成，提交复审' })
        later(STAGE_GAP_MS, reReview)
      }
    }
    diffNext()
  }

  function reReview() {
    ideVisible.value = false
    ideDiffVisible.value = false
    patchStage('BACKEND_CODING', { status: 'COMPLETED' })
    patchStage('SECURITY_REVIEW', { status: 'RUNNING', attention: false })
    currentMockKey.value = 'SECURITY_REVIEW'
    const sec = stageByKey('SECURITY_REVIEW'); if (sec) stores.select(String(sec.id))
    emit('agent.message.delta', { stageName: '安全审核', agentName: '代码审查', message: '复审通过：超时与凭证注入符合安全设计要求' })
    later(FIX_REVIEW_MS, () => {
      patchStage('SECURITY_REVIEW', { status: 'COMPLETED' })
      setAgents('SECURITY_REVIEW', -1, STAGE_AGENTS.SECURITY_REVIEW.length)
      emit('stage.status.changed', { stageName: '安全审核', message: '安全审核通过' })
      later(STAGE_GAP_MS, runTesting)
    })
  }

  function runTesting() {
    currentMockKey.value = 'TESTING'
    patchStage('TESTING', { status: 'RUNNING' })
    const stage = stageByKey('TESTING'); if (stage) stores.select(String(stage.id))
    setAgents('TESTING', 0, 0)
    emit('stage.status.changed', { stageName: '测试', message: '测试阶段开始：用例设计 → 用例执行' })
    // 测试用例设计 agent 运行 TEST_DESIGN_MS 产出文档，随后进入执行
    later(TEST_DESIGN_MS, () => {
      void attachArtifact('TESTING', '销售沟通记录与管理工具 — 测试用例', 'TEST_CASES', TEST_CASES_DOC)
      setAgents('TESTING', 1, 1)
      emit('tool.started', { stageName: '测试', agentName: '测试执行', message: '开始逐条执行测试用例' })
      startTestProgress()
    })
  }

  function startTestProgress() {
    testVisible.value = true
    testCases.value = MOCK_TEST_CASES.map((c) => ({ ...c, status: 'PENDING' }))
    let i = 0
    const runNext = () => {
      if (i < testCases.value.length) {
        testCases.value = testCases.value.map((c, idx) => (idx === i ? { ...c, status: 'RUNNING' } : c))
        timer = setTimeout(() => {
          testCases.value = testCases.value.map((c, idx) => (idx === i ? { ...c, status: 'PASSED' } : c))
          emit('tool.completed', { stageName: '测试', agentName: '测试执行', message: `${testCases.value[i].id} ${testCases.value[i].title} 通过` })
          i++
          runNext()
        }, TEST_CASE_MS)
      } else {
        emit('agent.message.delta', { stageName: '测试', agentName: '测试执行', message: `全部 ${testCases.value.length} 条用例通过` })
        later(STAGE_GAP_MS, () => {
          patchStage('TESTING', { status: 'COMPLETED' })
          setAgents('TESTING', -1, STAGE_AGENTS.TESTING.length)
          emit('stage.status.changed', { stageName: '测试', message: '测试阶段完成，全部用例通过' })
          later(STAGE_GAP_MS, runDeploy)
        })
      }
    }
    runNext()
  }

  function runDeploy() {
    currentMockKey.value = 'DEPLOYMENT'
    patchStage('DEPLOYMENT', { status: 'RUNNING' })
    const stage = stageByKey('DEPLOYMENT'); if (stage) stores.select(String(stage.id))
    setAgents('DEPLOYMENT', 0, 0)
    emit('stage.status.changed', { stageName: '部署', message: '部署阶段开始：生成部署前准备清单' })
    // 部署 agent 运行 DEPLOY_MS 产出清单，停留 DEPLOY_DWELL_MS 便于查看后再收尾
    later(DEPLOY_MS, () => {
      void attachArtifact('DEPLOYMENT', '销售沟通记录与管理工具 — 部署前准备清单', 'DEPLOY_CHECKLIST', DEPLOY_CHECKLIST_DOC)
      emit('agent.message.delta', { stageName: '部署', agentName: '部署', message: '部署前准备清单已生成，待逐项核对后上线' })
      later(DEPLOY_DWELL_MS, () => {
        patchStage('DEPLOYMENT', { status: 'COMPLETED' })
        setAgents('DEPLOYMENT', -1, STAGE_AGENTS.DEPLOYMENT.length)
        emit('stage.status.changed', { stageName: '部署', message: '部署阶段完成' })
        emit('workflow.completed', { message: '研发全链路 mock 流程执行完毕' })
        finished.value = true
        currentMockKey.value = null
        clear()
      })
    })
  }

  /** 监听：检测到 mock 阶段（后端已插入 PENDING 占位）即启动剧本，仅启动一次。 */
  const stop = watch(
    () => stores.stages.value.map((s) => `${String(s.key).toUpperCase()}:${s.status}`).join('|'),
    () => {
      if (started) return
      const hasMock = MOCK_KEYS.some((k) => stageByKey(k))
      const runStatus = String(stores.workflowRun.value?.status ?? '')
      const terminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'DESIGN_COMPLETED'].includes(runStatus)
      if (hasMock && !terminal) {
        started = true
        active.value = true
        // 验收后先停留几秒，让你看清 DAG 上新增的 4 个阶段，再开始编码阶段。
        later(STAGE_GAP_MS, runCoding)
      }
    },
    { immediate: true },
  )

  function dispose() { clear(); stop() }

  return {
    active, finished, currentMockKey,
    ideVisible, ideFile, ideLines, ideTyping, ideDiff, ideDiffVisible,
    testVisible, testCases, testPassedCount,
    dispose,
  }
}
