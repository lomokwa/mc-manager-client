import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coverScale, maxOffset, clampOffset, computeLayout, cropSourceRect } from '../src/lib/crop.ts'

test('coverScale: scales the shorter side to exactly fill the viewport', () => {
  // A 1000x500 landscape image in a 200x200 viewport: the short side (500)
  // must become 200, so scale = 0.4.
  assert.equal(coverScale(1000, 500, 200), 0.4)
  // A portrait image: the short side is now the width.
  assert.equal(coverScale(500, 1000, 200), 0.4)
  // A square image at 1:1.
  assert.equal(coverScale(300, 300, 300), 1)
})

test('maxOffset: zero once the image is scaled down to exactly the viewport size', () => {
  assert.equal(maxOffset(200, 1, 200), 0)
})

test('maxOffset: half the overhang on each side once scaled past the viewport', () => {
  // A 200px source scaled 2x is 400px on screen in a 200px viewport --
  // 200px of overhang total, 100px available to pan on each side.
  assert.equal(maxOffset(200, 2, 200), 100)
})

test('clampOffset: leaves an in-range offset untouched', () => {
  assert.equal(clampOffset(50, 200, 2, 200), 50)
})

test('clampOffset: pins to the max/min so the image can never reveal empty space', () => {
  assert.equal(clampOffset(500, 200, 2, 200), 100)
  assert.equal(clampOffset(-500, 200, 2, 200), -100)
})

test('computeLayout: centers the image in the viewport with no pan', () => {
  // A 100x100 source at 2x scale is 200x200 -- exactly the viewport, so it
  // sits flush at (0, 0).
  const layout = computeLayout(100, 100, 2, 0, 0, 200)
  assert.deepEqual(layout, { left: 0, top: 0, width: 200, height: 200 })
})

test('computeLayout: a positive offset shifts the image right/down on screen', () => {
  const layout = computeLayout(100, 100, 2, 30, -10, 200)
  assert.equal(layout.left, 30)
  assert.equal(layout.top, -10)
})

test('cropSourceRect: no pan and scale=1 crops exactly the viewport-sized square from the source center', () => {
  // A 200x200 source at scale 1 fills the 200x200 viewport exactly, so the
  // visible region is the whole image, starting at its origin.
  const rect = cropSourceRect(200, 200, 1, 0, 0, 200)
  assert.equal(rect.sx, 0)
  assert.equal(rect.sy, 0)
  assert.equal(rect.sSize, 200)
})

test('cropSourceRect: panning right reveals source pixels further left', () => {
  // A 400x400 source at scale 1 in a 200x200 viewport, panned +50px right on
  // screen, means the viewport is now looking at source pixels starting
  // further toward x=0 (the left side of the image) than the centered case.
  const centered = cropSourceRect(400, 400, 1, 0, 0, 200)
  const pannedRight = cropSourceRect(400, 400, 1, 50, 0, 200)
  assert.equal(centered.sx, 100)
  assert.equal(pannedRight.sx, 50)
  assert.equal(pannedRight.sSize, centered.sSize)
})

test('cropSourceRect: zooming in (higher scale) shrinks the visible source region', () => {
  const zoomedOut = cropSourceRect(400, 400, 1, 0, 0, 200)
  const zoomedIn = cropSourceRect(400, 400, 2, 0, 0, 200)
  assert.equal(zoomedOut.sSize, 200)
  assert.equal(zoomedIn.sSize, 100)
})
