import { describe, it, expect, vi, beforeEach } from 'vitest'
// AI routes and actions refuse to run without a key (isAiConfigured).
vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
// The per-user AI limit has its own tests (src/lib/ai/__tests__/quota.test.ts).
vi.mock('@/lib/ai/quota', () => ({
  takeAiRequest: async () => ({ ok: true }),
  countedAiCall: (_userId: string, fn: unknown) => fn,
  aiLimitResponse: (error: string) => Response.json({ error }, { status: 429 }),
  AI_LIMIT_REACHED: 'limit',
}))

const { mockSessionUser, mockUpload, mockParse } = vi.hoisted(() => ({
  mockSessionUser: vi.fn(),
  mockUpload: vi.fn(),
  mockParse: vi.fn(),
}))

vi.mock('@/lib/supabase/session', () => ({ getSessionUser: mockSessionUser }))
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { storage: { from: () => ({ upload: mockUpload }) } },
}))
vi.mock('@/lib/extraction/parse', () => ({ parseBloodBytes: mockParse }))

import { extractFromPdf } from '../pdf-import'
import { UNSUPPORTED_FILE_MESSAGE } from '@/lib/health-documents/media-type'

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function upload(bytes: number[], type: string) {
  const fd = new FormData()
  fd.set('pdf', new File([new Uint8Array(bytes)], 'report', { type }))
  return extractFromPdf(fd)
}

describe('extractFromPdf — file type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionUser.mockResolvedValue({ supabase: {}, user: { id: 'u1' }, authError: null })
    mockUpload.mockResolvedValue({ error: null })
    mockParse.mockResolvedValue({ result: { markers: [] }, matchedMarkers: [] })
  })

  it('refuses a file whose bytes are not a PDF or image, and stores nothing', async () => {
    const res = await upload([0x00, 0x01, 0x02, 0x03, 0x04, 0x05], 'application/pdf')
    expect(res).toEqual({ success: false, error: UNSUPPORTED_FILE_MESSAGE })
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('accepts a PDF whose header follows a few leading bytes', async () => {
    const res = await upload([0xef, 0xbb, 0xbf, 0x0a, ...PDF], 'application/pdf')
    expect(res.success).toBe(true)
    expect(mockUpload.mock.calls[0][0]).toMatch(/^u1\/[0-9a-f-]+\.pdf$/)
    expect(mockUpload.mock.calls[0][2]).toMatchObject({ contentType: 'application/pdf' })
    expect(mockParse.mock.calls[0][1]).toBe('application/pdf')
  })

  it('stores and sends the real type when the browser mislabels it', async () => {
    const res = await upload(PNG, 'image/jpeg')
    expect(res.success).toBe(true)
    expect(mockUpload.mock.calls[0][0]).toMatch(/\.png$/)
    expect(mockUpload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' })
    expect(mockParse.mock.calls[0][1]).toBe('image/png')
  })

  it('still refuses a type the browser reports as unsupported', async () => {
    const res = await upload(PDF, 'text/plain')
    expect(res).toEqual({ success: false, error: 'No valid PDF or image file provided' })
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
