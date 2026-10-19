'use client'

import { memo } from 'react'
import type { UIMessage } from 'ai'

import { attachmentsOf, messageText } from '@/lib/insights/render-items'
import { AttachmentChip } from './attachment-chip'

/**
 * One user message. Memoized so it never re-renders while the user types in the
 * input or while a later message streams (its props are referentially stable
 * unless this message itself changes). (AUT-898)
 */
export const UserMessage = memo(function UserMessage({ message }: { message: UIMessage }) {
  const textContent = messageText(message.parts)
  const atts = attachmentsOf(message)
  return (
    <div className="flex flex-col items-end gap-1">
      {atts.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1">
          {atts.map((a, i) => (
            <AttachmentChip key={i} attachment={a} />
          ))}
        </div>
      )}
      {textContent && (
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {textContent}
        </div>
      )}
    </div>
  )
})
