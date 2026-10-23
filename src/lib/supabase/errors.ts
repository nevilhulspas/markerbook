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

/**
 * Logs a raw Supabase/Postgres error with its context and returns `message`,
 * a plain sentence for the screen. Database error text (constraint names,
 * column names, SQL details) means nothing to the user and leaks the schema,
 * so actions return this instead of `error.message`.
 */
export function userErrorMessage(context: string, error: unknown, message: string): string {
  console.error(`${context} failed:`, error)
  return message
}
