<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { createAgentBatchDownload, downloadAgentBundle } from './api'
import type { AgentRecommendation, BatchDownloadResult } from './types'
import { saveBlobResponse } from '../../utils/download'

const props = defineProps<{ visible: boolean; runKey: string | null; recommendation: AgentRecommendation | null; defaultPlatform?: string; defaultOsType?: string }>()
const emit = defineEmits<{ 'update:visible': [boolean] }>()
const platform = ref('CODEBUDDY')
const osType = ref('ANY')
const busy = ref(false)
const result = ref<BatchDownloadResult | null>(null)
const platformOptions = [{ label: 'CodeBuddy', value: 'CODEBUDDY' }, { label: 'OpenCode', value: 'OPENCODE' }]
const osOptions = [{ label: '通用', value: 'ANY' }, { label: 'Windows', value: 'WINDOWS' }, { label: 'macOS', value: 'MACOS' }, { label: 'Linux', value: 'LINUX' }]
const title = computed(() => result.value ? (result.value.resultStatus === 'PARTIAL' ? '批量下载完成（部分成功）' : result.value.resultStatus === 'FAILED' ? '批量下载失败' : '批量下载完成') : '批量下载推荐 Skill')

watch(() => props.visible, (visible) => {
  if (visible) {
    result.value = null
    platform.value = props.defaultPlatform || props.recommendation?.items.find((item) => item.platform)?.platform || 'CODEBUDDY'
    osType.value = props.defaultOsType || props.recommendation?.items.find((item) => item.osType)?.osType || 'ANY'
  }
})

async function submit() {
  if (!props.runKey || busy.value) return
  busy.value = true
  try {
    result.value = await createAgentBatchDownload(props.runKey, platform.value, osType.value)
    if (result.value.status === 'AVAILABLE') {
      const response = await downloadAgentBundle(result.value.id)
      saveBlobResponse(response)
    } else if (result.value.resultStatus === 'FAILED') {
      await MessagePlugin.warning('没有可用于当前环境的 Skill')
    }
  } catch (error) {
    await MessagePlugin.error(error instanceof Error ? error.message : '批量下载失败')
  } finally { busy.value = false }
}
</script>

<template>
  <t-dialog :visible="visible" :header="title" width="620px" :confirm-btn="result ? null : { content: '确认下载', loading: busy }" cancel-btn="关闭" @confirm="submit" @cancel="emit('update:visible', false)" @close="emit('update:visible', false)">
    <div v-if="!result" class="batch-form">
      <p>确认下载环境后，系统会自动包含必需依赖；不满足兼容条件的 Skill 会单独列出。</p>
      <t-select v-model="platform" label="平台" :options="platformOptions" />
      <t-select v-model="osType" label="操作系统" :options="osOptions" />
      <div class="batch-skills"><span v-for="item in recommendation?.items || []" :key="item.skillKey">{{ item.displayName || item.skillKey }}</span></div>
    </div>
    <div v-else class="batch-result">
      <p>成功 {{ result.items.length }} 项，失败 {{ result.failures.length }} 项。</p>
      <ul v-if="result.failures.length"><li v-for="failure in result.failures" :key="failure.skillKey">{{ failure.displayName || failure.skillKey }}：{{ failure.message }}</li></ul>
      <t-button v-if="result.status === 'AVAILABLE'" theme="primary" @click="downloadAgentBundle(result.id).then(saveBlobResponse)">再次下载成功项</t-button>
    </div>
  </t-dialog>
</template>

<style scoped>
.batch-form{display:grid;gap:14px}.batch-form p,.batch-result p{margin:0;color:#64748b;font-size:13px;line-height:1.6}.batch-skills{display:flex;flex-wrap:wrap;gap:8px}.batch-skills span{padding:5px 9px;border-radius:999px;color:#b45309;background:#fff1e0;font-size:12px}.batch-result li{margin:8px 0;color:#9a3412;font-size:13px}
</style>
