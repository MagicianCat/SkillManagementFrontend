/**
 * 全局主题切换（dark ↔ light）
 * - 通过 <html data-theme="..."> 驱动，CSS 变量在 tokens.css 按主题覆盖
 * - localStorage 持久化，启动时由 main.ts 调用 initTheme()
 * - 切换时派发主题事件，供 ECharts 等 JS 侧配色重渲
 */

export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'app-theme'
const THEME_EVENT = 'app:theme-change'

export function getStoredTheme(): ThemeName {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function getCurrentTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: ThemeName) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light'
  } else {
    // dark 为默认（:root），移除属性即可
    delete document.documentElement.dataset.theme
  }
}

export function setTheme(theme: ThemeName) {
  applyTheme(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* 忽略隐私模式写入失败 */
  }
  window.dispatchEvent(new CustomEvent<ThemeName>(THEME_EVENT, { detail: theme }))
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = getCurrentTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

/** 应用启动时调用：从 localStorage 还原主题（默认 dark） */
export function initTheme() {
  applyTheme(getStoredTheme())
}

/** 订阅主题变化（返回取消订阅函数） */
export function onThemeChange(handler: (theme: ThemeName) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ThemeName>).detail)
  window.addEventListener(THEME_EVENT, listener)
  return () => window.removeEventListener(THEME_EVENT, listener)
}

/** 读取当前生效的某个 CSS 变量值（供 ECharts 等 JS 取色） */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** 读取当前主题的图表配色（dark / light 各一套） */
export function chartTheme(): {
  palette: string[]
  axisLabel: string
  splitLine: string
  axisLine: string
  primary: string
  primaryArea: string
  donutBorder: string
  tooltipText: string
} {
  if (getCurrentTheme() === 'light') {
    return {
      palette: ['#2563eb', '#3b82f6', '#60a5fa', '#38bdf8', '#16a34a', '#7c3aed', '#f59e0b', '#94a3b8'],
      axisLabel: '#64748b',
      splitLine: 'rgba(100,116,139,0.14)',
      axisLine: 'rgba(100,116,139,0.30)',
      primary: '#2563eb',
      primaryArea: 'rgba(37,99,235,.12)',
      donutBorder: '#ffffff',
      tooltipText: '#1f2d3d',
    }
  }
  return {
    palette: ['#26c6ff', '#0fb5ec', '#60a5fa', '#4dd2ff', '#34d399', '#a78bfa', '#fbbf24', '#8b9bb5'],
    axisLabel: '#8b9bb5',
    splitLine: 'rgba(160,195,255,0.09)',
    axisLine: 'rgba(160,195,255,0.20)',
    primary: '#26c6ff',
    primaryArea: 'rgba(38,198,255,.12)',
    donutBorder: '#0d1420',
    tooltipText: '#e8eef7',
  }
}
