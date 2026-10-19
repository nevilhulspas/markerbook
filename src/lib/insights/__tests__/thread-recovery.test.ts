import { describe, it, expect } from 'vitest'

import {
  answerIsOutstanding,
  answerIsRecoverable,
  answerMayStillArrive,
  describesConnectionFailure,
  isConnectionFailure,
  threadTailOf,
  RECOVERY_ANSWER_WINDOW_MS,
  type ThreadTail,
} from '../thread-recovery'

const NOW = Date.parse('2026-08-24T12:00:00.000Z')

/** A thread whose newest message has the given role, stored N seconds ago. */
function tail(
  lastRole: ThreadTail['lastRole'],
  secondsAgo = 0,
  total = 2,
): ThreadTail {
  return {
    lastRole,
    lastStoredAt: lastRole === null ? null : new Date(NOW - secondsAgo * 1000).toISOString(),
    total,
  }
}

const EMPTY: ThreadTail = { lastRole: null, lastStoredAt: null, total: 0 }

describe('threadTailOf', () => {
  it('reads the newest message off a loaded transcript', () => {
    const rows = [
      { role: 'user', created_at: '2026-08-24T11:58:00.000Z' },
      { role: 'assistant', created_at: '2026-08-24T11:59:00.000Z' },
    ]
    expect(threadTailOf(rows)).toEqual({
      lastRole: 'assistant',
      lastStoredAt: '2026-08-24T11:59:00.000Z',
      total: 2,
    })
  })

  it('describes an empty thread without inventing a role', () => {
    expect(threadTailOf([])).toEqual(EMPTY)
  })
})

describe('answerIsOutstanding', () => {
  it('is true while only the question is stored', () => {
    expect(answerIsOutstanding(tail('user', 10))).toBe(true)
  })

  it('is false once the reply is stored', () => {
    expect(answerIsOutstanding(tail('assistant', 2))).toBe(false)
  })

  it('is false for an empty thread', () => {
    expect(answerIsOutstanding(EMPTY)).toBe(false)
  })
})

describe('answerIsRecoverable', () => {
  it('accepts a stored transcript that ends with the reply the screen is missing', () => {
    // On screen: question + the half-written answer the drop cut off.
    expect(answerIsRecoverable(tail('assistant', 1, 2), 2)).toBe(true)
  })

  it('accepts a stored reply the screen does not have at all', () => {
    // The stream died before a single word arrived, so the screen holds only
    // the question.
    expect(answerIsRecoverable(tail('assistant', 1, 2), 1)).toBe(true)
  })

  it('refuses to swap in a transcript shorter than what is on screen', () => {
    // The killer case: the user asked something while offline, so the request
    // never reached the server and no question was stored. The stored
    // transcript ends with the PREVIOUS answer, which reads as "an answer
    // landed" — and swapping it in would delete the question the user is
    // looking at.
    expect(answerIsRecoverable(tail('assistant', 590, 2), 3)).toBe(false)
  })

  it('never blanks a brand-new thread', () => {
    expect(answerIsRecoverable(EMPTY, 1)).toBe(false)
    expect(answerIsRecoverable(EMPTY, 0)).toBe(false)
  })

  it('waits while the answer is still outstanding', () => {
    expect(answerIsRecoverable(tail('user', 5, 1), 1)).toBe(false)
  })
})

describe('answerMayStillArrive', () => {
  it('waits for a reply to a question asked moments ago', () => {
    expect(answerMayStillArrive(tail('user', 20), NOW)).toBe(true)
  })

  it('keeps waiting through a slow turn', () => {
    // Eight steps with web searches and extended thinking take minutes; the
    // wait has to outlast them or it gives up just before the answer lands.
    expect(answerMayStillArrive(tail('user', 4 * 60), NOW)).toBe(true)
  })

  it('does not wait for a turn that died long ago', () => {
    const stale = RECOVERY_ANSWER_WINDOW_MS / 1000 + 60
    expect(answerMayStillArrive(tail('user', stale), NOW)).toBe(false)
  })

  it('still waits when the device clock runs fast', () => {
    // The question's time comes from the database, `now` from the phone. A
    // fast phone makes the question look older than it is — clamped, so
    // recovery is not silently dead on that device.
    expect(answerMayStillArrive(tail('user', -30 * 60), NOW)).toBe(true)
  })

  it('does not wait when the reply is already stored', () => {
    expect(answerMayStillArrive(tail('assistant', 2), NOW)).toBe(false)
  })

  it('does not wait on an unreadable timestamp', () => {
    expect(
      answerMayStillArrive({ lastRole: 'user', lastStoredAt: 'not a date', total: 1 }, NOW)
    ).toBe(false)
  })
})

describe('isConnectionFailure', () => {
  it('recognises a dropped fetch on WebKit and on Chrome', () => {
    expect(isConnectionFailure(new TypeError('Load failed'))).toBe(true)
    expect(isConnectionFailure(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('leaves an error the server described alone', () => {
    // A non-2xx body, or an error chunk in the stream — e.g. the Anthropic
    // rejection users saw under the document card. No reply is coming, so the
    // message must stay on screen.
    expect(isConnectionFailure(new Error('Tool result is missing for tool call toolu_01'))).toBe(
      false
    )
    expect(isConnectionFailure('Thread not found')).toBe(false)
  })
})

describe('describesConnectionFailure', () => {
  it('matches the wordings browsers actually use', () => {
    for (const message of [
      'Load failed',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'The network connection was lost.',
    ]) {
      expect(describesConnectionFailure(new TypeError(message))).toBe(true)
    }
  })

  it('leaves an unrecognised TypeError its own message', () => {
    // A bug in our own code must not be dressed up as a network problem —
    // that is the difference between a fixable report and a shrug.
    expect(
      describesConnectionFailure(new TypeError("Cannot read properties of undefined (reading 'id')"))
    ).toBe(false)
  })
})
