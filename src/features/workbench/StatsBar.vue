<script setup lang="ts">
defineProps<{ completed: number; total: number; activeAgents: number; pendingIssues: number; lastEventAt: string }>()
</script>

<template>
  <footer class="stats-bar">
    <span class="stat">已完成阶段 <b class="mono">{{ completed }}/{{ total }}</b></span>
    <span class="stat">活跃 Agent <b class="mono">{{ activeAgents }}</b></span>
    <span class="stat" :class="{ warn: pendingIssues > 0 }">待处理问题 <b class="mono">{{ pendingIssues }}</b></span>
    <span class="stat right">最近更新 <b class="mono">{{ lastEventAt || '—' }}</b></span>
  </footer>
</template>

<style scoped>
.stats-bar { display: flex; align-items: center; gap: 22px; padding: 10px 18px; border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); }
.stat { font-size: 12px; color: var(--text-3); }
.stat b { margin-left: 5px; color: var(--text-1); font-weight: 600; }
.stat.warn b { color: var(--warning); }
.stat.right { margin-left: auto; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
@media (max-width: 720px) { .stats-bar { flex-wrap: wrap; gap: 12px; } .stat.right { margin-left: 0; } }
</style>
