import { expect, test } from '@playwright/test'

test('demo mode: no location prompt, the route walks itself to arrival', async ({ page }) => {
  test.setTimeout(90_000)
  // ?demo is remembered for the tab, so it survives the sign-in redirect.
  await page.goto('/?demo')
  await page.goto(`/login/dev?next=${encodeURIComponent('/route?to=b-lib')}`)
  await page.getByTestId('dev-email').fill('trojan.dev@usc.edu')
  await page.getByTestId('dev-sign-in').click()
  await expect(page.getByTestId('view-directions')).toBeVisible()
  // "Your location" is faked, so the browser is never asked.
  await expect(page.getByTestId('location-prompt')).toHaveCount(0)

  await page.getByTestId('start-route').click()
  const control = page.getByTestId('nav-dev-control')
  await expect(control).toBeVisible()
  // Demo mode always simulates: no switch to device GPS.
  await expect(control.getByRole('button', { name: /Switch to device GPS/ })).toHaveCount(0)

  await page.getByTestId('nav-sim-rate').click()
  await page.getByTestId('nav-sim-rate').click()
  await expect(page.getByTestId('nav-sim-rate')).toHaveText('16×')
  await expect(page.getByTestId('maneuver-banner')).toContainText('You have arrived', { timeout: 60_000 })
})

test('demo page: simulate a crime near you, see it announced and listed, then clear it', async ({ page }) => {
  await page.goto('/?demo')
  await page.goto(`/login/dev?next=${encodeURIComponent('/')}`)
  await page.getByTestId('dev-email').fill('trojan.dev@usc.edu')
  await page.getByTestId('dev-sign-in').click()
  await page.getByTestId('demo-open').click()
  await expect(page.getByTestId('view-demo')).toBeVisible()
  await expect(page.getByTestId('demo-status')).toContainText('Routes avoid 120 m')
  await page.getByTestId('demo-crime-near').click()
  await expect(page.getByText(/Robbery reported \d+ m away/)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('demo-incidents')).toContainText('Robbery')
  await page.getByTestId('demo-clear').click()
  await expect(page.getByTestId('demo-incidents')).toHaveCount(0)
})

test('no demo icon without ?demo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('locate')).toBeVisible()
  await expect(page.getByTestId('demo-open')).toHaveCount(0)
})
