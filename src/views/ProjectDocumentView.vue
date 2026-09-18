<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProjectDocument, type ProjectDocument } from '../api/projects.api'

const route = useRoute()
const router = useRouter()
const document = ref<ProjectDocument>()
const error = ref('')

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
    <button type="button" @click="router.push({ name: 'projects' })">返回项目组</button>
    <p v-if="error" class="muted">{{ error }}</p>
    <template v-else-if="document">
      <p class="muted">{{ document.documentType }} · {{ document.projectKey }}</p>
      <h1>{{ document.title }}</h1>
      <p class="muted" v-if="document.draft">Agent revision {{ document.draft.revisionNo }} · {{ document.draft.sourceType }}</p>
      <article class="markdown-output">{{ document.draft?.markdownContent || document.published?.markdownContent || '暂无正文' }}</article>
    </template>
    <p v-else class="muted">文档加载中…</p>
  </main>
</template>

<style scoped>
.document-detail { max-width: 960px; margin: 0 auto; }
.markdown-output { margin-top: 20px; padding: 20px; white-space: pre-wrap; line-height: 1.7; background: var(--surface-1); backdrop-filter: blur(12px); border-radius: 10px; }
.muted { color: var(--text-2); }
</style>
