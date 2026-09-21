<script setup lang="ts">
import { computed } from 'vue'
import type { DiffLine } from './mockContent'

const props = defineProps<{
  file: string
  lines: string[]
  typing: boolean
  diff: DiffLine[]
  diffVisible: boolean
}>()

const lang = computed(() => (props.file.endsWith('.java') ? 'java' : 'text'))

/** 极简语法高亮：关键字/注解/字符串/注释 着信号色，其余正文色。 */
function highlight(line: string): { cls: string; text: string }[] {
  if (!line.trim()) return [{ cls: 'plain', text: ' ' }]
  const trimmed = line.trim()
  if (trimmed.startsWith('//')) return [{ cls: 'tok-comment', text: line }]
  if (trimmed.startsWith('@')) return [{ cls: 'tok-anno', text: line }]
  const parts: { cls: string; text: string }[] = []
  const re = /("(?:[^"\\]|\\.)*")|(\b(?:public|private|final|class|return|var|new|void|static|import|package|this|throws)\b)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push({ cls: 'plain', text: line.slice(last, m.index) })
    parts.push({ cls: m[1] ? 'tok-string' : 'tok-keyword', text: m[0] })
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push({ cls: 'plain', text: line.slice(last) })
  return parts.length ? parts : [{ cls: 'plain', text: line }]
}
</script>

<template>
  <section class="ide" :data-lang="lang">
    <!-- 编辑器标签栏 -->
    <div class="ide-tabs">
      <span class="ide-tab on"><i class="file-dot" />{{ file }}</span>
      <span class="ide-status mono">{{ typing ? '生成中…' : '已生成' }}</span>
    </div>

    <!-- 代码区：行号 + 逐行生成 -->
    <div class="ide-body">
      <ol class="code-lines mono">
        <li v-for="(line, i) in lines" :key="i">
          <span class="ln">{{ i + 1 }}</span>
          <span class="lc"><span v-for="(seg, j) in highlight(line)" :key="j" :class="seg.cls">{{ seg.text }}</span></span>
        </li>
        <li v-if="typing" class="caret-row"><span class="ln">{{ lines.length + 1 }}</span><span class="caret" /></li>
      </ol>
    </div>

    <!-- 单文件 diff 块（安全修复） -->
    <div v-if="diffVisible && diff.length" class="diff-block">
      <div class="diff-head mono">diff -- {{ file }}</div>
      <ol class="diff-lines mono">
        <li v-for="(line, i) in diff" :key="i" :class="`d-${line.type}`">
          <span class="dl-text">{{ line.text }}</span>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.ide { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-2); overflow: hidden; }
.ide-tabs { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--border-1); background: var(--surface-1); }
.ide-tab { display: inline-flex; align-items: center; gap: 7px; padding: 3px 12px; font-size: 12px; color: var(--text-1); border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--surface-2); }
.ide-tab .file-dot { width: 7px; height: 7px; border-radius: 2px; background: var(--warning); }
.ide-status { font-size: 10px; color: var(--warning); }
.ide-tab.on ~ .ide-status { color: var(--warning); }
.ide-body { max-height: 300px; overflow-y: auto; padding: 10px 0; }
.code-lines { list-style: none; margin: 0; padding: 0; }
.code-lines li { display: flex; gap: 14px; padding: 0 14px; line-height: 1.55; font-size: 12px; white-space: pre; }
.ln { flex: none; width: 2ch; text-align: right; color: var(--text-4); user-select: none; }
.lc { flex: 1; color: var(--text-1); }
.tok-keyword { color: var(--accent-300); }
.tok-string { color: var(--success); }
.tok-comment { color: var(--text-3); font-style: italic; }
.tok-anno { color: var(--warning); }
.caret-row { display: flex; gap: 14px; padding: 0 14px; line-height: 1.55; }
.caret { width: 8px; height: 15px; background: var(--accent-400); animation: blink 0.9s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.diff-block { border-top: 1px solid var(--border-1); background: var(--surface-1); }
.diff-head { padding: 7px 12px; font-size: 11px; color: var(--text-3); border-bottom: 1px solid var(--border-1); }
.diff-lines { list-style: none; margin: 0; padding: 6px 0; max-height: 180px; overflow-y: auto; }
.diff-lines li { display: flex; padding: 0 14px; line-height: 1.5; font-size: 12px; white-space: pre; }
.diff-lines .d-ctx .dl-text { color: var(--text-3); }
.diff-lines .d-add { background: rgb(52 211 153 / 10%); }
.diff-lines .d-add .dl-text { color: var(--success); }
.diff-lines .d-del { background: rgb(248 113 113 / 10%); }
.diff-lines .d-del .dl-text { color: var(--error); }
.dl-text { flex: 1; }
</style>
