<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { listOpsAlerts, getOpsAlert, acknowledgeOpsAlert, silenceOpsAlert, resolveOpsAlert, type OpsAlert } from '../../api/ops-alert.api'
import { useAuthStore } from '../../stores/auth'
import { apiErrorInfo } from '../../api/http'
const route = useRoute(); const router = useRouter(); const auth = useAuthStore()
const items = ref<OpsAlert[]>([]); const detail = ref<OpsAlert | null>(null)
const total = ref(0); const page = ref(0); const state = ref(''); const severity = ref(''); const module = ref('')
const error = ref(''); const busy = ref(false); const reason = ref(''); const silenceHours = ref(1)
const canOperate = () => auth.user?.permissions.includes('admin:alert:operate') ?? false
async function load() {
  busy.value = true
  try {
    const result = await listOpsAlerts({ state: state.value || undefined, severity: severity.value || undefined, module: module.value || undefined, page: page.value, size: 20 })
    if (!Array.isArray(result?.items) || typeof result.totalElements !== 'number') throw new Error('告警接口返回的数据格式不正确')
    items.value = result.items
    total.value = result.totalElements
    error.value = ''
  } catch (cause) {
    const info = apiErrorInfo(cause)
    error.value = cause instanceof Error && cause.message === '告警接口返回的数据格式不正确'
      ? cause.message
      : `告警数据加载失败（${info.code}）${info.requestId ? ` · 诊断编号 ${info.requestId}` : ''}`
  } finally { busy.value = false }
}
async function open(id: number) { try { detail.value = await getOpsAlert(id); await router.replace({ query: { ...route.query, alertId: String(id) } }) } catch { await MessagePlugin.error('告警详情加载失败') } }
async function act(kind: 'ack' | 'silence' | 'resolve') { if (!detail.value) return; try { const id = detail.value.id, version = detail.value.version_no ?? 0; if (kind === 'ack') await acknowledgeOpsAlert(id, version, reason.value); if (kind === 'silence') await silenceOpsAlert(id, version, new Date(Date.now() + silenceHours.value * 3600_000).toISOString(), reason.value); if (kind === 'resolve') await resolveOpsAlert(id, version, reason.value); reason.value = ''; detail.value = await getOpsAlert(id); await load(); await MessagePlugin.success('告警已更新') } catch (error) { const info = apiErrorInfo(error); await MessagePlugin.error(`告警操作失败（${info.code}）${info.requestId ? ` · 诊断编号 ${info.requestId}` : ''}`) } }
function close() { detail.value = null; void router.replace({ query: { ...route.query, alertId: undefined } }) }
watch([state, severity, module], () => { page.value = 0; void load() })
onMounted(async () => { await load(); const id = Number(route.query.alertId); if (Number.isSafeInteger(id) && id > 0) await open(id) })
</script>
<template>
  <section class="panel-block">
    <header class="block-head"><div class="block-title"><i class="block-bar" />持久告警 <span class="block-sub">共 {{ total }} 条</span></div><t-button size="small" :loading="busy" @click="load">刷新</t-button></header>
    <t-alert v-if="error" theme="error" :message="error" />
    <div class="market-toolbar">
      <t-select v-model="state" placeholder="全部状态" clearable style="width: 150px"><t-option value="OPEN" label="待确认" /><t-option value="ACKED" label="已确认" /><t-option value="RESOLVED" label="已恢复" /></t-select>
      <t-select v-model="severity" placeholder="全部级别" clearable style="width: 130px"><t-option value="P0" label="P0" /><t-option value="P1" label="P1" /><t-option value="P2" label="P2" /></t-select>
      <t-input v-model="module" placeholder="模块编码" style="width: 180px" />
    </div>
    <t-loading v-if="busy && !items.length" text="正在加载告警…" />
    <div v-else-if="!items.length && !error" class="alert-empty">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <p>暂无符合条件的告警</p>
    </div>
    <article v-for="alert in items" :key="alert.id" class="panel-block">
      <t-tag :theme="alert.severity === 'P0' ? 'danger' : 'warning'">{{ alert.severity }}</t-tag>
      <a href="#" @click.prevent="open(alert.id)">{{ alert.alert_no || `#${alert.id}` }} · {{ alert.title }}</a> · {{ alert.state }}
      <p>{{ alert.module }} / {{ alert.scope_code }} · 发生 {{ alert.occurrence_count }} 次 · 最近 {{ new Date(alert.last_seen_at).toLocaleString('zh-CN') }}</p>
    </article>
    <t-pagination v-if="total > 20" :total="total" :current="page + 1" :page-size="20" @current-change="(value: number) => { page = value - 1; load() }" />
    <t-drawer :visible="Boolean(detail)" header="告警详情" size="600px" @close="close">
      <template v-if="detail">
        <h3>{{ detail.alert_no }} · {{ detail.title }}</h3><p>{{ detail.severity }} · {{ detail.state }} · {{ detail.module }}</p>
        <p>{{ detail.summary }}</p><p>规则：{{ detail.rule_code }} · 根因：{{ detail.error_code || '—' }}</p>
        <p>Trace ID：{{ detail.trace_id || '—' }} · 首次 {{ new Date(detail.first_seen_at).toLocaleString('zh-CN') }}</p>
        <div v-if="canOperate() && detail.state !== 'RESOLVED'">
          <t-textarea v-model="reason" placeholder="处理说明或恢复验证依据" /><t-input-number v-model="silenceHours" :min="1" :max="24" /> 小时
          <t-button v-if="detail.state === 'OPEN'" @click="act('ack')">确认</t-button>
          <t-button @click="act('silence')">静默</t-button><t-button theme="success" @click="act('resolve')">验证恢复</t-button>
        </div>
        <h4>关联事件</h4><p v-for="event in detail.events || []" :key="String(event.id)">{{ event.occurred_at }} · {{ event.event_type }} · {{ event.outcome }} · {{ event.error_code || '—' }}</p>
        <h4>通知记录</h4><p v-for="delivery in detail.deliveries || []" :key="String(delivery.id)">{{ delivery.kind }} · {{ delivery.status }} · 重试 {{ delivery.attempts }}</p>
        <h4>操作审计</h4><p v-for="action in detail.actions || []" :key="String(action.occurred_at)">{{ action.occurred_at }} · {{ action.action_type }}</p>
      </template>
    </t-drawer>
  </section>
</template>

<style scoped>
.panel-block {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  box-shadow: var(--inner-highlight);
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 600;
}
.block-title .block-bar {
  flex: none;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--accent-500);
}
.block-sub {
  margin-left: 8px;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 400;
}
.alert-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--text-3);
}
.alert-empty svg {
  opacity: 0.35;
}
.alert-empty p {
  margin: 0;
  font-size: 12px;
}
</style>
