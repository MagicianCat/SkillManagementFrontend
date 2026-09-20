<script setup lang="ts">
import { ref, useSlots } from 'vue'

/**
 * 默认折叠的内容条：头部常驻（标题 + 徽标 + 摘要 + 展开/收起开关），点击展开详情。
 * 用于「文档产物」「Agent 执行轨迹」这类默认收纳、需要时再打开的面板。
 */
const props = withDefaults(defineProps<{
  title: string
  /** 头部右侧徽标文本（如 "2 个版本产物" / "实时"），空则不显示。 */
  badge?: string
  /** 徽标是否强调态（如"实时"亮绿）。 */
  badgeOn?: boolean
  /** 头部摘要文字（折叠时也可见的提示）。 */
  summary?: string
  /** 是否默认展开。 */
  defaultOpen?: boolean
}>(), { badge: '', badgeOn: false, summary: '', defaultOpen: false })

const open = ref(props.defaultOpen)
const slots = useSlots()
const toggle = () => { open.value = !open.value }
</script>

<template>
  <section class="collapsible panel" :class="{ open }">
    <button type="button" class="bar" :aria-expanded="open" @click="toggle">
      <span class="lead">
        <span class="title">{{ title }}</span>
        <span v-if="badge" class="badge" :class="{ on: badgeOn }">{{ badge }}</span>
        <span v-if="summary" class="summary">{{ summary }}</span>
      </span>
      <span class="toggle">
        <span class="toggle-text">{{ open ? '收起' : '展开详情' }}</span>
        <span class="chev" :class="{ down: open }">⌄</span>
      </span>
    </button>
    <div v-if="open && slots.default" class="body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--surface-1); box-shadow: var(--inner-highlight); overflow: hidden; }
.bar { display: flex; justify-content: space-between; align-items: center; gap: 14px; width: 100%; padding: 12px 18px; border: none; background: transparent; cursor: pointer; text-align: left; }
.lead { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.title { font-size: 13px; letter-spacing: 0.04em; color: var(--text-1); font-weight: 600; }
.badge { padding: 2px 9px; border-radius: var(--radius-full); font-size: 10px; border: 1px solid var(--border-2); color: var(--text-3); background: var(--surface-2); white-space: nowrap; }
.badge.on { color: var(--success); border-color: rgb(52 211 153 / 40%); background: var(--success-soft); }
.summary { font-size: 11px; color: var(--text-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toggle { display: flex; align-items: center; gap: 6px; flex: none; color: var(--text-3); }
.toggle-text { font-size: 12px; }
.chev { display: inline-block; font-size: 14px; line-height: 1; transition: transform var(--duration-base) var(--ease-out); }
.chev.down { transform: rotate(180deg); }
.bar:hover .toggle { color: var(--accent-400); }
.body { border-top: 1px solid var(--border-1); padding: 14px 18px; }
</style>
