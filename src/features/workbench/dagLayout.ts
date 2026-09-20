import ELK from 'elkjs/lib/elk.bundled.js'

export interface LayoutNode {
  id: string
  width: number
  height: number
}
export interface LayoutEdge {
  id: string
  source: string
  target: string
}
export interface Positioned {
  x: number
  y: number
}

const elk = new ELK()

export interface LayoutOptions {
  /** 层与层之间（水平）间距。 */
  layerGap?: number
  /** 同层节点（垂直）间距。 */
  nodeGap?: number
  padding?: number
}

/** 用 ELK layered 布局计算节点坐标，支持并行分支与回边。 */
export async function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[], options: LayoutOptions = {}): Promise<Record<string, Positioned>> {
  const { layerGap = 64, nodeGap = 40, padding = 20 } = options
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      // 允许回边（loop）反向布局，不会被强制拉直。
      'elk.layered.feedbackEdges': 'true',
      // 按节点声明顺序排列同层（保证 UI 设计在上、架构设计在下），减少交叉。
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerGap),
      'elk.spacing.nodeNode': String(nodeGap),
      'elk.padding': `[top=${padding},left=${padding},bottom=${padding},right=${padding}]`,
    },
    children: nodes.map((node) => ({ id: node.id, width: node.width, height: node.height })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  }
  const result = await elk.layout(graph)
  const positions: Record<string, Positioned> = {}
  for (const child of result.children ?? []) positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }
  return positions
}
