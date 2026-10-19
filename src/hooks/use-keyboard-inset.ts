'use client'

import { useEffect, useState, type RefObject } from 'react'

import { computeKeyboardInset } from '@/lib/mobile/keyboard-inset'

/**
 * Returns how many px of `anchorRef`'s box the on-screen keyboard currently
 * occludes at the bottom of the viewport (0 when no keyboard or unsupported).
 * Drives the chat input so it rides above the keyboard. Pure web — no native
 * plugin.
 *
 * The element's own rect bottom is the measuring stick (see
 * computeKeyboardInset for why window.innerHeight cannot be trusted in the
 * iOS WKWebView). The window scroll listener re-measures after the document
 * scroll that iOS performs to reveal a focused input is snapped back — that
 * snap moves the anchor without emitting any visualViewport event.
 */
export function useKeyboardInset(
  anchorRef: RefObject<HTMLElement | null>
): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const anchorBottom =
        anchorRef.current?.getBoundingClientRect().bottom ?? window.innerHeight
      setInset(computeKeyboardInset(anchorBottom, vv.height, vv.offsetTop))
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('scroll', update)
    }
  }, [anchorRef])

  return inset
}
