/**
 * True when a Supabase/Postgres error is a unique-constraint violation
 * (SQLSTATE 23505). Used to turn a lost insert race against a UNIQUE index into
 * a friendly "already exists" message instead of leaking the raw DB error.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}
