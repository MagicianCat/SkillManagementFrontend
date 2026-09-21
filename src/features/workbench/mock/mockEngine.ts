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

  /** 写入某 mock 阶段的 overlay（agents/status/currentAgent/edges），不动其它字段；后端快照回放保持。 */
  function patchStage(key: MockKey, patch: Partial<WorkflowStage>) {
    const stage = stageByKey(key)
    if (!stage) return
    stores.setOverlay(String(stage.id), patch)
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
    } catch { /* 入库失败不阻塞 mock 演示 */ }
  }

  /* ---------------- 剧本步骤 ---------------- */

  function runCoding() {
    currentMockKey.value = 'BACKEND_CODING'
    patchStage('BACKEND_CODING', { status: 'RUNNING' })
    const stage = stageByKey('BACKEND_CODING'); if (stage) stores.select(String(stage.id))
    emit('stage.status.changed', { stageName: '编码', message: '编码阶段开始：详细设计 → 执行规划 → 编码' })
    // 1. 详细设计
    setAgents('BACKEND_CODING', 0, 0)
    emit('agent.message.delta', { stageName: '编码', agentName: '详细设计', message: '基于架构设计文档展开模块、类与数据表设计…' })
    later(1800, () => {
      void attachArtifact('BACKEND_CODING', '销售沟通记录与管理工具 — 详细设计文档', 'DETAILED_DESIGN', DETAILED_DESIGN_DOC)
      setAgents('BACKEND_CODING', 1, 1)
      emit('agent.message.delta', { stageName: '编码', agentName: '执行规划', message: '拆分实施任务：接入层 → 记录服务 → AI 整理 → 看板查询，排定依赖顺序。' })
      // 2. 执行规划（无产物）
      later(1800, () => {
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
    let i = 0
    const typeNext = () => {
      if (i < IDE_CODE_LINES.length) {
        ideLines.value = IDE_CODE_LINES.slice(0, ++i)
        timer = setTimeout(typeNext, 130)
      } else {
        ideTyping.value = false
        emit('agent.message.delta', { stageName: '编码', agentName: '编码', message: '完成 ExtractionService.extractSixElements 实现' })
        later(1200, finishCoding)
      }
    }
    typeNext()
  }

  function finishCoding() {
    patchStage('BACKEND_CODING', { status: 'COMPLETED' })
    setAgents('BACKEND_CODING', -1, STAGE_AGENTS.BACKEND_CODING.length)
    emit('stage.status.changed', { stageName: '编码', message: '编码阶段完成' })
    later(1500, runSecurity)
  }

  function runSecurity() {
    currentMockKey.value = 'SECURITY_REVIEW'
    ideVisible.value = false
    patchStage('SECURITY_REVIEW', { status: 'RUNNING' })
    const stage = stageByKey('SECURITY_REVIEW'); if (stage) stores.select(String(stage.id))
    setAgents('SECURITY_REVIEW', 0, 0)
    emit('stage.status.changed', { stageName: '安全审核', message: '安全审核开始：代码审查' })
    later(2200, () => {
      // 发现问题 → 退回编码
      emit('tool.failed', { stageName: '安全审核', agentName: '代码审查', message: SECURITY_FINDING })
      patchStage('SECURITY_REVIEW', { status: 'HUMAN_REQUIRED', attention: true })
      patchStage('BACKEND_CODING', { status: 'RUNNING' })
      currentMockKey.value = 'BACKEND_CODING'
      const coding = stageByKey('BACKEND_CODING'); if (coding) stores.select(String(coding.id))
      setAgents('BACKEND_CODING', 2, 2)
      later(1500, showFixDiff)
    })
  }

  function showFixDiff() {
    ideVisible.value = true
    ideDiffVisible.value = true
    ideDiff.value = []
    emit('tool.started', { stageName: '编码', agentName: '编码', message: '修复安全问题：为网关调用补充超时与凭证注入' })
    let i = 0
    const diffNext = () => {
      if (i < IDE_DIFF_LINES.length) {
        ideDiff.value = IDE_DIFF_LINES.slice(0, ++i)
        timer = setTimeout(diffNext, 240)
      } else {
        emit('agent.message.delta', { stageName: '编码', agentName: '编码', message: '安全修复完成，提交复审' })
        later(1500, reReview)
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
    later(1800, () => {
      patchStage('SECURITY_REVIEW', { status: 'COMPLETED' })
      setAgents('SECURITY_REVIEW', -1, STAGE_AGENTS.SECURITY_REVIEW.length)
      emit('stage.status.changed', { stageName: '安全审核', message: '安全审核通过' })
      later(1400, runTesting)
    })
  }

  function runTesting() {
    currentMockKey.value = 'TESTING'
    patchStage('TESTING', { status: 'RUNNING' })
    const stage = stageByKey('TESTING'); if (stage) stores.select(String(stage.id))
    setAgents('TESTING', 0, 0)
    emit('stage.status.changed', { stageName: '测试', message: '测试阶段开始：用例设计 → 用例执行' })
    later(1800, () => {
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
        }, 620)
      } else {
        emit('agent.message.delta', { stageName: '测试', agentName: '测试执行', message: `全部 ${testCases.value.length} 条用例通过` })
        later(1200, () => {
          patchStage('TESTING', { status: 'COMPLETED' })
          setAgents('TESTING', -1, STAGE_AGENTS.TESTING.length)
          emit('stage.status.changed', { stageName: '测试', message: '测试阶段完成，全部用例通过' })
          later(1400, runDeploy)
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
    later(2000, () => {
      void attachArtifact('DEPLOYMENT', '销售沟通记录与管理工具 — 部署前准备清单', 'DEPLOY_CHECKLIST', DEPLOY_CHECKLIST_DOC)
      emit('agent.message.delta', { stageName: '部署', agentName: '部署', message: '部署前准备清单已生成，待逐项核对后上线' })
      later(1500, () => {
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
        later(1200, runCoding)
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
