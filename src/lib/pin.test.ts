import { describe, expect, it } from 'vitest'
import { parsePin, pinId } from './pin'

describe('pin ids', () => {
  it('round-trips a point to about a metre', () => {
    const id = pinId([-118.285123456, 34.022412345])
    expect(id).toBe('pin:34.02241,-118.28512')
    expect(parsePin(id)).toEqual([-118.28512, 34.02241])
  })
  it('rejects anything that is not a pin', () => {
    for (const bad of [null, undefined, 'b-doheny', 'pin:', 'pin:1', 'pin:a,b', 'pin:1,2,3', 'pin:95,10']) expect(parsePin(bad)).toBeNull()
  })
})
