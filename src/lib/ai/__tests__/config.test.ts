import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { aiNotConfiguredResponse, describeAiError, isAiConfigured } from '@/lib/ai/config'
import {
  AI_BUSY_MESSAGE,
  AI_FAILED_MESSAGE,
  AI_KEY_REJECTED_MESSAGE,
  AI_NOT_CONFIGURED_MESSAGE,
  isAiNotConfiguredMessage,
} from '@/lib/ai/messages'

describe('isAiConfigured', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', ''))
  afterEach(() => vi.unstubAllEnvs())

  it('is false without a key', () => {
    expect(isAiConfigured()).toBe(false)
  })

  it('is false for a blank key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '   ')
    expect(isAiConfigured()).toBe(false)
  })

  it('is true with a key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test')
    expect(isAiConfigured()).toBe(true)
  })
})

describe('aiNotConfiguredResponse', () => {
  it('is a 503 with the plain message', async () => {
    const res = aiNotConfiguredResponse()
    expect(res.status).toBe(503)
    expect(await res.text()).toBe(AI_NOT_CONFIGURED_MESSAGE)
    expect(isAiNotConfiguredMessage(AI_NOT_CONFIGURED_MESSAGE)).toBe(true)
  })
})

describe('describeAiError', () => {
  beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test'))
  afterEach(() => vi.unstubAllEnvs())

  it('says AI is not set up when there is no key, whatever the error', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect(describeAiError(new TypeError('boom'))).toBe(AI_NOT_CONFIGURED_MESSAGE)
  })

  it('maps auth and rate-limit statuses', () => {
    expect(describeAiError({ status: 401 })).toBe(AI_KEY_REJECTED_MESSAGE)
    expect(describeAiError({ statusCode: 529 })).toBe(AI_BUSY_MESSAGE)
  })

  it("keeps the app's own plain errors", () => {
    expect(describeAiError(new Error('This report is too long.'))).toBe('This report is too long.')
  })

  it('hides SDK and parse errors', () => {
    class SdkError extends Error {}
    expect(describeAiError(new SdkError('400 {"type":"error"}'))).toBe(AI_FAILED_MESSAGE)
    expect(describeAiError(new SyntaxError('Unexpected token'))).toBe(AI_FAILED_MESSAGE)
    expect(describeAiError('nope')).toBe(AI_FAILED_MESSAGE)
  })
})
