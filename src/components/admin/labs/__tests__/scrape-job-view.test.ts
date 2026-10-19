import { describe, it, expect } from 'vitest'

import type { ScrapeJob } from '@/lib/database.types'
import {
  SCRAPE_POLL_INTERVAL_MS,
  isScrapeJobFinished,
  lostContactView,
  missingJobView,
  scrapeStartErrorMessage,
  toView,
  withStartError,
} from '../scrape-job-view'

function job(overrides: Partial<ScrapeJob> = {}): ScrapeJob {
  return {
    id: 'job-1',
    lab_id: 'lab-1',
    status: 'running',
    logs: '',
    inserted: 0,
    skipped: 0,
    profile_updated: false,
    error: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('toView', () => {
  it('maps a running job with no summary', () => {
    expect(toView(job())).toEqual({
      jobId: 'job-1',
      status: 'running',
      logs: [],
      summary: null,
    })
  })

  it('splits newline-joined logs and drops blank lines', () => {
    expect(toView(job({ logs: 'one\n\ntwo\n' })).logs).toEqual(['one', 'two'])
  })

  it('summarises a done job', () => {
    expect(toView(job({ status: 'done', inserted: 3, skipped: 2 })).summary).toBe(
      'Added 3, skipped 2'
    )
  })

  it('mentions a profile update on a done job', () => {
    expect(
      toView(job({ status: 'done', inserted: 1, skipped: 0, profile_updated: true }))
        .summary
    ).toBe('Added 1, skipped 0, profile updated')
  })

  it('uses the error (or a fallback) as the summary of a failed job', () => {
    expect(toView(job({ status: 'error', error: 'boom' })).summary).toBe('boom')
    expect(toView(job({ status: 'error', error: null })).summary).toBe('Scrape failed')
  })
})

describe('isScrapeJobFinished (poll stop condition)', () => {
  it('keeps polling only while the job is running', () => {
    expect(isScrapeJobFinished(job({ status: 'running' }))).toBe(false)
    expect(isScrapeJobFinished(job({ status: 'done' }))).toBe(true)
    expect(isScrapeJobFinished(job({ status: 'error' }))).toBe(true)
  })

  it('polls every 1.5s', () => {
    expect(SCRAPE_POLL_INTERVAL_MS).toBe(1500)
  })
})

describe('scrapeStartErrorMessage', () => {
  it('reports 403 as forbidden and anything else with its status', () => {
    expect(scrapeStartErrorMessage(403)).toBe('Forbidden.')
    expect(scrapeStartErrorMessage(500)).toBe('Request failed (500).')
  })
})

describe('withStartError', () => {
  it('starts an empty error view when the lab has no job yet', () => {
    expect(withStartError(undefined, 'Forbidden.')).toEqual({
      jobId: '',
      status: 'error',
      logs: ['Forbidden.'],
      summary: 'Forbidden.',
    })
  })

  it('keeps the previous job id and appends to its logs', () => {
    expect(
      withStartError(
        { jobId: 'old', status: 'done', logs: ['a'], summary: 'Added 1, skipped 0' },
        'Network error starting scrape.'
      )
    ).toEqual({
      jobId: 'old',
      status: 'error',
      logs: ['a', 'Network error starting scrape.'],
      summary: 'Network error starting scrape.',
    })
  })
})

describe('lostContactView', () => {
  it('ends the running view (so Scrape works again) and keeps existing logs', () => {
    expect(
      lostContactView({ jobId: 'job-1', status: 'running', logs: ['x'], summary: null }, 'job-1')
    ).toEqual({
      jobId: 'job-1',
      status: 'error',
      logs: ['x'],
      summary: 'Lost contact with the scrape. Refresh to check on it.',
    })
  })
})

describe('missingJobView', () => {
  it('marks the polled job as not found and keeps existing logs', () => {
    expect(
      missingJobView({ jobId: 'job-1', status: 'running', logs: ['x'], summary: null }, 'job-1')
    ).toEqual({
      jobId: 'job-1',
      status: 'error',
      logs: ['x'],
      summary: 'Scrape job not found.',
    })
    expect(missingJobView(undefined, 'job-2')).toEqual({
      jobId: 'job-2',
      status: 'error',
      logs: [],
      summary: 'Scrape job not found.',
    })
  })
})
