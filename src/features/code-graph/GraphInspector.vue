<script setup lang="ts">
import type { CodeGraphContextResult, CodeGraphNode } from '../../types/code-graph'
import type { ExplorerLevel, RepositoryRelationViewModel, RepositoryViewModel } from './codeGraphViewModel'

defineProps<{
  level: ExplorerLevel
  repository?: RepositoryViewModel | null
  relation?: RepositoryRelationViewModel | null
  symbol?: CodeGraphNode | null
  context?: CodeGraphContextResult | null
  relationCount: number
}>()
const emit = defineEmits<{ drill: []; impact: []; overview: [] }>()
</script>

<template>
  <aside class="inspector panel" aria-label="图谱详情">
    <template v-if="relation">
      <header>RELATION DETAIL <span>↗</span></header>
      <span class="badge">{{ relation.type }} · {{ relation.evidenceStatus === 'VERIFIED' ? '已确认' : '待确认' }}</span>
      <h2>{{ relation.source }} → {{ relation.target }}</h2>
      <p class="subtitle">箭头由调用方或依赖方指向被调用方或被依赖方。</p>
      <div class="stats"><div><span>证据数量</span><strong>{{ relation.evidenceCount }}</strong></div><div><span>关系类型</span><strong class="small">{{ relation.type }}</strong></div></div>
      <div class="divider" /><h3>关系证据</h3>
      <article v-for="source in relation.evidenceSources" :key="source" class="evidence"><b>✓ {{ source }}</b><p>来源于当前冻结快照；具体文件路径尚未由现有接口返回。</p><code>{{ relation.label }}</code></article>
      <article v-for="(evidence, index) in relation.evidence ?? []" :key="`${evidence.contractId ?? 'evidence'}-${index}`" class="evidence"><b>✓ {{ evidence.contractId ?? 'Workspace CrossLink' }}</b><p>{{ evidence.from ?? relation.source }} → {{ evidence.to ?? relation.target }}</p><code>{{ evidence.matchType ?? 'VERIFIED' }} · 置信度 {{ evidence.confidence ?? '—' }}</code></article>
      <p class="caution">只有后端返回的契约或依赖证据才会绘制为跨仓连线。</p>
    </template>

    <template v-else-if="symbol">
      <header>SYMBOL DETAIL <span>↗</span></header>
      <span class="badge">{{ symbol.kind }} · {{ level === 'impact' ? '影响分析' : '代码节点' }}</span>
      <h2>{{ symbol.label }}</h2>
      <p class="subtitle">{{ symbol.repository || repository?.name || '当前仓库' }}</p>
      <div v-if="symbol.position?.path || symbol.filePath" class="source-path">{{ symbol.position?.path || symbol.filePath }}<template v-if="symbol.position?.line">:{{ symbol.position.line }}</template></div>
      <div class="divider" /><h3>{{ level === 'impact' && !relationCount ? '已知上下文（非影响结论）' : level === 'impact' ? '影响说明' : symbol.kind === 'METHOD' ? '方法调用与上下文' : '成员与局部上下文' }}</h3>
      <p v-if="level === 'impact' && !relationCount" class="caution">当前算法未解析到该节点的上游影响路径。这不表示节点未被使用；下方展示的是其已知代码上下文。</p>
      <article v-for="fact in context?.facts ?? []" :key="fact.title + fact.detail" class="evidence"><b>{{ fact.title }}</b><p>{{ fact.detail }}</p></article>
      <p v-if="!(context?.facts?.length)" class="caution">当前节点没有更多上下文事实，仍可尝试影响分析或搜索相邻符号。</p>
      <button v-if="level !== 'impact'" type="button" class="primary" @click="emit('impact')">分析上游影响 →</button>
      <button v-else type="button" class="primary" @click="emit('drill')">查看文件与符号关系 →</button>
    </template>

    <template v-else-if="repository">
      <header>REPOSITORY DETAIL <span>↗</span></header>
      <span class="badge repository">{{ repository.role }} · 已索引</span>
      <h2>{{ repository.name }}</h2>
      <p class="subtitle">当前 Workflow Run 冻结快照中的代码仓库。</p>
      <div class="stats"><div><span>索引文件</span><strong>{{ repository.files ?? '—' }}</strong></div><div><span>代码符号</span><strong>{{ repository.symbols ?? '—' }}</strong></div></div>
      <div class="divider" /><h3>仓库地址</h3><p class="url">{{ repository.url }}</p>
      <h3>仓库关系</h3><p class="caution">仓库角色与跨仓依赖仅根据已识别证据展示，不根据名称进行推断。</p>
      <button type="button" class="primary" @click="emit('drill')">查看文件与符号 →</button>
    </template>

    <template v-else>
      <div class="placeholder"><span>◇</span><strong>选择图中对象</strong><p>点击仓库、关系边或代码节点，查看来源、证据与下钻入口。</p></div>
    </template>
  </aside>
</template>

<style scoped>
.panel{min-width:0;border:1px solid var(--border-1);border-radius:11px;background:var(--surface-1);box-shadow:var(--shadow-sm)}.inspector{padding:18px;overflow:auto}.inspector header{display:flex;justify-content:space-between;color:var(--text-3);font:700 9px var(--font-mono);letter-spacing:.14em}.badge{display:inline-block;margin-top:18px;padding:5px 8px;border-radius:5px;background:var(--info-soft);color:var(--info);font-size:9px;font-weight:700}.badge.repository{background:var(--success-soft);color:var(--success)}h2{margin:10px 0 7px;font-size:18px;line-height:1.35;overflow-wrap:anywhere}.subtitle,.caution{color:var(--text-3);font-size:10px;line-height:1.65}.source-path,.url{padding:9px;border-radius:7px;background:var(--surface-2);color:var(--text-2);font:9px/1.6 var(--font-mono);overflow-wrap:anywhere}.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.stats div{padding:11px;border:1px solid var(--border-1);border-radius:8px}.stats span{color:var(--text-3);font-size:9px}.stats strong{display:block;margin-top:4px;font-size:16px}.stats strong.small{font-size:10px}.divider{height:1px;margin:19px 0;background:var(--border-1)}h3{margin:0 0 10px;font-size:11px}.evidence{margin:0 0 8px;padding:11px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-2)}.evidence b{font-size:10px;color:var(--success)}.evidence p{margin:6px 0;color:var(--text-3);font-size:9px;line-height:1.5}.evidence code{display:block;padding:7px;border-radius:5px;background:var(--surface-3);color:var(--text-2);font-size:9px;overflow-wrap:anywhere}.primary,.outline{width:100%;margin-top:12px;padding:9px 12px;border-radius:7px;cursor:pointer}.primary{border:1px solid var(--accent-500);background:var(--accent-500);color:var(--text-on-accent)}.outline{border:1px solid var(--border-2);background:var(--surface-1);color:var(--text-2)}.placeholder{display:grid;height:100%;min-height:320px;place-content:center;justify-items:center;text-align:center;color:var(--text-3)}.placeholder>span{font-size:32px;color:var(--border-3)}.placeholder strong{margin-top:10px;color:var(--text-2)}.placeholder p{max-width:210px;font-size:10px;line-height:1.6}
</style>
