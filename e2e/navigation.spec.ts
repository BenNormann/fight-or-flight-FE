import { expect, test } from '@playwright/test'

test('turn by turn: start a route, follow the simulated walk, arrive, end', async ({ page }) => {
  test.setTimeout(90_000)
  // Directions are gated: sign in with the development account first, landing on directions to the library.
  await page.goto(`/login/dev?next=${encodeURIComponent('/route?to=b-lib')}`)
  await page.getByTestId('dev-email').fill('trojan.dev@usc.edu')
  await page.getByTestId('dev-sign-in').click()
  await expect(page.getByTestId('view-directions')).toBeVisible()

  await page.getByTestId('start-route').click()

  // Banner replaces search; the sheet shows the trip and the steps.
  const banner = page.getByTestId('maneuver-banner')
  await expect(banner).toBeVisible()
  await expect(page.getByTestId('maneuver-distance')).toContainText(/In \d[\d.]* (ft|mi)/)
  await expect(page.getByTestId('maneuver-instruction')).toContainText(/Turn|Bear|Continue|Arrive/)
  await expect(page.getByPlaceholder('Search University Park campus')).toHaveCount(0)
  await expect(page.getByTestId('trip-bar')).toContainText('arrival')
  await expect(page.getByTestId('nav-announcer')).toContainText(/^In /)

  // Development control: fastest walk.
  await page.getByTestId('nav-sim-rate').click()
  await page.getByTestId('nav-sim-rate').click()
  await expect(page.getByTestId('nav-sim-rate')).toHaveText('16×')

  await expect(banner).toContainText('You have arrived', { timeout: 60_000 })
  await expect(page.getByTestId('nav-announcer')).toContainText('You have arrived')

  await page.getByTestId('end-route').click()
  await expect(banner).toHaveCount(0)
  await expect(page.getByTestId('trip-bar')).toHaveCount(0)
})
