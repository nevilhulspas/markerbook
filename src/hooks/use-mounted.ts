import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** `false` during SSR and hydration, `true` once rendering on the client. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
