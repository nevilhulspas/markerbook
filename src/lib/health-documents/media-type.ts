export type MediaType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'

/**
 * Sniff the real file type from leading bytes so a crafted upload can't route an
 * arbitrary payload to the AI extraction path by lying about its MIME type.
 * Returns the canonical Anthropic media_type, or null if unrecognized.
 */
export function detectMediaType(bytes: Uint8Array): MediaType | null {
  if (indexOfPdfHeader(bytes) === 0) {
    return 'application/pdf'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'image/gif'
  }
  // Some generators put a BOM or blank lines before the "%PDF-" header. Accept
  // that, but only when nothing else precedes it: a ZIP or HTML file that merely
  // contains "%PDF-" must not pass as a PDF. Checked after the image signatures.
  if (indexOfPdfHeader(bytes) > 0) {
    return 'application/pdf'
  }
  return null
}

/** How many leading bytes `sniffMediaType` looks at — the PDF header window. */
export const SNIFF_BYTES = 1024

/** The one message every upload returns when the bytes are not a PDF or image. */
export const UNSUPPORTED_FILE_MESSAGE =
  'File contents do not match a supported PDF or image format.'

/** `detectMediaType` over the leading `SNIFF_BYTES` of a whole file. */
export function sniffMediaType(buffer: ArrayBuffer): MediaType | null {
  return detectMediaType(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, SNIFF_BYTES)))
}

/** The file extension a stored upload of this type gets. */
export function extensionFor(mediaType: MediaType): string {
  if (mediaType === 'application/pdf') return 'pdf'
  return mediaType === 'image/jpeg' ? 'jpg' : mediaType.slice('image/'.length)
}

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

const UTF8_BOM = [0xef, 0xbb, 0xbf]
// NUL, tab, line feed, form feed, carriage return, space.
const PDF_PREFIX_WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20])

/**
 * Where the "%PDF-" header starts, allowing only an optional UTF-8 BOM and
 * whitespace before it (within the first SNIFF_BYTES); -1 otherwise.
 */
function indexOfPdfHeader(bytes: Uint8Array): number {
  const end = Math.min(bytes.length, SNIFF_BYTES)
  let i = UTF8_BOM.every((b, j) => bytes[j] === b) ? UTF8_BOM.length : 0
  while (i < end && PDF_PREFIX_WHITESPACE.has(bytes[i])) i++
  if (i + PDF_HEADER.length > end) return -1
  return PDF_HEADER.every((b, j) => bytes[i + j] === b) ? i : -1
}
