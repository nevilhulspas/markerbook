import { describe, it, expect } from 'vitest'
import { asSchema, type ToolSet } from 'ai'

import { createHealthRecordTools } from '../health-record-tools'

/**
 * The tool set is part of the model prompt: names (in order), descriptions and
 * input schemas are sent with every insights-chat request, and prompt caching
 * keys on them byte for byte. Pin the whole surface so a refactor of how the
 * tools are assembled cannot silently reorder, reword or reshape any of them.
 */
const tools: ToolSet = createHealthRecordTools({} as never, 'user-1')

describe('health-record tool contract', () => {
  it('keeps the tool names in their exact order', () => {
    expect(Object.keys(tools)).toMatchSnapshot()
  })

  it('keeps every description and input schema byte-identical', async () => {
    const surface: Record<string, { description: unknown; inputSchema: unknown }> = {}
    for (const [name, t] of Object.entries(tools)) {
      surface[name] = {
        description: t.description,
        inputSchema: await asSchema(t.inputSchema).jsonSchema,
      }
    }
    expect(JSON.stringify(surface, null, 2)).toMatchSnapshot()
  })
})
