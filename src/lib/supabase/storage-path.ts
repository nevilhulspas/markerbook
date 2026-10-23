import type { ChatAttachment } from '@/lib/database.types'

/**
 * Ownership check for storage paths (lab-pdfs and meal-photos buckets).
 *
 * Every upload writes `<userId>/<uuid>.<ext>` or `<userId>/<folder>/<uuid>.<ext>`.
 * Server code reads, signs and downloads with the service role, which bypasses
 * storage RLS — so a path that arrives from the client (a chat attachment, a
 * form field, a stored row) must be checked against this exact shape before it
 * is saved, downloaded or signed. A prefix check is not enough: `..`, `//`,
 * backslashes and percent-encoding can all walk out of the user's folder.
 */

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(`^${UUID}$`, 'i')

/** Sub-folders the upload actions write into (none = the user's root). */
export const STORAGE_FOLDERS = ['chat', 'dexa', 'genetics', 'microbiome', 'other', 'rmr'] as const

const PATH_RE = new RegExp(
  `^(${UUID})/(?:(?:${STORAGE_FOLDERS.join('|')})/)?${UUID}\\.[a-z0-9]{1,10}$`,
  'i'
)

/** True when `path` is a well-formed storage path inside `userId`'s folder. */
export function isOwnedPath(userId: string, path: unknown): path is string {
  if (typeof path !== 'string' || !UUID_RE.test(userId)) return false
  if (path.includes('..') || path.includes('//') || path.includes('\\') || path.includes('%')) {
    return false
  }
  if (path.split('/').some((segment) => segment === '.' || segment === '')) return false
  const match = PATH_RE.exec(path)
  return match !== null && match[1].toLowerCase() === userId.toLowerCase()
}

/** Throws unless `path` is a well-formed storage path inside `userId`'s folder. */
export function assertOwnedPath(userId: string, path: unknown): string {
  if (!isOwnedPath(userId, path)) throw new Error('This file is not authorized for your account.')
  return path
}

/** Every storage path an attachment refers to (`parts` for tiled images). */
export function attachmentPaths(att: Pick<ChatAttachment, 'storagePath' | 'parts'>): string[] {
  return att.parts && att.parts.length > 0 ? [att.storagePath, ...att.parts] : [att.storagePath]
}

/** True when every path on the attachment belongs to `userId`. */
export function isOwnedAttachment(userId: string, att: unknown): att is ChatAttachment {
  if (typeof att !== 'object' || att === null) return false
  const { storagePath, parts, mediaType, filename } = att as Record<string, unknown>
  if (typeof mediaType !== 'string' || typeof filename !== 'string') return false
  if (parts !== undefined && !(Array.isArray(parts) && parts.length <= 50)) return false
  return attachmentPaths({ storagePath: storagePath as string, parts: parts as string[] | undefined })
    .every((p) => isOwnedPath(userId, p))
}
