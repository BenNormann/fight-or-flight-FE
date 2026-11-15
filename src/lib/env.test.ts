import { describe, expect, it } from 'vitest'
import { apiOrigin } from './env'

describe('apiOrigin', () => {
  it('keeps a bare origin', () => {
    expect(apiOrigin('https://api.example.test')).toBe('https://api.example.test')
    expect(apiOrigin('http://localhost:5000/')).toBe('http://localhost:5000')
  })

  it('drops a pasted endpoint path, query and hash', () => {
    expect(apiOrigin('https://api.example.test/api/v1/health')).toBe('https://api.example.test')
    expect(apiOrigin(' https://api.example.test/api/v1/?x=1#y ')).toBe('https://api.example.test')
  })

  it('treats empty as unset', () => {
    expect(apiOrigin(undefined)).toBeUndefined()
    expect(apiOrigin('  ')).toBeUndefined()
  })
})
