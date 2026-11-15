import { describe, expect, it } from 'vitest'
import { chromeInsets } from './insets'

const base = { sheetSnap: 'peek' as const, panelOpen: true, routeActive: false, viewportW: 390, viewportH: 844 }

describe('chromeInsets', () => {
  it('phone: half sheet covers the lower half and hides the control stack', () => {
    const i = chromeInsets({ ...base, breakpoint: 'mobile', sheetSnap: 'half' })
    expect(i.bottom).toBeGreaterThanOrEqual(422)
    expect(i.right).toBe(16)
  })
  it('tablet: full sheet covers the left column; half picks the larger free area', () => {
    const tablet = { ...base, breakpoint: 'tablet' as const, viewportW: 768, viewportH: 1024 }
    expect(chromeInsets({ ...tablet, sheetSnap: 'full' }).left).toBeGreaterThan(400)
    expect(chromeInsets({ ...tablet }).left).toBe(16)
    expect(chromeInsets({ ...tablet, sheetSnap: 'half' }).bottom).toBeGreaterThan(512)
    expect(chromeInsets({ ...tablet, viewportW: 1000, viewportH: 700, sheetSnap: 'half' }).left).toBeGreaterThan(400)
  })
  it('desktop: panel and route pill', () => {
    const open = chromeInsets({ ...base, breakpoint: 'desktop' })
    const closed = chromeInsets({ ...base, breakpoint: 'desktop', panelOpen: false })
    expect(open.left - closed.left).toBe(400)
    expect(chromeInsets({ ...base, breakpoint: 'desktop', routeActive: true }).top).toBeGreaterThan(open.top)
  })
})
