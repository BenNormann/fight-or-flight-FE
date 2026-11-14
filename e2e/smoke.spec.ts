import { expect, test } from '@playwright/test'

test('shell renders with the mock backend', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('backend-status')).toContainText(/mock/i)
})
