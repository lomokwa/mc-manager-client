// Pure geometry for AvatarCropper -- kept separate from the component so the
// math (which is easy to get subtly wrong: sign errors in the pan clamp or
// the source-rect derivation show up as "crop looks fine until you drag to
// an edge") can be unit tested without a DOM/canvas.
//
// The crop UI shows the image inside a fixed `viewportSize` square. `scale`
// maps source-image pixels to on-screen pixels; `offsetX`/`offsetY` are how
// far the image's center has been dragged from the viewport's center, in
// on-screen pixels.

/** The scale at which the image just covers a square viewport (no zoom). */
export function coverScale(naturalWidth: number, naturalHeight: number, viewportSize: number): number {
  return viewportSize / Math.min(naturalWidth, naturalHeight)
}

/** How far the image can be panned on one axis before revealing empty space past its edge. */
export function maxOffset(naturalSize: number, scale: number, viewportSize: number): number {
  return Math.max(0, (naturalSize * scale - viewportSize) / 2)
}

/** Clamps a pan offset so the scaled image keeps fully covering the viewport. */
export function clampOffset(offset: number, naturalSize: number, scale: number, viewportSize: number): number {
  const m = maxOffset(naturalSize, scale, viewportSize)
  return Math.min(m, Math.max(-m, offset))
}

export interface CropLayout {
  /** On-screen position/size of the <img> within the viewport, in CSS px. */
  left: number
  top: number
  width: number
  height: number
}

/** Where to position/size the image element for a given scale + pan offset. */
export function computeLayout(
  naturalWidth: number,
  naturalHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  viewportSize: number,
): CropLayout {
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  return {
    left: viewportSize / 2 - width / 2 + offsetX,
    top: viewportSize / 2 - height / 2 + offsetY,
    width,
    height,
  }
}

export interface SourceRect {
  sx: number
  sy: number
  sSize: number
}

/**
 * The square region of the SOURCE image (in its own natural pixel
 * coordinates) that's currently visible in the viewport -- what a canvas
 * drawImage() call needs to reproduce exactly what's on screen.
 */
export function cropSourceRect(
  naturalWidth: number,
  naturalHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  viewportSize: number,
): SourceRect {
  const { left, top } = computeLayout(naturalWidth, naturalHeight, scale, offsetX, offsetY, viewportSize)
  return {
    // `|| 0` folds a resulting -0 (e.g. when left is exactly 0) into a plain
    // 0 -- numerically identical, but -0 is a confusing thing for a caller
    // (or a strict-equal test) to receive as a pixel coordinate.
    sx: -left / scale || 0,
    sy: -top / scale || 0,
    sSize: viewportSize / scale,
  }
}
