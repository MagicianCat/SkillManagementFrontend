import type { WorkflowStage } from './workflow'

/** 面板通用状态色调，映射到 tokens 语义色。 */
export type StatusTone = 'success' | 'warning' | 'info' | 'error' | 'purple' | 'neutral'

/** 阶段 DAG 节点视图模型。 */
export interface DagStageNode {
  id: string
  name: string
  status: string
  tone: StatusTone
  current: boolean
  attention: boolean
}

/** 当前阶段内 Agent 子 DAG 的节点。 */
export interface AgentDagNode {
  id: string
  name: string
  status: string
  tone: StatusTone
  current: boolean
  agentRunId?: number | null
}

/** 执行轨迹的一条条目。 */
export interface TimelineItem {
  key: string
  type: string
  label: string
  detail: string
  time: string
  tone: StatusTone
}

/** 产物 Revision 对比的一行变更。 */
export interface RevisionDiff {
  added: number | null
  removed: number | null
}

export type { WorkflowStage }
