import { describe, it, expect } from 'vitest'
import { detectMediaType, sniffMediaType, extensionFor } from '../media-type'

describe('detectMediaType', () => {
  it('detects PDF from %PDF magic bytes', () => {
    expect(detectMediaType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('application/pdf')
  })
  it('detects JPEG', () => {
    expect(detectMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })
  it('detects PNG', () => {
    expect(detectMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
  })
  it('detects WebP', () => {
    expect(
      detectMediaType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))
    ).toBe('image/webp')
  })
  it('detects GIF', () => {
    expect(detectMediaType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif')
  })
  it('returns null for unknown bytes', () => {
    expect(detectMediaType(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull()
  })

  it('finds a PDF header that follows a few leading bytes, as PDF readers do', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x0a, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
    expect(detectMediaType(bytes)).toBe('application/pdf')
  })

  it('keeps an image an image when its metadata contains "%PDF-"', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x25, 0x50, 0x44, 0x46, 0x2d])
    expect(detectMediaType(jpeg)).toBe('image/jpeg')
  })

  it('does not take a file that merely contains "%PDF-" for a PDF', () => {
    const html = new TextEncoder().encode('<html><body>%PDF-1.7</body></html>')
    expect(detectMediaType(html)).toBeNull()
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x25, 0x50, 0x44, 0x46, 0x2d])
    expect(detectMediaType(zip)).toBeNull()
  })

  it('does not take "%PDF" without the dash for a PDF', () => {
    expect(detectMediaType(new Uint8Array([0x0a, 0x25, 0x50, 0x44, 0x46, 0x0a]))).toBeNull()
  })
})

describe('sniffMediaType', () => {
  // A PDF after `junk` bytes of blank lines.
  const pdfAfter = (junk: number) => {
    const bytes = new Uint8Array(junk + 8).fill(0x0a)
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], junk)
    return bytes.buffer
  }

  it('looks at the first 1024 bytes only', () => {
    expect(sniffMediaType(pdfAfter(1000))).toBe('application/pdf')
    expect(sniffMediaType(pdfAfter(1100))).toBeNull()
  })

  it('handles files shorter than the sniff window', () => {
    expect(sniffMediaType(new Uint8Array([0xff, 0xd8, 0xff]).buffer)).toBe('image/jpeg')
    expect(sniffMediaType(new ArrayBuffer(0))).toBeNull()
  })
})

describe('extensionFor', () => {
  it('maps every media type to its storage extension', () => {
    expect(extensionFor('application/pdf')).toBe('pdf')
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/png')).toBe('png')
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('image/gif')).toBe('gif')
  })
})
