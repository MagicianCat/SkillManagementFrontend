import { test, expect } from '@playwright/test'

test('user creates/enters project, starts run in workspace, sees agent team, revision and accepts', async ({ page }) => {
  await page.route('**/api/v1/auth/session', async (route) => route.fulfill({ json: { accessToken: 'fixture', user: { id: 1, displayName: 'Fixture', permissions: ['skill:browse'] } } }))
  await page.route('**/api/v1/auth/feishu/document-access', async (route) => route.fulfill({ json: { status: 'NOT_AVAILABLE' } }))
  await page.route(/\/api\/v1\/projects(\?.*)?$/, async (route) => route.fulfill({ json: { items: [{ projectKey: 'demo', name: 'Demo', role: 'OWNER', status: 'ACTIVE', versionNo: 1 }] } }))
  await page.route('**/api/v1/projects/demo/members', async (route) => route.fulfill({ json: [{ userId: 1, displayName: 'Fixture', role: 'OWNER', status: 'ACTIVE' }] }))
  const stages = [{ id: 'req', key: 'REQUIREMENT', name: 'Requirement', status: 'HUMAN_REQUIRED', agents: [{ id: 'c', key: 'clarifier', name: 'Clarifier', status: 'COMPLETED' }, { id: 'w', key: 'writer', name: 'Writer', status: 'COMPLETED' }, { id: 'r', key: 'reviewer', name: 'Reviewer', status: 'COMPLETED' }], artifacts: [{ id: 'a', name: '需求说明书', revision: 1, reviewIssues: [] }] }]
  let runStarted = false
  await page.route('**/api/v1/projects/demo/workflow-runs/current', async (route) => {
    if (runStarted) await route.fulfill({ json: { id: 'run-1', projectId: 'demo', status: 'WAITING_DESIGN_ACCEPTANCE', stages } })
    else await route.fulfill({ status: 404, json: { error: 'WORKFLOW_RUN_NOT_FOUND' } })
  })
  await page.route('**/api/v1/projects/demo/workflow-runs', async (route) => { runStarted = true; await route.fulfill({ json: { id: 'run-1', projectId: 'demo', status: 'WAITING_DESIGN_ACCEPTANCE', stages } }) })
  await page.route('**/api/v1/workflow-runs/run-1', async (route) => route.fulfill({ json: { id: 'run-1', projectId: 'demo', status: 'WAITING_DESIGN_ACCEPTANCE', stages } }))
  await page.route('**/api/v1/workflow-runs/run-1/stages', async (route) => route.fulfill({ json: stages }))
  await page.route('**/api/v1/workflow-runs/run-1/events', async (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }))

  await page.goto('/projects')
  await expect(page.getByTestId('create-project')).toBeVisible()
  await page.getByTestId('enter-workspace').click()
  await page.waitForURL('**/projects/demo/workspace')
  await page.getByTestId('initial-request').fill('实现需求分析 Agent 工作流')
  await page.getByTestId('start-workflow').click()
  await page.waitForURL('**/workspace/run-1')
  await expect(page.getByTestId('agent-team')).toBeVisible()
  await expect(page.getByTestId('agent-team')).toContainText('Clarifier')
  await expect(page.getByTestId('document-revision')).toContainText('Revision 1')
  await page.getByTestId('acceptance-comment').fill('需求确认通过')
  await expect(page.getByTestId('final-acceptance')).toBeVisible()
})
