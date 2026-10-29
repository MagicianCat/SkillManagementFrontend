<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { http } from '../api/http'

const route = useRoute()
const assetId = computed(() => Number(route.params.assetId))
const info = ref<{ id: number; filename: string; sizeBytes: number } | null>(null)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  if (!Number.isSafeInteger(assetId.value) || assetId.value <= 0) { error.value = '工具包链接无效'; return }
  try { info.value = (await http.get(`/asdm-tool-assets/${assetId.value}`)).data }
  catch { error.value = '工具包不存在、已下架或当前账号无权下载' }
})
async function download() {
  if (!info.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    const response = await http.get<Blob>(`/asdm-tool-assets/${assetId.value}/download`, { responseType: 'blob', timeout: 120_000 })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url; link.download = info.value.filename
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch { error.value = '下载失败，请检查登录状态或稍后重试' }
  finally { busy.value = false }
}
</script>

<template>
  <main class="asdm-download"><h1>ASDM 工具包下载</h1><p v-if="error" role="alert">{{ error }}</p><template v-if="info"><p>{{ info.filename }} · {{ (info.sizeBytes / 1024 / 1024).toFixed(2) }} MB</p><button :disabled="busy" @click="download">{{ busy ? '正在下载…' : '下载工具包' }}</button></template></main>
</template>

<style scoped>.asdm-download{max-width:640px;margin:60px auto;padding:28px;border:1px solid var(--border-1);border-radius:12px;background:var(--surface-1);color:var(--text-1)}button{padding:10px 18px;border:0;border-radius:7px;background:var(--accent-400);color:white;cursor:pointer}button:disabled{opacity:.6}</style>
