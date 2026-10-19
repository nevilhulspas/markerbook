// PostgREST returns at most `max_rows` rows per request (1000 in this project's
// supabase/config.toml and in Supabase's default), whatever `.limit()` or
// `.range()` asks for. Reads that need every row page with `.range()`; each
// page query must use a stable order so pages do not overlap or skip rows.
export const PAGE_SIZE = 1000

/** Every row, or the error that stopped the read. */
export type AllRowsResult<T> = { rows: T[] } | { error: string }

export type PageQuery<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Read every row through `page(from, to)`. Each page starts after the rows
 * actually received and the read ends on an empty page, so a server cap below
 * PAGE_SIZE cannot truncate the result (it costs one extra, empty request).
 * A failed page returns its error instead of the rows read so far — a partial
 * result must not look complete.
 */
export async function fetchAllPages<T>(page: PageQuery<T>): Promise<AllRowsResult<T>> {
  const rows: T[] = []
  for (;;) {
    const from = rows.length
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { rows }
    rows.push(...data)
  }
}
