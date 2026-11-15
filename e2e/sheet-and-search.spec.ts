import { expect, test, type Page } from '@playwright/test'

/** A one-finger drag with real touch events (Chromium's CDP; WebKit has no touch input API). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }] })
    await page.waitForTimeout(16)
  }
  // Hold still before lifting: a placed release, not a flick.
  await page.waitForTimeout(150)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test.describe('bottom sheet drag (phone)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'touch drags need CDP')

  test('drags anywhere at peek and half; scrolls only at full; lowers from scroll-top', async ({ page }) => {
    await page.goto('/')
    const sheet = page.getByTestId('bottom-sheet')
    const body = page.getByTestId('bottom-sheet-body')
    await expect(sheet).toHaveAttribute('data-snap', 'peek')
    const h = page.viewportSize()!.height

    // Peek → half, starting on the content (not the grabber).
    await touchDrag(page, { x: 200, y: h - 40 }, { x: 200, y: h / 2 })
    await expect(sheet).toHaveAttribute('data-snap', 'half')

    // Half → full, again on the content: the sheet moves, the content does not scroll.
    await touchDrag(page, { x: 200, y: h / 2 + 120 }, { x: 200, y: 60 })
    await expect(sheet).toHaveAttribute('data-snap', 'full')
    expect(await body.evaluate((el) => el.scrollTop)).toBe(0)

    // Full, scrolled to top: a downward drag on the content lowers the sheet.
    await touchDrag(page, { x: 200, y: 200 }, { x: 200, y: h / 2 + 60 })
    await expect(sheet).not.toHaveAttribute('data-snap', 'full')

    // The header is a full-width, 44px drag zone. Let the settle animation finish before measuring it.
    await page.waitForTimeout(700)
    const header = page.getByRole('button', { name: /(Expand|Collapse) sheet/ })
    const box = (await header.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1)
    await touchDrag(page, { x: 30, y: box.y + box.height / 2 }, { x: 30, y: h - 20 })
    await expect(sheet).toHaveAttribute('data-snap', 'peek')
  })
})

test('search takes over the phone screen and gives the sheet back', async ({ page }) => {
  await page.goto('/')
  const sheet = page.getByTestId('bottom-sheet')
  await expect(sheet).toHaveAttribute('data-snap', 'peek')

  const field = page.getByLabel('Search University Park campus')
  await field.click()
  const surface = page.getByTestId('search-surface')
  await expect(surface).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Map layers' })).toHaveCount(0)
  await expect(page.getByTestId('search-suggestions')).toBeVisible()
  await expect(field).toBeFocused()

  // Results under the field; picking one leaves search and opens it in the sheet.
  await field.fill('library')
  await expect(page.getByTestId('search-results')).toBeVisible()
  await page.getByTestId('search-results').getByRole('button').first().click()
  await expect(surface).toHaveCount(0)
  await expect(sheet).toHaveAttribute('data-snap', 'half')
  await expect(page.getByTestId('view-place')).toBeVisible()

  // Back arrow: leave search, query cleared.
  await field.click()
  await expect(surface).toBeVisible()
  await page.getByRole('button', { name: 'Close search' }).click()
  await expect(surface).toHaveCount(0)
  await expect(field).toHaveValue('')
  await expect(sheet).toBeVisible()
})
