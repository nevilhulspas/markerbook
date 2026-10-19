import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import { createStackTools } from '@/lib/insights/stack-tools'

/**
 * The chat must be able to do everything a person can do in the Stack editor.
 * That parity is easy to break silently — a field gets added to the modal and
 * nobody remembers the tool — so it is pinned here as an exact key set rather
 * than a "does it parse" check, which would pass while zod quietly strips an
 * unknown field.
 *
 * `frequency` is deliberately absent from both: it is derived from the intake
 * moments, so accepting it would let the model write a value the UI contradicts.
 */
const tools = createStackTools({} as never, 'user-1')

function shapeKeys(schema: unknown): string[] {
  return Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape).sort()
}

describe('chat tool parity with the Stack editor', () => {
  it('add_supplement covers every field the Add modal exposes', () => {
    expect(shapeKeys(tools.add_supplement.inputSchema)).toEqual([
      'dose',
      'end_date',
      'intakes',
      'name',
      'notes',
      'start_date',
    ])
  })

  it('update_supplement covers every field the Edit modal exposes', () => {
    expect(shapeKeys(tools.update_supplement.inputSchema)).toEqual([
      'dose',
      'end_date',
      'id',
      'intakes',
      'name',
      'notes',
      'start_date',
    ])
  })

  it('neither writer accepts the derived frequency', () => {
    expect(shapeKeys(tools.add_supplement.inputSchema)).not.toContain('frequency')
    expect(shapeKeys(tools.update_supplement.inputSchema)).not.toContain(
      'frequency'
    )
    expect(shapeKeys(tools.move_wishlist_to_stack.inputSchema)).not.toContain(
      'frequency'
    )
  })
})
