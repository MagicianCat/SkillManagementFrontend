<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProjectDocument, type ProjectDocument } from '../api/projects.api'
import MarkdownView from '../components/MarkdownView.vue'

const route = useRoute()
const router = useRouter()
const document = ref<ProjectDocument>()
const error = ref('')

const markdown = computed(() => document.value?.draft?.markdownContent || document.value?.published?.markdownContent || '')

/** 返回该项目的 agent 工作流（工作台会自动解析当前 run）。 */
function backToWorkflow() {
  router.push({ name: 'project-workspace', params: { projectId: String(route.params.projectKey) } })
}

onMounted(async () => {
  try {
    document.value = await getProjectDocument(String(route.params.projectKey), Number(route.params.documentId))
  } catch (cause) {
    error.value = String(cause)
  }
})
</script>

<template>
  <main class="page-shell document-detail">
    <button type="button" class="back-btn" @click="backToWorkflow">← 返回工作流</button>
    <p v-if="error" class="muted">{{ error }}</p>
    <template v-else-if="document">
      <p class="muted">{{ document.documentType }} · {{ document.projectKey }}</p>
      <h1>{{ document.title }}</h1>
      <p class="muted" v-if="document.draft">Agent revision {{ document.draft.revisionNo }} · {{ document.draft.sourceType }}</p>
      <MarkdownView v-if="markdown" :content="markdown" class="markdown-content" />
      <p v-else class="muted">暂无正文</p>
    </template>
    <p v-else class="muted">文档加载中…</p>
  </main>
</template>

<style scoped>
.document-detail { max-width: 960px; margin: 0 auto; }
.back-btn { padding: 7px 14px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); color: var(--text-1); background: var(--surface-1); cursor: pointer; font-size: 13px; transition: border-color var(--duration-fast), color var(--duration-fast); }
.back-btn:hover { color: var(--accent-400); border-color: var(--border-accent); }
.markdown-content { margin-top: 20px; padding: 24px; line-height: 1.7; background: var(--surface-1); backdrop-filter: blur(12px); border: 1px solid var(--border-1); border-radius: 10px; }
.muted { color: var(--text-2); }
</style>
