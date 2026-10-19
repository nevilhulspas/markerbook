import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

const { mockCreate, mockStream } = vi.hoisted(() => ({ mockCreate: vi.fn(), mockStream: vi.fn() }))
vi.mock('@/lib/ai/client', () => ({
  getAnthropic: () => ({ messages: { create: mockCreate, stream: mockStream } }),
}))

import { extractDocumentJson } from '@/lib/ai/extract-document'

const schema = z.object({ value: z.number() })
const content = [{ type: 'text' as const, text: 'extract' }]
const reply = (text: string, stop_reason = 'end_turn') => ({ content: [{ type: 'text', text }], stop_reason })

describe('extractDocumentJson', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    mockStream.mockReset()
  })

  it('sends the shared extraction settings and salvages JSON from prose', async () => {
    mockCreate.mockResolvedValue(reply('Sure:\n```json\n{"value": 3}\n```'))
    await expect(extractDocumentJson({ content, maxTokens: 4096, schema })).resolves.toEqual({ value: 3 })
    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      thinking: { type: 'between_tools' },
      messages: [{ role: 'user', content }],
      output_config: { effort: 'medium' },
    })
  })

  it('uses structured output and parses the reply as-is when given a JSON schema', async () => {
    const jsonSchema = { type: 'object' }
    mockCreate.mockResolvedValue(reply('{"value": 1}'))
    await expect(extractDocumentJson({ content, maxTokens: 10, schema, jsonSchema })).resolves.toEqual({ value: 1 })
    expect(mockCreate.mock.calls[0][0].output_config).toEqual({
      effort: 'medium',
      format: { type: 'json_schema', schema: jsonSchema },
    })
  })

  it('streams to the final message when asked', async () => {
    mockStream.mockReturnValue({ finalMessage: () => Promise.resolve(reply('{"value": 2}')) })
    await expect(extractDocumentJson({ content, maxTokens: 64000, schema, stream: true })).resolves.toEqual({ value: 2 })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws the truncation message only when one is given', async () => {
    mockCreate.mockResolvedValue(reply('{"value": 2}', 'max_tokens'))
    await expect(
      extractDocumentJson({ content, maxTokens: 10, schema, truncatedMessage: 'too large' })
    ).rejects.toThrow('too large')
    await expect(extractDocumentJson({ content, maxTokens: 10, schema })).resolves.toEqual({ value: 2 })
  })

  it('throws the default or caller-supplied error messages', async () => {
    mockCreate.mockResolvedValue({ content: [], stop_reason: 'end_turn' })
    await expect(extractDocumentJson({ content, maxTokens: 10, schema })).rejects.toThrow('No extraction result returned')
    await expect(
      extractDocumentJson({ content, maxTokens: 10, schema, errors: { noText: 'No extraction result returned from Claude' } })
    ).rejects.toThrow('No extraction result returned from Claude')

    mockCreate.mockResolvedValue(reply('nothing here'))
    await expect(extractDocumentJson({ content, maxTokens: 10, schema })).rejects.toThrow(
      'No JSON object found in extraction result'
    )

    mockCreate.mockResolvedValue(reply('{"value": "x"}'))
    await expect(extractDocumentJson({ content, maxTokens: 10, schema })).rejects.toThrow(
      'Extraction did not match the expected format'
    )
  })
})
