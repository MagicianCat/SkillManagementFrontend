<script setup lang="ts">
import type { CodeGraphNode } from '../../types/code-graph'
import type { RepositoryViewModel } from './codeGraphViewModel'

defineProps<{
  repositories: RepositoryViewModel[]
  selectedRepository: string
  searchQuery: string
  searchResults: CodeGraphNode[]
  searching: boolean
  showEvidence: boolean
}>()
const emit = defineEmits<{
  selectRepository: [repository: RepositoryViewModel]
  updateSearch: [value: string]
  search: []
  selectResult: [node: CodeGraphNode]
  updateShowEvidence: [value: boolean]
}>()
</script>

<template>
  <aside class="navigator panel" aria-label="仓库导航">
    <header><b>仓库导航</b><small>{{ repositories.length }} 个</small></header>
    <form class="search" @submit.prevent="emit('search')">
      <span aria-hidden="true">⌕</span>
      <input :value="searchQuery" placeholder="搜索仓库、文件、符号" aria-label="搜索仓库、文件、符号" @input="emit('updateSearch', ($event.target as HTMLInputElement).value)" />
    </form>
    <p class="section-label">REPOSITORIES</p>
    <button v-for="repository in repositories" :key="repository.id" type="button" class="repository" :class="{ selected: selectedRepository === repository.queryKey }" @click="emit('selectRepository', repository)">
      <span class="repo-icon">R</span>
      <span class="repo-copy">
        <strong :title="repository.name">{{ repository.name }}</strong>
        <small>{{ repository.role }} · {{ repository.indexed ? '已索引' : '未索引' }}</small>
        <em>{{ repository.files ?? '—' }} 文件 · {{ repository.symbols ?? '—' }} 符号</em>
      </span>
    </button>

    <template v-if="searchResults.length || searching">
      <div class="divider" />
      <p class="section-label">SEARCH RESULTS</p>
      <p v-if="searching" class="pending">正在检索冻结图谱…</p>
      <button v-for="node in searchResults" :key="node.id" type="button" class="result" @click="emit('selectResult', node)">
        <strong>{{ node.label }}</strong><small>{{ node.kind }} · {{ node.position?.path || node.filePath || '无路径' }}</small>
      </button>
    </template>

    <div class="divider" />
    <p class="section-label">DISPLAY OPTIONS</p>
    <label class="option"><span>显示关系证据标签</span><input type="checkbox" :checked="showEvidence" @change="emit('updateShowEvidence', ($event.target as HTMLInputElement).checked)" /></label>
    <div class="hint"><b>阅读提示</b><br />实线表示后端返回的已确认关系。没有证据的跨仓关系不会出现在画布中。</div>
  </aside>
</template>

<style scoped>
.panel{min-width:0;border:1px solid var(--border-1);border-radius:11px;background:var(--surface-1);box-shadow:var(--shadow-sm)}.navigator{padding:17px 12px;overflow:auto}.navigator header{display:flex;align-items:center;justify-content:space-between;padding:0 6px 12px}.navigator header b{font-size:13px}.navigator header small{color:var(--text-3)}.search{display:flex;align-items:center;gap:7px;margin:0 2px 16px;padding:9px 10px;border:1px solid var(--border-1);border-radius:7px;background:var(--surface-2);color:var(--text-3)}.search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text-1);font-size:12px}.section-label{margin:14px 8px 8px;color:var(--text-3);font:700 9px var(--font-mono);letter-spacing:.12em}.repository,.result{display:flex;width:100%;gap:9px;padding:10px;border:1px solid transparent;border-radius:9px;background:transparent;text-align:left;color:var(--text-1);cursor:pointer}.repository:hover,.result:hover{background:var(--surface-2)}.repository.selected{border-color:var(--border-accent);background:var(--accent-softer)}.repo-icon{display:grid;place-items:center;flex:0 0 28px;height:28px;border-radius:8px;background:var(--info-soft);color:var(--info);font-weight:800}.repo-copy{min-width:0;display:grid;gap:3px}.repo-copy strong,.result strong{overflow:hidden;text-overflow:ellipsis;font-size:12px}.repo-copy small,.result small{color:var(--text-3);font-size:9px}.repo-copy em{color:var(--text-3);font-size:10px;font-style:normal}.result{display:grid;gap:3px}.divider{height:1px;margin:15px 5px;background:var(--border-1)}.pending{padding:8px;color:var(--text-3);font-size:11px}.option{display:flex;align-items:center;justify-content:space-between;padding:8px;color:var(--text-2);font-size:11px}.option input{accent-color:var(--accent-500)}.hint{margin:11px 3px 2px;padding:11px;border-radius:8px;background:var(--surface-2);color:var(--text-3);font-size:10px;line-height:1.65}.hint b{color:var(--text-2)}
</style>
