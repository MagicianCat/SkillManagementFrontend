<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import type { NavigationItem } from '../types/navigation'

const appStore = useAppStore()

const navigation = computed<NavigationItem[]>(() => {
  const items: NavigationItem[] = [
    { label: '首页', routeName: 'home' },
    { label: 'Skill 目录', routeName: 'skills' },
    { label: '生命周期', routeName: 'workflows' },
  ]

  if (appStore.adminEnabled) {
    items.push({ label: '管理中心', routeName: 'admin', adminOnly: true })
  }

  return items
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" :to="{ name: 'home' }"
        >Skill Management</RouterLink
      >
      <nav aria-label="主导航">
        <RouterLink
          v-for="item in navigation"
          :key="item.routeName"
          class="nav-link"
          :to="{ name: item.routeName }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>
