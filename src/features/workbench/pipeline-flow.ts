import { flowNodes, type FlowNode } from '../dev-pipeline/pipeline-content'

/**
 * 研发全链路流程 DAG 结构 —— 与「流程最佳实践」页共享同一份权威数据（pipeline-content.flowNodes），
 * 这里只补充阶段之间的依赖/并行拓扑，供工作台 DAG 渲染。阶段枚举不在工作台写死。
 */

/** 后端 stage_key 的多种取值统一归一到流程节点 id。
 *  覆盖 DevelopmentStage 枚举（ARCHITECTURE_DESIGN/BACKEND_CODING/…）与 project_stage 旧值（PRD/CODING/RELEASE/…）。 */
const KEY_ALIASES: Record<string, string[]> = {
  requirements: ['REQUIREMENT', 'REQUIREMENTS'],
  product: ['PRODUCT', 'PRD'],
  architecture: ['ARCHITECTURE', 'ARCHITECTURE_DESIGN'],
  ui: ['UI', 'UI_DESIGN'],
  backend: ['BACKEND', 'BACKEND_CODING', 'CODING'],
  frontend: ['FRONTEND', 'FRONTEND_CODING'],
  security: ['SECURITY', 'SECURITY_REVIEW'],
  testing: ['TESTING', 'TEST'],
  deployment: ['DEPLOYMENT', 'RELEASE', 'DEPLOY'],
}

/** 阶段间依赖（含两组并行支线：架构∥UI、后端∥前端）。 */
const FLOW_EDGES: Array<{ from: string; to: string }> = [
  { from: 'requirements', to: 'product' },
  { from: 'product', to: 'architecture' },
  { from: 'product', to: 'ui' },
  { from: 'architecture', to: 'backend' },
  { from: 'ui', to: 'frontend' },
  { from: 'backend', to: 'security' },
  { from: 'frontend', to: 'security' },
  { from: 'security', to: 'testing' },
  { from: 'testing', to: 'deployment' },
]

export interface PipelineStageNode {
  /** 流程节点 id（pipeline-content 的 flowNode.id，如 'requirements'）。 */
  id: string
  /** 该阶段可被后端 stage_key 匹配到的全部枚举取值。 */
  aliases: string[]
  name: string
  en: string
  sub: string
}

const byId = new Map<string, FlowNode>(flowNodes.map((node) => [node.id, node]))

/** 归一化 key：去非字母、大写，便于宽松匹配。 */
function normalize(key: string): string {
  return key.toUpperCase().replace(/[^A-Z]/g, '')
}

/** 全链路流程节点（按权威顺序）。 */
export const pipelineStageNodes: PipelineStageNode[] = flowNodes.map((node) => ({
  id: node.id,
  aliases: KEY_ALIASES[node.id] ?? [node.id.toUpperCase()],
  name: node.name,
  en: node.en,
  sub: node.phaseLabel,
}))

/** 全链路流程边（含并行支线）。 */
export const pipelineStageEdges = FLOW_EDGES

/** 给定后端 stage_key，返回所属流程节点 id（匹配不到返回 null）。 */
export function pipelineNodeIdForStageKey(stageKey: string): string | null {
  const norm = normalize(stageKey)
  if (!norm) return null
  for (const node of pipelineStageNodes) {
    if (node.aliases.some((alias) => normalize(alias) === norm)) return node.id
  }
  // 兜底：别名包含 / 被包含（如 ARCHITECTURE_DESIGN 命中 ARCHITECTURE）。
  for (const node of pipelineStageNodes) {
    if (node.aliases.some((alias) => { const a = normalize(alias); return a.length > 2 && (norm.includes(a) || a.includes(norm)) })) return node.id
  }
  return null
}

export { byId as pipelineFlowNodeById }
