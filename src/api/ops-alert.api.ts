import { http } from './http'

export interface OpsAlert {
  id: number; alert_no: string; rule_code: string; module: string; scope_code: string
  severity: 'P0' | 'P1' | 'P2'; state: 'OPEN' | 'ACKED' | 'RESOLVED'; title: string
  summary?: string; first_seen_at: string; last_seen_at: string; occurrence_count: number
  next_reminder_at?: string; version_no?: number; trace_id?: string; error_code?: string
  events?: Array<Record<string, unknown>>; deliveries?: Array<Record<string, unknown>>; actions?: Array<Record<string, unknown>>
}
export interface AlertRecipient { user_id: number; scope_code: string; min_severity: 'P0' | 'P1'; enabled: boolean; version_no: number; display_name: string; feishu_ready: boolean }
export interface AlertRule { rule_code: string; display_name: string; module: string; rule_type: string; severity: string; enabled: boolean; rule_config_json: string; recovery_config_json: string; version_no: number }
export interface AlertConfig { setting: { enabled: boolean; initialMinutes: number; factor: number; maxMinutes: number }; version: number; recipients: AlertRecipient[] }
export interface AlertPage { items: OpsAlert[]; totalElements: number; totalPages: number; size: number; number: number }
const root = '/admin/agent/operations'
export async function listOpsAlerts(params: { state?: string; severity?: string; module?: string; page?: number; size?: number } = {}) { return (await http.get<AlertPage>(`${root}/alerts`, { params })).data }
export async function getOpsAlert(id: number) { return (await http.get<OpsAlert>(`${root}/alerts/${id}`)).data }
export async function acknowledgeOpsAlert(id: number, expectedVersion: number, comment: string) { return (await http.post<OpsAlert>(`${root}/alerts/${id}/ack`, { expectedVersion, comment })).data }
export async function silenceOpsAlert(id: number, expectedVersion: number, silenceUntil: string, reason: string) { return (await http.post<OpsAlert>(`${root}/alerts/${id}/silence`, { expectedVersion, silenceUntil, reason })).data }
export async function resolveOpsAlert(id: number, expectedVersion: number, reason: string) { return (await http.post<OpsAlert>(`${root}/alerts/${id}/resolve`, { expectedVersion, reason })).data }
export async function getAlertConfig() { return (await http.get<AlertConfig>(`${root}/alert-config`)).data }
export async function updateAlertConfig(expectedVersion: number, setting: AlertConfig['setting']) { return (await http.put<AlertConfig>(`${root}/alert-config`, { expectedVersion, settingJson: JSON.stringify(setting) })).data }
export async function searchAlertCandidates(keyword: string) { return (await http.get<Array<{ id: number; display_name: string; feishu_ready: boolean }>>(`${root}/alert-recipients/candidates`, { params: { keyword } })).data }
export async function setAlertRecipient(userId: number, scopeCode: string, minSeverity: 'P0' | 'P1', enabled: boolean, expectedVersion?: number) { return (await http.put<AlertConfig>(`${root}/alert-recipients/${userId}`, { scopeCode, minSeverity, enabled, expectedVersion })).data }
export async function listAlertRules() { return (await http.get<AlertRule[]>(`${root}/alert-rules`)).data }
export async function updateAlertRule(rule: AlertRule) { return (await http.put<AlertRule[]>(`${root}/alert-rules/${rule.rule_code}`, { enabled: rule.enabled, ruleConfigJson: rule.rule_config_json, recoveryConfigJson: rule.recovery_config_json, expectedVersion: rule.version_no })).data }
export async function testAlertChannel(recipientUserIds: number[]) { await http.post(`${root}/alert-config/test`, { recipientUserIds }) }
