import { test, expect } from '@playwright/test'

test('projects setup validates agent team then starts requirement workflow', async ({ page }) => {
  const nodes = [
    { stageKey: 'REQUIREMENT', nodeKey: 'clarifier', nodeName: 'Clarifier', agentProfileCode: 'requirement-clarifier', agentProfileVersionId: 101 },
    { stageKey: 'REQUIREMENT', nodeKey: 'writer', nodeName: 'Writer', agentProfileCode: 'requirement-writer', agentProfileVersionId: 102 },
    { stageKey: 'REQUIREMENT', nodeKey: 'reviewer', nodeName: 'Reviewer', agentProfileCode: 'requirement-reviewer', agentProfileVersionId: 103 },
  ]
  const config = { projectKey: 'demo', status: 'DRAFT', sourceType: 'SYSTEM_PRESET', nodes }
  const profiles = nodes.map((node) => ({ code: node.agentProfileCode, name: node.nodeName, category: 'requirement', sourceType: 'SYSTEM', description: '', latestVersion: { id: node.agentProfileVersionId, versionNo: 1, status: 'PUBLISHED', systemPrompt: `${node.nodeName} prompt`, modelCode: 'fixture', skills: [], tools: [] } }))
  const stages = [{ id: 'req', key: 'REQUIREMENT', name: 'Requirement', status: 'HUMAN_REQUIRED', currentAgent: 'Reviewer', agents: [{ id: 'c', key: 'clarifier', name: 'Clarifier', status: 'COMPLETED', agentRunId: 11 }, { id: 'w', key: 'writer', name: 'Writer', status: 'COMPLETED', agentRunId: 12 }, { id: 'r', key: 'reviewer', name: 'Reviewer', status: 'COMPLETED', agentRunId: 13 }], artifacts: [{ id: 'a', name: '需求说明书', revision: 1, reviewIssues: [] }] }]
  let setupState = { ...config }; let runBody: Record<string, unknown> | undefined

  await page.route('**/api/v1/auth/session', async (route) => route.fulfill({ json: { accessToken: 'fixture', user: { id: 1, displayName: 'Fixture', permissions: ['skill:browse'] } } }))
  await page.route('**/api/v1/auth/feishu/document-access', async (route) => route.fulfill({ json: { status: 'NOT_AVAILABLE' } }))
  await page.route(/\/api\/v1\/projects(\?.*)?$/, async (route) => route.fulfill({ json: { items: [{ projectKey: 'demo', name: 'Demo', role: 'OWNER', status: 'ACTIVE' }] } }))
  await page.route('**/api/v1/projects/demo/members', async (route) => route.fulfill({ json: [{ userId: 1, displayName: 'Fixture', role: 'OWNER', status: 'ACTIVE' }] }))
  await page.route('**/api/v1/projects/demo/agent-configuration', async (route) => route.fulfill({ json: setupState }))
  await page.route('**/api/v1/projects/demo/agent-configuration/reusable-projects', async (route) => route.fulfill({ json: [{ projectKey: 'history', name: '历史项目', status: 'READY', agentCount: 3 }] }))
  await page.route('**/api/v1/agent-team-presets', async (route) => route.fulfill({ json: [{ code: 'standard-design-team', name: '标准设计团队', versionId: 10, versionNo: 1, isDefault: true }] }))
  await page.route('**/api/v1/agent-profiles', async (route) => route.fulfill({ json: profiles }))
  await page.route('**/api/v1/projects/demo/agent-configuration:validate', async (route) => route.fulfill({ json: { valid: true, issues: [], checks: [{ label: 'Required Node 已配置', passed: true }, { label: 'Agent Version 已发布', passed: true }] } }))
  await page.route('**/api/v1/projects/demo/agent-configuration:confirm', async (route) => { setupState = { ...setupState, status: 'READY' }; await route.fulfill({ json: setupState }) })
  await page.route('**/api/v1/projects/demo/workflow-runs', async (route) => { runBody = route.request().postDataJSON(); await route.fulfill({ json: { id: 'run-1', projectId: 'demo', status: 'WAITING_DESIGN_ACCEPTANCE', stages } }) })
  await page.route('**/api/v1/workflow-runs/run-1', async (route) => route.fulfill({ json: { id: 'run-1', projectId: 'demo', status: 'WAITING_DESIGN_ACCEPTANCE', stages } }))
  await page.route('**/api/v1/workflow-runs/run-1/stages', async (route) => route.fulfill({ json: stages }))
  await page.route('**/api/v1/workflow-runs/run-1/events', async (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }))

  await page.goto('/projects')
  await page.getByTestId('enter-workspace').click()
  await page.waitForURL('**/projects/demo/setup')
  await page.getByRole('button', { name: '校验配置' }).click()
  await expect(page.getByText('Required Node 已配置')).toBeVisible()
  await page.getByRole('button', { name: '确认配置为 READY' }).click()
  await page.getByTestId('initial-request').fill('实现需求分析 Agent 工作流')
  await page.getByRole('button', { name: '启动 Workflow' }).click()
  await expect.poll(() => runBody).toEqual({ initialRequest: '实现需求分析 Agent 工作流', contextSnapshotJson: {} })
  await page.waitForURL('**/projects/demo/workspace/run-1')
  await expect(page.getByTestId('agent-team')).toContainText('Clarifier')
  await expect(page.getByTestId('document-revision')).toContainText('Revision 1')
  await expect(page.getByTestId('final-acceptance')).toBeVisible()
})
