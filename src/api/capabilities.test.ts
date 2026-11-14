import { describe, expect, it } from 'vitest'
import { parseConfig } from './adapters/config'
import { NO_CAPABILITIES, resolveCapabilities } from './capabilities'

const config = parseConfig({ bounds: [-1, -1, 1, 1], features: ['risk', 'routing'] })

describe('capabilities', () => {
  it('is all-off until config is known', () => {
    expect(resolveCapabilities(undefined)).toEqual(NO_CAPABILITIES)
  })

  it('follows the config feature list', () => {
    expect(resolveCapabilities(config, new Set())).toMatchObject({ risk: true, routing: true, events: false })
  })

  it('switches a feature off after the endpoint proves unserved', () => {
    expect(resolveCapabilities(config, new Set(['risk'])).risk).toBe(false)
  })
})
