<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { getAlertConfig, updateAlertConfig, searchAlertCandidates, setAlertRecipient, listAlertRules, updateAlertRule, testAlertChannel, type AlertConfig, type AlertRule } from '../../api/ops-alert.api'
const config = ref<AlertConfig | null>(null); const rules = ref<AlertRule[]>([])
const keyword = ref(''); const candidates = ref<Array<{ id: number; display_name: string; feishu_ready: boolean }>>([])
const scope = ref('ALL'); const severity = ref<'P0' | 'P1'>('P1'); const error = ref(false)
async function load() { try { config.value = await getAlertConfig(); rules.value = await listAlertRules(); error.value = false } catch { error.value = true } }
async function search() { candidates.value = await searchAlertCandidates(keyword.value) }
async function add(userId: number) { try { await setAlertRecipient(userId, scope.value, severity.value, true, 0); await load(); await MessagePlugin.success('收件人已添加') } catch { await MessagePlugin.error('收件人配置失败') } }
async function toggle(userId: number, rowScope: string, rowSeverity: 'P0' | 'P1', enabled: boolean, version: number) { try { await setAlertRecipient(userId, rowScope, rowSeverity, enabled, version); await load() } catch { await MessagePlugin.error('收件人配置失败') } }
async function saveConfig() { if (!config.value) return; try { config.value = await updateAlertConfig(config.value.version, config.value.setting); await MessagePlugin.success('通知设置已保存') } catch { await MessagePlugin.error('通知设置保存失败') } }
async function saveRule(rule: AlertRule) { try { rules.value = await updateAlertRule(rule); await MessagePlugin.success('规则已保存') } catch { await MessagePlugin.error('规则保存失败') } }
async function sendTest(userId: number) { try { await testAlertChannel([userId]); await MessagePlugin.success('测试卡片已发送') } catch { await MessagePlugin.error('测试发送失败或频率受限') } }
onMounted(() => void load())
</script>
<template>
  <section class="panel-block">
    <header class="block-head"><div class="block-title"><i class="block-bar" />告警设置</div><t-button size="small" @click="load">刷新</t-button></header>
    <t-alert v-if="error" theme="error" message="设置暂时不可用" />
    <template v-if="config">
      <t-alert v-if="!config.recipients.some(r => r.enabled && r.feishu_ready && (r.scope_code === 'ALL') && (r.min_severity === 'P0' || r.min_severity === 'P1'))" theme="warning" message="尚无可接收全部模块 P0 告警的飞书收件人" />
      <h3>通知策略</h3>
      <t-checkbox v-model="config.setting.enabled">启用飞书通知</t-checkbox>
      <p>首次间隔 <t-input-number v-model="config.setting.initialMinutes" :min="1" :max="60" /> 分钟 · 倍数 <t-input-number v-model="config.setting.factor" :min="1" :max="4" /> · 上限 <t-input-number v-model="config.setting.maxMinutes" :min="1" :max="240" /> 分钟 <t-button @click="saveConfig">保存</t-button></p>
      <h3>飞书收件人</h3>
      <p v-for="person in config.recipients" :key="`${person.user_id}:${person.scope_code}`">{{ person.display_name }} · {{ person.scope_code }} · {{ person.min_severity }} · {{ person.feishu_ready ? '可发送' : '飞书不可用' }}
        <t-button size="small" @click="toggle(person.user_id, person.scope_code, person.min_severity, !person.enabled, person.version_no)">{{ person.enabled ? '停用' : '启用' }}</t-button>
        <t-button size="small" @click="sendTest(person.user_id)">发送测试卡</t-button>
      </p>
      <div class="market-toolbar"><t-input v-model="keyword" placeholder="搜索有效用户" @enter="search" /><t-button @click="search">搜索</t-button><t-input v-model="scope" placeholder="ALL 或模块编码" /><t-select v-model="severity" style="width: 110px"><t-option value="P0" label="P0" /><t-option value="P1" label="P1" /></t-select></div>
      <p v-for="person in candidates" :key="person.id">{{ person.display_name }} · {{ person.feishu_ready ? '飞书可发送' : '未绑定飞书' }} <t-button v-if="person.feishu_ready" size="small" @click="add(person.id)">添加</t-button></p>
      <h3>告警规则</h3>
      <article v-for="rule in rules" :key="rule.rule_code" class="panel-block"><strong>{{ rule.display_name }}</strong> · {{ rule.rule_code }} · {{ rule.severity }}
        <t-checkbox v-model="rule.enabled">启用</t-checkbox><p>触发配置</p><t-textarea v-model="rule.rule_config_json" :autosize="{ minRows: 2, maxRows: 5 }" /><p>恢复配置</p><t-textarea v-model="rule.recovery_config_json" :autosize="{ minRows: 2, maxRows: 5 }" /><t-button size="small" @click="saveRule(rule)">保存规则</t-button>
      </article>
    </template>
  </section>
</template>
