export interface SwipeGesture {
  /** clientX where the touch began. */
  startX: number
  /** Horizontal travel since start (rightward positive). */
  dx: number
  /** Vertical travel since start. */
  dy: number
}

export interface EdgeSwipeConfig {
  /** Max distance from the left edge the touch may start. */
  edgeZonePx: number
  /** Min rightward travel to trigger opening. */
  thresholdPx: number
}

/**
 * True when a touch began near the left edge and has moved right far enough,
 * dominantly horizontally (so a vertical scroll never opens the drawer).
 */
export function shouldOpenDrawer(g: SwipeGesture, c: EdgeSwipeConfig): boolean {
  const startedAtEdge = g.startX <= c.edgeZonePx
  const movedRightEnough = g.dx >= c.thresholdPx
  const horizontalDominant = Math.abs(g.dx) > Math.abs(g.dy)
  return startedAtEdge && movedRightEnough && horizontalDominant
}

/**
 * True when a touch has moved LEFT far enough, dominantly horizontally — used to
 * retract (close) an open drawer via a swipe on the right half of the screen.
 * (The right-half start zone is enforced by the caller.)
 */
export function shouldCloseDrawer(
  g: SwipeGesture,
  c: { thresholdPx: number }
): boolean {
  const movedLeftEnough = g.dx <= -c.thresholdPx
  const horizontalDominant = Math.abs(g.dx) > Math.abs(g.dy)
  return movedLeftEnough && horizontalDominant
}
