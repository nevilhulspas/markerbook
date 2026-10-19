import { describe, it, expect } from 'vitest'

import { shortcutSetup } from '../shortcut-setup'

describe('shortcutSetup', () => {
  it('builds the log URL and the Authorization header the Shortcut sends', () => {
    expect(shortcutSetup('https://health.example.com', 'abc-123')).toEqual({
      url: 'https://health.example.com/api/nutrition/log',
      header: 'Authorization: Bearer abc-123',
      headerValue: 'Bearer abc-123',
    })
  })

  it('does not double a trailing slash on the origin', () => {
    expect(shortcutSetup('http://localhost:3000/', 't').url).toBe('http://localhost:3000/api/nutrition/log')
  })
})
