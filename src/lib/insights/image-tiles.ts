// Prepare uploaded images for Anthropic vision.
//
// Anthropic downscales every image to ~1568px on the long edge AND ~1.15
// megapixels before the model sees it. For a normal-shaped photo that's fine —
// we just resize to those bounds (lossless vs. what Claude would do anyway, and
// keeps us under the 5 MB/image API cap). But for an extreme aspect ratio (a
// long lab receipt), scaling the long edge to 1568px crushes the short edge to
// a couple hundred pixels and the text becomes unreadable. For those we slice
// the long axis into ~1 MP, roughly-square PAGE TILES — each tile keeps a
// balanced shape so it isn't crushed, so the text stays sharp.
//
// `planImageLayout` is PURE (no DOM) so the tiling math is unit-tested;
// `prepareImageForUpload` is the thin canvas wrapper that runs in the browser.

export const MAX_LONG_EDGE = 1568
export const TARGET_MEGAPIXELS = 1_150_000
/** long:short above this → tile instead of plain resize. */
export const TILE_ASPECT_THRESHOLD = 2.2
/** Short edge of each page tile (keeps tiles ~square at ~1 MP). */
export const TILE_SHORT_EDGE = 1100
/** Fraction of overlap between adjacent tiles so a text line split across a
 *  tile boundary still appears whole in one of them. */
export const TILE_OVERLAP = 0.08
export const JPEG_QUALITY = 0.85

/** A source→dest blit: copy (sx,sy,sw,sh) from the original into a dw×dh canvas. */
export interface TileRect {
  sx: number
  sy: number
  sw: number
  sh: number
  dw: number
  dh: number
}

export interface ImagePlan {
  mode: 'single' | 'tiles'
  rects: TileRect[]
}

/** Scale (w,h) down to fit within MAX_LONG_EDGE and TARGET_MEGAPIXELS. */
function fitBounds(w: number, h: number): { dw: number; dh: number } {
  let scale = 1
  const longEdge = Math.max(w, h)
  if (longEdge > MAX_LONG_EDGE) scale = MAX_LONG_EDGE / longEdge
  let dw = w * scale
  let dh = h * scale
  if (dw * dh > TARGET_MEGAPIXELS) {
    const s = Math.sqrt(TARGET_MEGAPIXELS / (dw * dh))
    dw *= s
    dh *= s
  }
  return { dw: Math.max(1, Math.round(dw)), dh: Math.max(1, Math.round(dh)) }
}

/**
 * Decide how to turn a source image of `width`×`height` into one or more
 * upload-ready tiles. Normal aspect → one resized tile. Extreme aspect → a
 * column/row of overlapping ~1 MP page tiles along the long axis.
 */
export function planImageLayout(width: number, height: number): ImagePlan {
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)

  if (shortEdge === 0 || longEdge / shortEdge <= TILE_ASPECT_THRESHOLD) {
    const { dw, dh } = fitBounds(width, height)
    return { mode: 'single', rects: [{ sx: 0, sy: 0, sw: width, sh: height, dw, dh }] }
  }

  const portrait = height >= width
  const destShort = Math.min(shortEdge, TILE_SHORT_EDGE)
  const scale = destShort / shortEdge
  // dest long edge of a tile, capped so the tile stays ≤ TARGET_MEGAPIXELS and
  // ≤ MAX_LONG_EDGE.
  const destTileLong = Math.min(MAX_LONG_EDGE, Math.floor(TARGET_MEGAPIXELS / destShort))
  const srcTileLong = Math.max(1, Math.floor(destTileLong / scale))
  const step = Math.max(1, Math.floor(srcTileLong * (1 - TILE_OVERLAP)))

  const rects: TileRect[] = []
  for (let pos = 0; pos < longEdge; pos += step) {
    const srcLen = Math.min(srcTileLong, longEdge - pos)
    const destLong = Math.max(1, Math.round(srcLen * scale))
    rects.push(
      portrait
        ? { sx: 0, sy: pos, sw: width, sh: srcLen, dw: destShort, dh: destLong }
        : { sx: pos, sy: 0, sw: srcLen, sh: height, dw: destLong, dh: destShort }
    )
    if (pos + srcLen >= longEdge) break
  }
  return { mode: 'tiles', rects }
}

/**
 * Browser-only: turn an uploaded File into one or more JPEG blobs per
 * {@link planImageLayout}. Non-image files (PDFs) pass through unchanged.
 */
export async function prepareImageForUpload(file: File): Promise<Blob[]> {
  if (!file.type.startsWith('image/')) return [file]

  const bitmap = await createImageBitmap(file)
  try {
    const plan = planImageLayout(bitmap.width, bitmap.height)
    const blobs: Blob[] = []
    for (const r of plan.rects) {
      const canvas = document.createElement('canvas')
      canvas.width = r.dw
      canvas.height = r.dh
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')
      ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, r.dw, r.dh)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Image encode failed'))),
          'image/jpeg',
          JPEG_QUALITY
        )
      )
      blobs.push(blob)
    }
    return blobs
  } finally {
    bitmap.close()
  }
}
