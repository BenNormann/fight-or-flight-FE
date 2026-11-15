import { expect, test } from '@playwright/test'

test('signed out: directions go through sign-in, then resume', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('account-sign-in')).toBeVisible()

  await page.getByTestId('directions-fab').click()
  await expect(page).toHaveURL(/\/login\?next=%2Froute/)
  await expect(page.getByTestId('login-page')).toBeVisible()

  await page.getByTestId('login-continue').click()
  await expect(page).toHaveURL(/\/login\/dev\?next=%2Froute/)
  await expect(page.getByText('Development sign-in')).toBeVisible()

  // USC accounts only.
  await page.getByTestId('dev-email').fill('someone@gmail.com')
  await page.getByTestId('dev-sign-in').click()
  await expect(page.getByTestId('dev-sign-in-error')).toContainText('@usc.edu')

  await page.getByTestId('dev-email').fill('trojan.dev@usc.edu')
  await page.getByTestId('dev-sign-in').click()

  await expect(page).toHaveURL(/\/route(\?|$)/)
  await expect(page.getByTestId('login-page')).toHaveCount(0)
  await expect(page.getByTestId('account-menu')).toBeVisible()

  // A /route deep link no longer bounces once signed in (session survives the reload).
  await page.reload()
  await expect(page).toHaveURL(/\/route(\?|$)/)

  await page.getByTestId('account-menu').click()
  await expect(page.getByTestId('account-email')).toContainText('@')
  await page.getByTestId('account-sign-out').click()
  await expect(page.getByTestId('account-sign-in')).toBeVisible()
})

test('a backend refusal comes back as a readable message', async ({ page }) => {
  await page.goto('/login?next=%2Froute&error=domain')
  await expect(page.getByTestId('login-error')).toContainText('USC email')
})
