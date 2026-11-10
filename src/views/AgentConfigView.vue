<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listAgentProfiles } from '../api/agent-config.api'
import type { AgentProfile } from '../api/agent-config.api'
const router = useRouter(); const profiles = ref<AgentProfile[]>([]); const activeTab = ref<'ALL' | 'SYSTEM' | 'USER'>('ALL'); const loading = ref(true); const error = ref(''); const visibleProfiles = computed(() => activeTab.value === 'ALL' ? profiles.value : profiles.value.filter((profile) => profile.sourceType === activeTab.value))
onMounted(async () => { try { const list = await listAgentProfiles(); profiles.value = Array.isArray(list) ? list : [] } catch { error.value = 'Agent 配置加载失败，请稍后重试' } finally { loading.value = false } })
</script>
<template>
  <main class="agent-config-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">REUSABLE AGENT LIBRARY</p>
        <h1>Agent 配置中心</h1>
        <p>复用系统、共享与自己维护的 Agent Profile。</p>
      </div>
    </header>
    <nav class="status-tabs" role="tablist" aria-label="Agent 来源">
      <button
        v-for="tab in [['ALL', '全部'], ['SYSTEM', '系统内置'], ['USER', '共享 / 我的']]"
        :key="tab[0]"
        class="status-tab"
        role="tab"
        :aria-selected="activeTab === tab[0]"
        :class="{ 'is-selected': activeTab === tab[0] }"
        @click="activeTab = tab[0] as typeof activeTab"
      >
        {{ tab[1] }}
      </button>
    </nav>
    <p v-if="loading" class="ui-state">正在加载 Agent 配置…</p>
    <div v-else-if="error" class="ui-state ui-state--error" role="alert">{{ error }}</div>
    <div v-else-if="!visibleProfiles.length" class="ui-state">
      <strong class="ui-state__title">没有可用的 Agent 配置</strong>
      <span class="ui-state__desc">切换上方筛选，或联系管理员创建系统内置配置。</span>
    </div>
    <div v-else class="profile-grid">
      <button
        v-for="profile in visibleProfiles"
        :key="profile.code"
        type="button"
        class="profile-card"
        @click="router.push({ name: 'agent-config-detail', params: { code: profile.code } })"
      >
        <span class="profile-card__category">{{ profile.category }} · {{ profile.sourceType || 'USER' }}</span>
        <h2>{{ profile.name }}</h2>
        <code>{{ profile.code }}</code>
        <p>{{ profile.description }}</p>
        <footer>
          <span>v{{ profile.latestVersion?.versionNo ?? '—' }} {{ profile.latestVersion?.status ?? '' }}</span>
          <span>{{ profile.latestVersion?.skills?.length ?? 0 }} Skills</span>
          <span>{{ profile.latestVersion?.modelCode || '未配置模型' }}</span>
        </footer>
      </button>
    </div>
  </main>
</template>
<style scoped>.agent-config-page { width:100%; max-width:var(--page-max-width); margin:0 auto; }.page-head { margin-bottom:var(--space-5); }.eyebrow { color:var(--accent-500); font-size:var(--font-meta); letter-spacing:.14em; }.page-head h1 { margin:4px 0; }.page-head p:last-child { color:var(--text-2); }.profile-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:var(--card-gap); margin-top:var(--space-4); }.profile-card { padding:var(--card-padding); color:var(--text-1); text-align:left; border:1px solid var(--border-1); border-radius:var(--card-radius); background:var(--surface-1); cursor:pointer; }.profile-card:hover { border-color:var(--accent-500); }.profile-card h2 { margin:8px 0 4px; }.profile-card code,.profile-card p,.profile-card footer { color:var(--text-2); font-size:12px; }.profile-card p { min-height:40px; line-height:1.6; }.profile-card footer { display:flex; flex-wrap:wrap; gap:8px; padding-top:12px; border-top:1px solid var(--border-1); }.profile-card__category { color:var(--accent-500); font-size:var(--font-meta); text-transform:uppercase; }.error { color:var(--error); }</style>
