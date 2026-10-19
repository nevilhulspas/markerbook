'use client'

import { useState } from 'react'
import { FileText, Image as ImageIcon } from 'lucide-react'

import { getChatAttachmentUrl } from '@/actions/chat-attachments'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { isImageAttachment, type AttachmentMeta } from '@/lib/insights/render-items'

const ATTACHMENT_CHIP_CLASS =
  'flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground'

/**
 * One attachment chip on a user message. Images open in an in-app preview
 * dialog (instead of dumping the raw signed URL in a new tab); PDFs and
 * anything else keep the new-tab link.
 */
export function AttachmentChip({ attachment }: { attachment: AttachmentMeta }) {
  const { filename, url, storagePath } = attachment
  // Upload-time signed URLs expire after an hour, so a long-lived session would
  // show a broken preview for older messages. Re-sign on every open; the stale
  // URL stays as the src until the fresh one lands (usually still valid).
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const handleOpenChange = (open: boolean) => {
    if (!open || !storagePath) return
    getChatAttachmentUrl(storagePath)
      .then((u) => {
        if (u) setFreshUrl(u)
      })
      .catch(() => {}) // keep the upload-time URL if re-signing fails
  }
  const isImage = isImageAttachment(attachment)

  if (!isImage) {
    return (
      <a href={url ?? '#'} target="_blank" rel="noreferrer" className={ATTACHMENT_CHIP_CLASS}>
        <FileText className="size-3" />
        {filename}
      </a>
    )
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className={ATTACHMENT_CHIP_CLASS}>
          <ImageIcon className="size-3" />
          {filename}
        </button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="w-fit max-w-[calc(100%-2rem)] p-2 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">{filename}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase
            storage URL (dynamic host + token); next/image gains nothing here */}
        <img
          src={freshUrl ?? url}
          alt={filename}
          className="max-h-[80vh] w-auto rounded-md object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
