import { describe, it, expectTypeOf } from 'vitest'

import type { LabStatus, Sex } from '@/lib/database.types'
import type { TableInsert, TableRow, TableUpdate } from '../database'

// Type-level checks (enforced by `tsc --noEmit`): the CHECK-constraint
// overrides narrow the generated `string` columns to the app's unions.
describe('Database overrides', () => {
  it('narrows labs and lab_tests status to LabStatus', () => {
    expectTypeOf<TableRow<'labs'>['status']>().toEqualTypeOf<LabStatus>()
    expectTypeOf<TableRow<'lab_tests'>['status']>().toEqualTypeOf<LabStatus>()
    expectTypeOf<TableInsert<'lab_tests'>['status']>().toEqualTypeOf<LabStatus | undefined>()
    expectTypeOf<TableUpdate<'labs'>['status']>().toEqualTypeOf<LabStatus | undefined>()
  })

  it('keeps the profiles overrides', () => {
    expectTypeOf<TableRow<'profiles'>['sex']>().toEqualTypeOf<Sex | null>()
    expectTypeOf<TableInsert<'profiles'>['sex']>().toEqualTypeOf<Sex | null | undefined>()
  })

  it('leaves other columns as generated', () => {
    expectTypeOf<TableRow<'lab_tests'>['name']>().toEqualTypeOf<string>()
    expectTypeOf<TableRow<'labs'>['country']>().toEqualTypeOf<string | null>()
  })
})
