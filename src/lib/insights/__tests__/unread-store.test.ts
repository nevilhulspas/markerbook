import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GENERATING_KEY,
  UNREAD_KEY,
  clearUnread,
  markUnread,
  mutateUnread,
  parseIds,
  persistGenerating,
  readUnreadRaw,
  reconcileUnread,
  subscribeUnread,
} from '../unread-store'

/** A Map-backed stand-in for window.localStorage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

/** localStorage that throws on every access, as in some private modes. */
const blockedStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('SecurityError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

let storage: ReturnType<typeof fakeStorage>

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('window', { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseIds', () => {
  it('reads a JSON array of ids', () => {
    expect(parseIds('["a","b"]')).toEqual(new Set(['a', 'b']))
  })

  it('drops non-string entries', () => {
    expect(parseIds('["a",1,null,{"id":"b"},"c"]')).toEqual(new Set(['a', 'c']))
  })

  it('treats a non-array as empty', () => {
    expect(parseIds('{"a":true}')).toEqual(new Set())
    expect(parseIds('"a"')).toEqual(new Set())
  })

  it('treats malformed JSON as empty', () => {
    expect(parseIds('not json')).toEqual(new Set())
  })
})

describe('readUnreadRaw', () => {
  it('returns the stored value', () => {
    storage.items.set(UNREAD_KEY, '["t1"]')
    expect(readUnreadRaw()).toBe('["t1"]')
  })

  it('falls back to an empty list when nothing is stored', () => {
    expect(readUnreadRaw()).toBe('[]')
  })

  it('falls back to an empty list when localStorage throws', () => {
    vi.stubGlobal('window', { localStorage: blockedStorage })
    expect(readUnreadRaw()).toBe('[]')
  })

  it('falls back to an empty list without a window (server render)', () => {
    vi.unstubAllGlobals()
    expect(readUnreadRaw()).toBe('[]')
  })
})

describe('mutateUnread', () => {
  it('writes the mutated set back and notifies subscribers', () => {
    storage.items.set(UNREAD_KEY, '["a"]')
    const listener = vi.fn()
    const unsubscribe = subscribeUnread(listener)
    mutateUnread((ids) => ids.add('b'))
    unsubscribe()
    expect(storage.items.get(UNREAD_KEY)).toBe('["a","b"]')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    subscribeUnread(listener)()
    mutateUnread((ids) => ids.add('a'))
    expect(listener).not.toHaveBeenCalled()
  })

  it('still notifies when localStorage throws', () => {
    vi.stubGlobal('window', { localStorage: blockedStorage })
    const listener = vi.fn()
    const unsubscribe = subscribeUnread(listener)
    expect(() => mutateUnread((ids) => ids.add('a'))).not.toThrow()
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('markUnread / clearUnread', () => {
  it('adds and removes a thread id', () => {
    markUnread('t1')
    markUnread('t2')
    markUnread('t1')
    expect(parseIds(readUnreadRaw())).toEqual(new Set(['t1', 't2']))
    clearUnread('t1')
    expect(parseIds(readUnreadRaw())).toEqual(new Set(['t2']))
  })

  it('clearing an id that is not unread leaves the rest alone', () => {
    markUnread('t1')
    clearUnread('missing')
    expect(storage.items.get(UNREAD_KEY)).toBe('["t1"]')
  })
})

describe('reconcileUnread', () => {
  it('turns threads that were generating into unread and consumes the key', () => {
    storage.items.set(UNREAD_KEY, '["a"]')
    storage.items.set(GENERATING_KEY, '["b"]')
    reconcileUnread(new Set(['a', 'b']))
    expect(parseIds(readUnreadRaw())).toEqual(new Set(['a', 'b']))
    expect(storage.items.has(GENERATING_KEY)).toBe(false)
  })

  it('prunes ids for threads that no longer exist', () => {
    storage.items.set(UNREAD_KEY, '["a","gone"]')
    storage.items.set(GENERATING_KEY, '["also-gone"]')
    reconcileUnread(new Set(['a']))
    expect(parseIds(readUnreadRaw())).toEqual(new Set(['a']))
  })

  it('notifies subscribers once', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeUnread(listener)
    reconcileUnread(new Set())
    unsubscribe()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('treats a blocked localStorage as nothing orphaned', () => {
    vi.stubGlobal('window', { localStorage: blockedStorage })
    expect(() => reconcileUnread(new Set(['a']))).not.toThrow()
  })
})

describe('persistGenerating', () => {
  it('stores the ids for the next load', () => {
    persistGenerating(['a', 'b'])
    expect(storage.items.get(GENERATING_KEY)).toBe('["a","b"]')
  })

  it('round-trips through reconcileUnread', () => {
    persistGenerating(['a'])
    reconcileUnread(new Set(['a']))
    expect(parseIds(readUnreadRaw())).toEqual(new Set(['a']))
  })

  it('ignores a blocked localStorage', () => {
    vi.stubGlobal('window', { localStorage: blockedStorage })
    expect(() => persistGenerating(['a'])).not.toThrow()
  })
})
