/**
 * Pixels of the anchor's box that are occluded by the on-screen keyboard,
 * derived from a VisualViewport snapshot.
 *
 * `anchorBottom` is the padded element's `getBoundingClientRect().bottom` —
 * NOT `window.innerHeight`. In the iOS WKWebView the last visualViewport
 * event of a keyboard-show transition fires while innerHeight transiently
 * equals the shrunken visual height (it snaps back afterwards without firing
 * any further event), so an innerHeight-based inset froze at 0 and left the
 * chat input hidden behind the keyboard. The element's rect bottom is laid
 * out against the dvh page root, which the keyboard never resizes, so it is
 * stable at every moment of the transition.
 *
 * The occluded band is:
 *   anchorBottom - visualHeight - offsetTop
 *
 * Deltas below KEYBOARD_MIN_PX are treated as 0 — they come from the URL bar
 * showing/hiding, not a keyboard (real keyboards occlude ~200px+).
 */
const KEYBOARD_MIN_PX = 100

export function computeKeyboardInset(
  anchorBottom: number,
  visualHeight: number,
  offsetTop: number
): number {
  const occluded = anchorBottom - visualHeight - offsetTop
  return occluded > KEYBOARD_MIN_PX ? Math.round(occluded) : 0
}
