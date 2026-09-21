<script setup lang="ts">
import { computed } from 'vue'
import type { TestCaseProgress } from './mockEngine'

const props = defineProps<{ cases: TestCaseProgress[] }>()

const passed = computed(() => props.cases.filter((c) => c.status === 'PASSED').length)
const total = computed(() => props.cases.length)
const pct = computed(() => (total.value ? Math.round((passed.value / total.value) * 100) : 0))
const allPassed = computed(() => total.value > 0 && passed.value === total.value)
</script>

<template>
  <section class="test-progress">
    <div class="head">
      <span class="title">用例执行进度</span>
      <span class="count mono">{{ passed }} / {{ total }} 通过</span>
    </div>
    <div class="bar"><i class="fill" :style="{ width: pct + '%' }" /></div>

    <ol class="case-list">
      <li v-for="c in cases" :key="c.id" :class="`st-${c.status.toLowerCase()}`">
        <span class="st-icon" aria-hidden="true">
          <svg v-if="c.status === 'PASSED'" viewBox="0 0 12 12" width="11" height="11"><path d="M2 6.5 4.8 9 10 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <i v-else-if="c.status === 'RUNNING'" class="spinner" />
          <i v-else class="pending-dot" />
        </span>
        <span class="case-id mono">{{ c.id }}</span>
        <span class="case-title">{{ c.title }}</span>
        <span class="case-st mono">{{ c.status === 'PASSED' ? 'PASS' : c.status === 'RUNNING' ? 'RUN' : 'WAIT' }}</span>
      </li>
    </ol>

    <p v-if="allPassed" class="summary mono">全部 {{ total }} 条用例通过 · 通过率 100%</p>
  </section>
</template>

<style scoped>
.test-progress { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-2); padding: 12px 14px; }
.head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.title { font-size: 12px; color: var(--text-2); font-weight: 600; }
.count { font-size: 12px; color: var(--success); font-weight: 600; }
.bar { height: 5px; border-radius: var(--radius-full); background: var(--surface-2); overflow: hidden; margin-bottom: 12px; }
.bar .fill { display: block; height: 100%; background: var(--success); border-radius: var(--radius-full); transition: width 0.4s ease; box-shadow: 0 0 8px var(--success); }
.case-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; max-height: 260px; overflow-y: auto; }
.case-list li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--surface-1); }
.st-icon { flex: none; width: 15px; height: 15px; display: grid; place-items: center; }
.st-passed .st-icon { color: var(--success); }
.spinner { width: 11px; height: 11px; border: 2px solid var(--border-2); border-top-color: var(--warning); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pending-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-4); }
.case-id { flex: none; font-size: 11px; color: var(--accent-300); }
.case-title { flex: 1; min-width: 0; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.case-st { flex: none; font-size: 10px; font-weight: 600; }
.st-passed .case-st { color: var(--success); }
.st-running .case-st { color: var(--warning); }
.st-pending .case-st { color: var(--text-4); }
.st-passed { border-color: rgb(52 211 153 / 30%); }
.st-running { border-color: rgb(251 191 36 / 40%); }
.summary { margin: 10px 0 0; padding: 7px 10px; text-align: center; font-size: 11px; color: var(--success); border: 1px solid rgb(52 211 153 / 35%); border-radius: var(--radius-sm); background: var(--success-soft); }
</style>
