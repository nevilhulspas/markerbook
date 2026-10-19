/**
 * The insights sidebar's unread dots, kept in localStorage so they survive a
 * page refresh.
 *
 * UNREAD_KEY holds finished-but-unopened thread ids; GENERATING_KEY holds ids
 * that were mid-stream — on the next load those count as unread (their stream
 * died with the page, so the reply was never seen).
 *
 * Unread ids are consumed via useSyncExternalStore — the same hydration-safe
 * pattern as the sidebar width. Mutations go through mutateUnread, which
 * writes storage and notifies subscribers; components re-render from the
 * storage snapshot.
 */

export const UNREAD_KEY = 'insights:unread-threads'
export const GENERATING_KEY = 'insights:generating-threads'

const unreadListeners = new Set<() => void>()
export function subscribeUnread(listener: () => void) {
  unreadListeners.add(listener)
  return () => unreadListeners.delete(listener)
}
export function readUnreadRaw(): string {
  try {
    return window.localStorage.getItem(UNREAD_KEY) ?? '[]'
  } catch {
    return '[]' // localStorage unavailable (private mode) — dots just don't persist.
  }
}
export function parseIds(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}
export function mutateUnread(mutate: (ids: Set<string>) => void) {
  const ids = parseIds(readUnreadRaw())
  mutate(ids)
  try {
    window.localStorage.setItem(UNREAD_KEY, JSON.stringify([...ids]))
  } catch {}
  unreadListeners.forEach((listener) => listener())
}
export const markUnread = (threadId: string) => mutateUnread((ids) => ids.add(threadId))
export const clearUnread = (threadId: string) => mutateUnread((ids) => ids.delete(threadId))

/**
 * One-time reconciliation after a refresh: threads that were still GENERATING
 * when the page unloaded become unread (their stream died with the page, so
 * the reply was never seen), and ids for threads deleted elsewhere are pruned.
 */
export function reconcileUnread(knownThreadIds: ReadonlySet<string>) {
  let orphaned: Set<string>
  try {
    orphaned = parseIds(window.localStorage.getItem(GENERATING_KEY) ?? '[]')
    window.localStorage.removeItem(GENERATING_KEY) // consumed — those streams are gone
  } catch {
    orphaned = new Set()
  }
  mutateUnread((ids) => {
    orphaned.forEach((id) => ids.add(id))
    ids.forEach((id) => {
      if (!knownThreadIds.has(id)) ids.delete(id)
    })
  })
}

/**
 * Persist the generating set so reconcileUnread can see, after a refresh,
 * which threads were mid-stream when the page went away.
 */
export function persistGenerating(threadIds: string[]) {
  try {
    window.localStorage.setItem(GENERATING_KEY, JSON.stringify(threadIds))
  } catch {}
}
