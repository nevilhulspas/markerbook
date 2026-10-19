// The Database type every Supabase client is created with.
//
// `database.generated.ts` comes straight from `npm run gen:types` and must not
// be edited. Postgres CHECK constraints are invisible to the generator, so
// constrained text columns come out as plain `string`. The overrides below
// narrow those columns to the unions the app already uses; each one mirrors a
// CHECK constraint in supabase/migrations, so no valid row is excluded.

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database as GeneratedDatabase } from './database.generated'
import type {
  DietPattern,
  LabStatus,
  PregnancyStatus,
  Sex,
  SmokingStatus,
} from '@/lib/database.types'

type Override<T, O> = Omit<T, keyof O> & O

type GeneratedPublic = GeneratedDatabase['public']
type GeneratedTables = GeneratedPublic['Tables']

/** Narrow a table's columns in its Row (required) and Insert/Update (optional). */
type OverrideTable<T extends GeneratedTables[keyof GeneratedTables], O> = Omit<
  T,
  'Row' | 'Insert' | 'Update'
> & {
  Row: Override<T['Row'], O>
  Insert: Override<T['Insert'], Partial<O>>
  Update: Override<T['Update'], Partial<O>>
}

/** profiles CHECK constraints: 00001_create_profiles, 20260529000000/1 (medical history). */
type ProfileColumns = {
  sex: Sex | null
  smoking_status: SmokingStatus | null
  pregnancy_status: PregnancyStatus | null
  diet_pattern: DietPattern | null
}

/** labs + lab_tests status CHECK constraints: 20260524100000_create_lab_directory. */
type LabStatusColumns = {
  status: LabStatus
}

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedPublic, 'Tables'> & {
    Tables: Omit<GeneratedTables, 'profiles' | 'labs' | 'lab_tests'> & {
      profiles: OverrideTable<GeneratedTables['profiles'], ProfileColumns>
      labs: OverrideTable<GeneratedTables['labs'], LabStatusColumns>
      lab_tests: OverrideTable<GeneratedTables['lab_tests'], LabStatusColumns>
    }
  }
}

type PublicTables = Database['public']['Tables']
export type TableRow<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TableInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TableUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

/** A Supabase client (server, browser or admin) typed with this schema. */
export type TypedSupabaseClient = SupabaseClient<Database>
