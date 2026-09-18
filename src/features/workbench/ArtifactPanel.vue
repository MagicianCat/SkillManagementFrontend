<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { WorkflowArtifact, WorkflowStage } from '../../types/workflow'

const props = defineProps<{ stage: WorkflowStage | null; projectKey?: string }>()
const router = useRouter()

type Tab = 'preview' | 'diff' | 'issues'
const tab = ref<Tab>('preview')

const artifacts = computed<WorkflowArtifact[]>(() => props.stage?.artifacts ?? [])
const sorted = computed(() => [...artifacts.value].sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0)))
const selectedId = ref<string | number | null>(null)
watch(sorted, (list) => { if (!list.some((a) => a.id === selectedId.value)) selectedId.value = list[0]?.id ?? null }, { immediate: true })
const current = computed(() => sorted.value.find((a) => a.id === selectedId.value) ?? sorted.value[0] ?? null)
const previous = computed(() => {
  if (!current.value) return null
  return sorted.value.find((a) => (a.revision ?? 0) === (current.value!.revision ?? 0) - 1) ?? null
})
const issues = computed(() => current.value?.reviewIssues ?? [])
/** 产物文档链接：artifact.id 即 project_document_id（后端 ArtifactView 首字段）。
 *  用 router.resolve 生成真实 href 的原生链接并新标签打开，避免 SPA 内部导航被拦截导致点不动。 */
const docHref = computed(() => {
  if (!props.projectKey || !current.value) return ''
  const id = Number(current.value.id)
  if (!Number.isFinite(id)) return ''
  return router.resolve({ name: 'project-document', params: { projectKey: props.projectKey, documentId: id } }).href
})
</script>

<template>
  <section class="artifact panel">
    <header class="panel-head">
      <h3>文档修订 / 产物</h3>
      <nav class="tabs">
        <button type="button" :class="{ on: tab === 'preview' }" @click="tab = 'preview'">预览</button>
        <button type="button" :class="{ on: tab === 'diff' }" @click="tab = 'diff'">Diff</button>
        <button type="button" :class="{ on: tab === 'issues' }" @click="tab = 'issues'">评审意见<span v-if="issues.length" class="badge">{{ issues.length }}</span></button>
      </nav>
    </header>

    <div v-if="sorted.length" class="revisions" data-testid="document-revision">
      <button v-for="artifact in sorted" :key="artifact.id" type="button" class="rev-chip mono" :class="{ on: artifact.id === current?.id }" @click="selectedId = artifact.id">
        {{ artifact.name }} · Revision {{ artifact.revision ?? artifact.revisionId ?? '—' }}
      </button>
    </div>

    <div class="pane">
      <template v-if="current">
        <div v-if="tab === 'preview'" class="preview">
          <h4>
            <a v-if="docHref" :href="docHref" target="_blank" rel="noopener" class="doc-link">{{ current.name }}</a>
            <template v-else>{{ current.name }}</template>
            <span class="mono rev">Revision {{ current.revision ?? '—' }}</span>
          </h4>
          <p class="muted">状态 {{ current.status || '—' }} · RevisionId {{ current.revisionId ?? '—' }}</p>
          <a v-if="docHref" :href="docHref" target="_blank" rel="noopener" class="open-doc-btn">打开文档 ↗</a>
          <p v-else class="muted">完整内容请在项目文档中查看。</p>
        </div>
        <div v-else-if="tab === 'diff'" class="diff">
          <p class="compare mono">Revision #{{ previous?.revision ?? '—' }} ↔ #{{ current.revision ?? '—' }}</p>
          <p class="muted">变更统计暂无数据 — 后端未提供逐行 diff。</p>
        </div>
        <div v-else class="issues">
          <ul v-if="issues.length">
            <li v-for="(issue, i) in issues" :key="i"><span class="sev">提示</span>{{ issue }}</li>
          </ul>
          <p v-else class="muted">当前 Revision 暂无评审意见。</p>
        </div>
      </template>
      <p v-else class="empty muted">当前阶段暂无产物。</p>
    </div>
  </section>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); min-height: 0; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; flex-wrap: wrap; }
.panel-head h3 { font-size: 13px; letter-spacing: 0.06em; color: var(--text-2); font-weight: 600; }
.tabs { display: flex; gap: 4px; }
.tabs button { padding: 5px 12px; font-size: 12px; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text-3); cursor: pointer; }
.tabs button.on { color: var(--accent-300); background: var(--accent-softer); border-color: var(--border-accent); }
.badge { margin-left: 5px; padding: 0 5px; border-radius: var(--radius-full); background: var(--error-soft); color: var(--error); font-size: 10px; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.revisions { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.rev-chip { padding: 5px 10px; font-size: 11px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text-2); cursor: pointer; }
.rev-chip.on { color: var(--accent-300); border-color: var(--border-accent); background: var(--accent-softer); }
.pane { flex: 1; overflow-y: auto; border-top: 1px solid var(--border-1); padding-top: 10px; min-height: 0; }
.preview h4 { margin: 0 0 6px; font-size: 14px; color: var(--text-1); }
.doc-link { color: var(--text-1); text-decoration: none; }
.doc-link:hover { color: var(--accent-300); text-decoration: underline; }
.open-doc-btn { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #fff; background: var(--accent-600); border: none; border-radius: var(--radius-sm); text-decoration: none; }
.open-doc-btn:hover { background: var(--accent-500); box-shadow: var(--shadow-accent); }
.rev { font-size: 11px; color: var(--accent-300); }
.muted { color: var(--text-3); font-size: 12px; margin: 4px 0; }
.compare { font-size: 12px; color: var(--accent-300); margin: 0 0 8px; }
.issues ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.issues li { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--text-2); padding: 8px 10px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-2); }
.sev { flex: none; padding: 1px 7px; border-radius: var(--radius-full); font-size: 10px; background: var(--warning-soft); color: var(--warning); }
.empty { padding: 16px 0; }
</style>
