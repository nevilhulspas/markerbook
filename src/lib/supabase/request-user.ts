import { cache } from 'react'

import { createClient } from './server'

/**
 * `supabase.auth.getUser()` once per server request. The layout, the page
 * and every server action it calls used to make their own network call to
 * Supabase Auth; React's cache() shares one result within a request (it does
 * not cache across requests, and is a plain call outside a server render).
 * Same verification as before — this is not getClaims().
 */
export const getRequestUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})
