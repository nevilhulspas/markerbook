// Error results shared by the next-to-test server actions. Lives outside the
// 'use server' files because those may only export async functions.

export const NOT_SIGNED_IN = 'You must be signed in.'

export type Err = { error: string }
