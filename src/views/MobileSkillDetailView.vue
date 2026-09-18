<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { getSkill, getSkillVersions, downloadSkillVersion } from '../api/skills.api'
import { saveBlobResponse } from '../utils/download'
import type { SkillView, VersionView } from '../types/skill'
import { getSkillInstallGuide } from '../utils/skill-installation'

const route = useRoute()
const router = useRouter()
const platformValues = ['CODEBUDDY', 'OPENCODE'] as const
const osTypeValues = ['ANY', 'WINDOWS', 'MACOS', 'LINUX'] as const

function queryValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = Array.isArray(value) ? String(value[0] ?? '').toUpperCase() : String(value ?? '').toUpperCase()
  return allowed.includes(normalized as T) ? normalized as T : fallback
}

const skill = ref<SkillView | null>(null)
const versions = ref<VersionView[]>([])
const platform = ref(queryValue(route.query.platform, platformValues, 'CODEBUDDY'))
const osType = ref(queryValue(route.query.osType, osTypeValues, 'ANY'))
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const selectedVersionId = ref<number | null>(null)
const selectedVersion = computed(() => versions.value.find(v => v.id === selectedVersionId.value) ?? null)
const skillKey = computed(() => String(route.params.skillKey))
const installGuide = computed(() => getSkillInstallGuide(platform.value, osType.value, skillKey.value))

async function load() {
  try {
    const key = String(route.params.skillKey)
    const [skillResult, versionResult] = await Promise.all([getSkill(key), getSkillVersions(key)])
    skill.value = skillResult
    versions.value = versionResult
    selectedVersionId.value = versionResult.find(v => ['PUBLISHED', 'DEPRECATED'].includes(v.lifecycleStatus))?.id ?? versionResult[0]?.id ?? null
  } catch (cause: unknown) {
    error.value = axios.isAxiosError(cause) ? String(cause.response?.data?.message ?? 'Skill 加载失败') : 'Skill 加载失败'
  } finally { loading.value = false }
}

async function download() {
  if (!selectedVersion.value || !['PUBLISHED', 'DEPRECATED'].includes(selectedVersion.value.lifecycleStatus)) return
  busy.value = true; error.value = ''
  try { saveBlobResponse(await downloadSkillVersion(selectedVersion.value.id, platform.value, osType.value)) }
  catch (cause: unknown) { error.value = axios.isAxiosError(cause) ? String(cause.response?.data?.message ?? '下载失败') : '下载失败' }
  finally { busy.value = false }
}
onMounted(load)
watch(() => [route.query.platform, route.query.osType], ([nextPlatform, nextOsType]) => {
  platform.value = queryValue(nextPlatform, platformValues, 'CODEBUDDY')
  osType.value = queryValue(nextOsType, osTypeValues, 'ANY')
})
</script>

<template>
  <main class="mobile-skill-page">
    <div class="mobile-brand"><span class="mobile-brand__mark">研</span><strong>研途助手</strong></div>
    <t-button variant="text" @click="router.back()">‹ 返回</t-button>
    <div v-if="loading" class="mobile-state">正在加载…</div>
    <t-alert v-else-if="error && !skill" theme="error" :message="error" />
    <template v-else-if="skill">
      <t-card :bordered="false" class="mobile-skill-card">
        <t-tag theme="warning" variant="light">SKILL</t-tag>
        <h1>{{ skill.displayName }}</h1>
        <p class="skill-key">{{ skill.skillKey }}</p>
        <p>{{ skill.description || '暂无描述' }}</p>
      </t-card>
      <t-card title="选择下载目标" :bordered="false" class="mobile-skill-card">
        <t-select v-model="platform" label="平台" :options="[{label:'CodeBuddy',value:'CODEBUDDY'},{label:'OpenCode',value:'OPENCODE'}]" />
        <t-select v-model="osType" label="操作系统" :options="[{label:'通用',value:'ANY'},{label:'Windows',value:'WINDOWS'},{label:'macOS',value:'MACOS'},{label:'Linux',value:'LINUX'}]" />
        <t-select v-model="selectedVersionId" label="版本" :options="versions.map(v => ({ label: v.version ? `v${v.version}` : `候选 ${v.candidateVersion ?? ''}`, value: v.id }))" />
        <div class="install-guide" aria-live="polite">
          <strong>解压后放置位置</strong>
          <span class="install-guide__target">{{ installGuide.platformLabel }} · {{ installGuide.osLabel }}</span>
          <div v-for="location in installGuide.locations" :key="location.scope" class="install-location">
            <span>{{ location.label }}</span>
            <code>{{ location.path }}</code>
          </div>
          <small>{{ installGuide.note }}</small>
        </div>
        <t-alert v-if="error" theme="error" :message="error" />
        <t-button block theme="primary" :loading="busy" :disabled="!selectedVersion || !['PUBLISHED','DEPRECATED'].includes(selectedVersion.lifecycleStatus)" @click="download">下载 Skill 包</t-button>
      </t-card>
    </template>
  </main>
</template>

<style scoped>
.mobile-skill-page{min-height:100vh;padding:16px;background:var(--surface-1);color:var(--text-1)}.mobile-brand{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--accent-500);font-size:16px}.mobile-brand__mark{display:grid;width:28px;height:28px;place-items:center;border-radius:8px;color:var(--text-on-accent);background:var(--accent-500);font-weight:800}.mobile-skill-card{margin-top:12px;border-radius:14px;background:var(--surface-1);backdrop-filter:blur(12px)}.mobile-skill-card h1{margin:12px 0 4px;font-size:24px}.mobile-skill-card p{line-height:1.6;color:var(--text-2)}.skill-key{font-size:12px;color:var(--accent-500)!important}.mobile-state{padding:48px 0;text-align:center;color:var(--text-2)}.mobile-skill-card :deep(.t-select){margin-bottom:12px}.mobile-skill-card :deep(.t-button--primary){background:var(--accent-500);border-color:var(--accent-500)}
.install-guide{display:grid;gap:8px;margin:4px 0 14px;padding:13px;border:1px solid var(--border-1);border-radius:8px;background:var(--surface-1);color:var(--text-1)}.install-guide strong{font-size:13px}.install-guide__target{color:var(--accent-500);font-size:12px}.install-location{display:grid;gap:4px}.install-location span{color:var(--text-2);font-size:11px}.install-location code{overflow-wrap:anywhere;padding:7px 8px;border-radius:5px;background:var(--surface-2);color:var(--accent-300);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.install-guide small{color:var(--text-3);font-size:11px;line-height:1.5}
</style>
