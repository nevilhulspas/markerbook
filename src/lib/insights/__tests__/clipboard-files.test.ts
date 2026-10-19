import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_UPLOAD_TYPES,
  ACCEPTED_UPLOAD_ACCEPT_ATTR,
  filesFromTransfer,
} from '@/lib/insights/clipboard-files'

function pngFile(name: string, bytes = [1, 2, 3]) {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' })
}

describe('ACCEPTED_UPLOAD constants', () => {
  it('exposes the accept attribute as a comma-joined string of the type list', () => {
    expect(ACCEPTED_UPLOAD_ACCEPT_ATTR).toBe(ACCEPTED_UPLOAD_TYPES.join(','))
    expect(ACCEPTED_UPLOAD_ACCEPT_ATTR).toContain('application/pdf')
    expect(ACCEPTED_UPLOAD_ACCEPT_ATTR).toContain('image/png')
  })
})

describe('filesFromTransfer', () => {
  it('returns [] for null/undefined source', () => {
    expect(filesFromTransfer(null)).toEqual([])
    expect(filesFromTransfer(undefined)).toEqual([])
  })

  it('keeps a named accepted image file unchanged', () => {
    const file = pngFile('screenshot.png')
    const out = filesFromTransfer({ files: [file] })
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('screenshot.png')
    expect(out[0].type).toBe('image/png')
  })

  it('keeps PDFs', () => {
    const pdf = new File([new Uint8Array([1])], 'report.pdf', { type: 'application/pdf' })
    const out = filesFromTransfer({ files: [pdf] })
    expect(out.map((f) => f.name)).toEqual(['report.pdf'])
  })

  it('names an unnamed clipboard image as pasted-image-1.png and preserves bytes/type', () => {
    const file = pngFile('', [9, 9, 9, 9])
    const out = filesFromTransfer({ files: [file] })
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('pasted-image-1.png')
    expect(out[0].type).toBe('image/png')
    expect(out[0].size).toBe(4)
  })

  it('falls back to items[].getAsFile() when files is empty', () => {
    const file = pngFile('')
    const out = filesFromTransfer({
      files: [],
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
    })
    expect(out.map((f) => f.name)).toEqual(['pasted-image-1.png'])
  })

  it('skips a file-kind item whose getAsFile() returns null', () => {
    const out = filesFromTransfer({
      files: [],
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => null }],
    })
    expect(out).toEqual([])
  })

  it('ignores text-only payloads', () => {
    const out = filesFromTransfer({
      files: [],
      items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }],
    })
    expect(out).toEqual([])
  })

  it('filters out unsupported file types', () => {
    const heic = new File([new Uint8Array([1])], 'photo.heic', { type: 'image/heic' })
    const out = filesFromTransfer({ files: [heic] })
    expect(out).toEqual([])
  })

  it('keeps the image and drops a non-accepted sibling in a mixed payload', () => {
    const img = pngFile('a.png')
    const doc = new File([new Uint8Array([1])], 'a.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const out = filesFromTransfer({ files: [img, doc] })
    expect(out.map((f) => f.name)).toEqual(['a.png'])
  })

  it('numbers multiple unnamed images sequentially', () => {
    const out = filesFromTransfer({ files: [pngFile(''), pngFile('')] })
    expect(out.map((f) => f.name)).toEqual(['pasted-image-1.png', 'pasted-image-2.png'])
  })
})
