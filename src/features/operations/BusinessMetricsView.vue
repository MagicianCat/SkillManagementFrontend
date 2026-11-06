<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getBusinessMetrics, getBusinessTrace, type BusinessMetrics } from '../../api/ops-metrics.api'
const modules = ['AGENT','AGENT_INTENT','EMBEDDING','RERANK','DSH_mcp','TELEMETRY','ASDM_GITLAB','COLLAB_GROUP','COLLAB_REQUIREMENT','FEISHU']
const selected = ref('AGENT'); const window = ref('PT1H'); const metrics = ref<BusinessMetrics | null>(null); const error = ref(false)
const traceId = ref(''); const trace = ref<Array<Record<string, unknown>>>([])
async function load() { try { metrics.value = await getBusinessMetrics(selected.value, window.value); error.value = false } catch { error.value = true } }
async function loadTrace() { if (!traceId.value) return; try { trace.value = (await getBusinessTrace(traceId.value)).events } catch { trace.value = [] } }
watch([selected, window], () => void load()); onMounted(() => void load())
</script>
<template>
  <section class="panel-block">
    <header class="block-head"><div class="block-title"><i class="block-bar" />业务链路</div><t-button size="small" @click="load">刷新</t-button></header>
    <div class="market-toolbar"><t-select v-model="selected" style="width: 210px"><t-option v-for="item in modules" :key="item" :value="item" :label="item" /></t-select><t-select v-model="window" style="width: 130px"><t-option value="PT15M" label="15 分钟" /><t-option value="PT1H" label="1 小时" /><t-option value="P1D" label="24 小时" /></t-select></div>
    <t-alert v-if="error" theme="error" message="业务指标暂时不可用" />
    <template v-if="metrics"><p v-if="metrics.dataStatus === 'NO_DATA'">该窗口暂无有效样本</p><div v-else class="metric-grid four"><div class="metric-card"><span class="metric-label">调用</span><b class="metric-num">{{ metrics.summary.requests }}</b></div><div class="metric-card"><span class="metric-label">成功</span><b class="metric-num">{{ metrics.summary.success }}</b></div><div class="metric-card"><span class="metric-label">失败率</span><b class="metric-num">{{ metrics.summary.failureRate === null ? '—' : `${(metrics.summary.failureRate * 100).toFixed(1)}%` }}</b></div><div class="metric-card"><span class="metric-label">降级率</span><b class="metric-num">{{ metrics.summary.degradationRate === null ? '—' : `${(metrics.summary.degradationRate * 100).toFixed(1)}%` }}</b></div></div>
      <p v-if="metrics.dataStatus === 'OK'">调用延迟 P95 {{ metrics.summary.p95Ms ?? '—' }} ms · P99 {{ metrics.summary.p99Ms ?? '—' }} ms（固定桶估算）</p><h3>错误分类</h3><p v-for="group in metrics.errorGroups" :key="group.error_code">{{ group.error_code }} · {{ group.count }}</p>
      <h3>分钟趋势</h3><p v-for="point in metrics.series.slice(-20)" :key="point.at">{{ new Date(point.at).toLocaleString('zh-CN') }} · {{ point.requests }} 次 · 失败 {{ point.failed }} · 降级 {{ point.degraded }}</p>
    </template>
    <h3>业务时间线</h3><div class="market-toolbar"><t-input v-model="traceId" placeholder="Trace ID" @enter="loadTrace" /><t-button @click="loadTrace">查询</t-button></div><p v-for="event in trace" :key="String(event.id)">{{ event.occurred_at }} · {{ event.module }} · {{ event.event_type }} · {{ event.outcome }} · {{ event.error_code || '—' }}</p>
  </section>
</template>
