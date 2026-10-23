import { describe, expect, it } from 'vitest'
import { assertOwnedPath, isOwnedAttachment, isOwnedPath } from '../storage-path'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const F = '33333333-3333-4333-8333-333333333333'

describe('isOwnedPath', () => {
  it('accepts the shapes the upload actions write', () => {
    expect(isOwnedPath(A, `${A}/${F}.pdf`)).toBe(true)
    expect(isOwnedPath(A, `${A}/chat/${F}.png`)).toBe(true)
    expect(isOwnedPath(A, `${A}/microbiome/${F}.PDF`)).toBe(true)
    expect(isOwnedPath(A, `${A}/genetics/${F}.txt`)).toBe(true)
  })

  it("rejects another user's file", () => {
    expect(isOwnedPath(A, `${B}/${F}.pdf`)).toBe(false)
    expect(isOwnedPath(A, `${B}/chat/${F}.pdf`)).toBe(false)
  })

  it('rejects traversal and encoding tricks', () => {
    for (const p of [
      `${A}/../${B}/${F}.pdf`,
      `${A}/./${F}.pdf`,
      `${A}//${F}.pdf`,
      `${A}\\..\\${B}\\${F}.pdf`,
      `${A}/%2e%2e/${B}/${F}.pdf`,
      `${A}/chat/../../${B}/${F}.pdf`,
      `/${A}/${F}.pdf`,
      `${A}/${F}.pdf/`,
    ]) {
      expect(isOwnedPath(A, p), p).toBe(false)
    }
  })

  it('rejects unknown folders, non-uuid names and odd extensions', () => {
    expect(isOwnedPath(A, `${A}/secret/${F}.pdf`)).toBe(false)
    expect(isOwnedPath(A, `${A}/report.pdf`)).toBe(false)
    expect(isOwnedPath(A, `${A}/${F}`)).toBe(false)
    expect(isOwnedPath(A, `${A}/${F}.p-df`)).toBe(false)
    expect(isOwnedPath(A, `${A}/chat/x/${F}.pdf`)).toBe(false)
  })

  it('rejects non-strings and a non-uuid user id', () => {
    expect(isOwnedPath(A, null)).toBe(false)
    expect(isOwnedPath(A, 42)).toBe(false)
    expect(isOwnedPath('', `/${F}.pdf`)).toBe(false)
  })
})

describe('assertOwnedPath', () => {
  it('returns the path or throws', () => {
    expect(assertOwnedPath(A, `${A}/${F}.pdf`)).toBe(`${A}/${F}.pdf`)
    expect(() => assertOwnedPath(A, `${B}/${F}.pdf`)).toThrow(/not authorized/)
  })
})

describe('isOwnedAttachment', () => {
  const base = { mediaType: 'image/png', filename: 'x.png' }
  it('checks the main path and every tile', () => {
    expect(isOwnedAttachment(A, { ...base, storagePath: `${A}/chat/${F}.png` })).toBe(true)
    expect(
      isOwnedAttachment(A, {
        ...base,
        storagePath: `${A}/chat/${F}.png`,
        parts: [`${A}/chat/${F}.png`, `${B}/chat/${F}.png`],
      })
    ).toBe(false)
  })

  it('rejects malformed objects', () => {
    expect(isOwnedAttachment(A, null)).toBe(false)
    expect(isOwnedAttachment(A, { storagePath: `${A}/chat/${F}.png` })).toBe(false)
    expect(isOwnedAttachment(A, { ...base, storagePath: `${A}/chat/${F}.png`, parts: 'x' })).toBe(false)
  })
})
