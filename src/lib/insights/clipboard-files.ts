// Extract chat-attachable files from a clipboard paste or a drag-and-drop payload.
//
// The same `DataTransfer` shape backs both `ClipboardEvent.clipboardData` and
// `DragEvent.dataTransfer`, so one pure helper serves paste AND drop. It is
// DOM-free (operates on a structural shape) so it can be unit-tested in the
// node test environment. The accepted-type list lives here too, as the single
// source of truth shared by the file <input>, paste, and drop.

export const ACCEPTED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/** Ready-to-use value for an `<input type="file" accept=...>`. */
export const ACCEPTED_UPLOAD_ACCEPT_ATTR = ACCEPTED_UPLOAD_TYPES.join(',')

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(type)
}

interface TransferItemLike {
  kind: string
  type: string
  getAsFile(): File | null
}

/** Structural shape satisfied by both `DataTransfer` and test fixtures. */
interface FileTransferLike {
  files?: ArrayLike<File> | null
  items?: ArrayLike<TransferItemLike> | null
}

/**
 * Pull accepted files out of a clipboard/drag payload. Returns `[]` when there
 * is nothing usable (so callers can let the browser's default paste/drop run).
 * Unnamed entries (clipboard images usually have no filename) are renamed to
 * `pasted-image-<n>.<ext>` — that name is what the pending-file chip displays
 * and what the upload action uses to build the storage path.
 */
export function filesFromTransfer(source: FileTransferLike | null | undefined): File[] {
  if (!source) return []

  let raw: File[] = []
  if (source.files && source.files.length > 0) {
    raw = Array.from(source.files)
  } else if (source.items) {
    for (const item of Array.from(source.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) raw.push(file)
      }
    }
  }

  const accepted: File[] = []
  let unnamed = 0
  for (const file of raw) {
    if (!isAcceptedType(file.type)) continue
    // Browsers give clipboard images an empty name; treat whitespace-only as empty too.
    if (file.name.trim()) {
      accepted.push(file)
    } else {
      unnamed += 1
      // The 'bin' fallback is unreachable — isAcceptedType guarantees a MIME_EXT hit.
      const ext = MIME_EXT[file.type] ?? 'bin'
      accepted.push(new File([file], `pasted-image-${unnamed}.${ext}`, { type: file.type }))
    }
  }
  return accepted
}
