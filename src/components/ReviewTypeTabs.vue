<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ active: 'skill' | 'wiki' | 'category' }>()
const auth = useAuthStore()
const tabs = computed(() => [
  { key: 'skill', label: 'Skill 审核', route: 'reviews', visible: auth.user?.permissions.includes('skill:review') ?? false },
  { key: 'wiki', label: 'Wiki 审核', route: 'wiki-reviews', visible: auth.user?.permissions.includes('wiki:review') ?? false },
  { key: 'category', label: '知识分类审核', route: 'wiki-category-review', visible: Boolean(auth.user?.roles.includes('ADMIN') && auth.user?.permissions.includes('admin:identity')) },
].filter(tab => tab.visible))
</script>

<template>
  <nav class="status-tabs review-type-tabs" role="tablist" aria-label="审核类型">
    <RouterLink v-for="tab in tabs" :key="tab.key" :to="{ name: tab.route }" role="tab" class="status-tab" :class="{ 'is-selected': props.active === tab.key }" :aria-selected="props.active === tab.key">{{ tab.label }}</RouterLink>
  </nav>
</template>

<style scoped>
.review-type-tabs { margin: 18px 0; }
.review-type-tabs .status-tab { text-decoration: none; }
</style>
