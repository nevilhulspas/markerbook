import { describe, it, expect } from 'vitest'
import { asSchema, type FlexibleSchema } from 'ai'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createLabTestTools } from '../lab-test-tools'

// Contract test: the tool names (in order), descriptions and input JSON schemas
// are what the model sees, and prompt caching keys on them byte for byte. Any
// change here must be deliberate — update the snapshot only when you mean to
// change what the model is offered.
describe('createLabTestTools contract', () => {
  it('keeps tool names, descriptions and input schemas byte-identical', async () => {
    const tools = createLabTestTools({} as unknown as SupabaseClient, 'user-1')
    const contract = []
    for (const [name, t] of Object.entries(tools)) {
      contract.push({
        name,
        description: t.description,
        hasExecute: typeof t.execute === 'function',
        inputSchema: await asSchema(t.inputSchema as FlexibleSchema<unknown>).jsonSchema,
      })
    }
    await expect(JSON.stringify(contract, null, 2) + '\n').toMatchFileSnapshot(
      './__snapshots__/lab-test-tools.contract.json'
    )
  })
})
