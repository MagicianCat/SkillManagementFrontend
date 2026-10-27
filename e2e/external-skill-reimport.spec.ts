import { test, expect } from '@playwright/test'

test('existing external Skill with an active draft can import updated metadata and ZIP', async ({ page }) => {
  let importBody: Record<string, unknown> | undefined

  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: {
    accessToken: 'e2e-token', user: { id: 1, displayName: 'E2E Admin', permissions: ['admin:identity', 'skill:browse', 'skill:upload'] },
  } }))
  await page.route('**/api/v1/auth/feishu/document-access', (route) => route.fulfill({ json: { status: 'NOT_AVAILABLE' } }))
  await page.route('**/api/v1/external-resources/roles', (route) => route.fulfill({ json: [
    { id: 31, sourceSystem: 'e2e-platform', externalRoleId: 'role-31', roleName: 'E2E Role', status: 'ACTIVE' },
  ] }))
  await page.route('**/api/v1/external-resources*', (route) => route.fulfill({ json: [
    { id: 41, roleId: 31, sourceSystem: 'e2e-platform', externalResourceId: 'resource-41', resourceType: 'SKILL', name: 'Updated Skill Name', description: 'Updated Skill Description', currentVersionId: 51, externalVersion: '2.0.0', sizeBytes: 1024, receivedAt: '2026-10-27T00:00:00Z' },
  ] }))
  await page.route('**/api/v1/external-resources/41/versions', (route) => route.fulfill({ json: [
    { id: 51, externalVersion: '2.0.0', fileName: 'skill.zip', sizeBytes: 1024, sha256: 'abc', receivedAt: '2026-10-27T00:00:00Z' },
  ] }))
  await page.route('**/api/v1/external-resource-versions/51/imports', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/external-resource-versions/51/skill:prepare**', (route) => route.fulfill({ json: {
    skillKey: 'existing-skill', fileCount: 2, exists: true, skillId: 61, activeDraftVersionId: 71,
  } }))
  await page.route('**/api/v1/external-resource-versions/51/skill:import-draft', async (route) => {
    importBody = route.request().postDataJSON()
    await route.fulfill({ json: { skillKey: 'existing-skill', skillId: 61, draftVersionId: 71 } })
  })
  await page.route('**/api/v1/categories', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/wiki/teams/search**', (route) => route.fulfill({ json: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } }))
  page.on('dialog', (dialog) => dialog.accept())

  await page.goto('/admin/external-resources')
  await page.getByRole('button', { name: /Updated Skill Name/ }).click()
  await page.getByRole('button', { name: '解析并校验 ZIP' }).click()
  await expect(page.getByText('该 Skill 已有草稿；导入将更新此草稿的 ZIP 和元数据。')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认导入草稿' })).toBeEnabled()
  await page.getByRole('button', { name: '确认导入草稿' }).click()
  await expect.poll(() => importBody).toMatchObject({
    skillKey: 'existing-skill', displayName: 'Updated Skill Name', description: 'Updated Skill Description',
    confirmExisting: true, reimport: false,
  })
})
