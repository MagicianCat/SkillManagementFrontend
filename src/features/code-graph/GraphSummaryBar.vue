<script setup lang="ts">
import { computed } from 'vue'
import type { CodeGraphOverview } from '../../types/code-graph'

const props = defineProps<{ overview: CodeGraphOverview; confirmedRelations: number }>()
const values = computed(() => [
  { label: '关联仓库', value: props.overview.counts?.repositories ?? props.overview.repositories.length, unit: '个', icon: '▣', tone: 'blue' },
  { label: '已确认跨仓关系', value: props.confirmedRelations, unit: '条', icon: '⇄', tone: 'green' },
  { label: '索引文件', value: props.overview.counts?.files ?? 0, unit: '个', icon: '▤', tone: 'purple' },
  { label: '代码符号 / 关系', value: `${props.overview.counts?.symbols ?? 0} / ${props.overview.counts?.relations ?? 0}`, unit: '', icon: '⌘', tone: 'amber' },
])
</script>

<template>
  <section class="summary" aria-label="代码图谱指标">
    <article v-for="item in values" :key="item.label" class="metric">
      <div><span>{{ item.label }}</span><strong>{{ item.value }} <small>{{ item.unit }}</small></strong></div>
      <i :class="item.tone" aria-hidden="true">{{ item.icon }}</i>
    </article>
  </section>
</template>

<style scoped>
.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{display:flex;align-items:center;justify-content:space-between;min-width:0;padding:15px 18px;border:1px solid var(--border-1);border-radius:11px;background:var(--surface-1);box-shadow:var(--shadow-sm)}.metric span{font-size:11px;color:var(--text-3)}.metric strong{display:block;margin-top:5px;font-size:23px;line-height:1.15;color:var(--text-1);font-variant-numeric:tabular-nums}.metric small{font-size:10px;color:var(--text-3);font-weight:500}.metric i{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;font-style:normal;font-size:17px}.blue{color:var(--info);background:var(--info-soft)}.green{color:var(--success);background:var(--success-soft)}.purple{color:var(--purple);background:rgb(167 139 250 / 12%)}.amber{color:var(--warning);background:var(--warning-soft)}@media(max-width:900px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.summary{grid-template-columns:1fr}.metric strong{font-size:20px}}
</style>
