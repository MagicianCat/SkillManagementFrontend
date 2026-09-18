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

/** 用 ELK layered 布局计算节点坐标，支持并行分支与回边。 */
export async function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<Record<string, Positioned>> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '56',
      'elk.spacing.nodeNode': '32',
      'elk.padding': '[top=16,left=16,bottom=16,right=16]',
    },
    children: nodes.map((node) => ({ id: node.id, width: node.width, height: node.height })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  }
  const result = await elk.layout(graph)
  const positions: Record<string, Positioned> = {}
  for (const child of result.children ?? []) positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }
  return positions
}
