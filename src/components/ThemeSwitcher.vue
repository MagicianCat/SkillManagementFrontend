<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { getCurrentTheme, onThemeChange, toggleTheme, type ThemeName } from '../utils/theme'

const theme = ref<ThemeName>(getCurrentTheme())
const off = onThemeChange((t) => { theme.value = t })
onBeforeUnmount(off)

function onToggle() {
  theme.value = toggleTheme()
}
</script>

<template>
  <button
    class="theme-switcher"
    :aria-label="theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
    :title="theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
    @click="onToggle"
  >
    <!-- 月亮：暗色主题时显示，点击切到亮色 -->
    <svg
      v-if="theme === 'dark'"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
    <!-- 太阳：亮色主题时显示，点击切到暗色 -->
    <svg
      v-else
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  </button>
</template>

<style scoped>
.theme-switcher {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-2);
  background: transparent;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.theme-switcher:hover {
  border-color: var(--border-accent);
  color: var(--accent-400);
  background: var(--accent-softer);
  box-shadow: 0 0 12px var(--accent-glow);
}
.theme-switcher:active {
  transform: scale(0.92);
}
</style>
