import { describe, it, expect, beforeEach } from 'vitest'

import { beginRun, endRun, liveRunCount, stopRun } from '../run-registry'

/** Leave the module-level map empty between tests. */
beforeEach(() => {
  for (const threadId of ['t1', 't2']) stopRun(threadId)
})

describe('run-registry', () => {
  it('stops the run it registered', () => {
    const run = beginRun('t1')
    expect(run.signal.aborted).toBe(false)

    expect(stopRun('t1')).toBe(true)
    expect(run.signal.aborted).toBe(true)
  })

  it('reports a stop that arrives after the answer finished', () => {
    // Ordinary, not an error: the reply can land between the click and the
    // request. The caller logs the difference and does nothing else.
    const run = beginRun('t1')
    endRun('t1', run)

    expect(stopRun('t1')).toBe(false)
    expect(run.signal.aborted).toBe(false)
  })

  it('keeps threads apart', () => {
    const first = beginRun('t1')
    const second = beginRun('t2')

    stopRun('t1')

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
  })

  it('leaves an earlier run of the same thread running', () => {
    // A second request for one thread takes over the slot. The first is
    // finishing on its own; cutting it off is the user's call, not ours.
    const first = beginRun('t1')
    const second = beginRun('t1')

    expect(first.signal.aborted).toBe(false)
    stopRun('t1')
    expect(second.signal.aborted).toBe(true)
    expect(first.signal.aborted).toBe(false)
  })

  it('does not let a finished run deregister its successor', () => {
    const first = beginRun('t1')
    const second = beginRun('t1')

    endRun('t1', first) // the older run finishing, late

    expect(stopRun('t1')).toBe(true)
    expect(second.signal.aborted).toBe(true)
  })

  it('leaves nothing behind once runs end', () => {
    const run = beginRun('t1')
    expect(liveRunCount()).toBe(1)
    endRun('t1', run)
    expect(liveRunCount()).toBe(0)
  })
})
