import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X, ZoomIn } from 'lucide-react'
import { coverScale, clampOffset, computeLayout, cropSourceRect } from '../../lib/crop'
import './AvatarCropper.css'

// On-screen crop square (CSS px) and the exported image's pixel size. These
// are independent: OUTPUT is deliberately higher than VIEWPORT so a modest
// on-screen crop box still exports a reasonably sharp avatar.
const VIEWPORT = 260
const OUTPUT = 512
const MAX_ZOOM = 3

interface AvatarCropperProps {
  file: File
  onCancel: () => void
  /** Called with the cropped, re-encoded image once the user confirms. */
  onCropped: (file: File) => void
}

function AvatarCropper({ file, onCancel, onCropped }: AvatarCropperProps) {
  // Derived straight from the prop during render, not effect-driven state --
  // the cleanup (revoking the URL) is the only actual side effect here.
  const src = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => {
    return () => URL.revokeObjectURL(src)
  }, [src])

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1) // multiplier on top of the cover scale, 1..MAX_ZOOM
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const dragState = useRef<{ pointerId: number; x: number; y: number; offX: number; offY: number } | null>(null)

  const base = natural ? coverScale(natural.w, natural.h, VIEWPORT) : 1
  const scale = base * zoom
  const layout = natural ? computeLayout(natural.w, natural.h, scale, offset.x, offset.y, VIEWPORT) : null

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    setOffset({ x: 0, y: 0 })
    setZoom(1)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, offX: offset.x, offY: offset.y }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== e.pointerId || !natural) return
    setOffset({
      x: clampOffset(drag.offX + (e.clientX - drag.x), natural.w, scale, VIEWPORT),
      y: clampOffset(drag.offY + (e.clientY - drag.y), natural.h, scale, VIEWPORT),
    })
  }

  const endDrag = () => {
    dragState.current = null
  }

  const handleZoom = (value: number) => {
    setZoom(value)
    if (!natural) return
    const nextScale = base * value
    setOffset((o) => ({
      x: clampOffset(o.x, natural.w, nextScale, VIEWPORT),
      y: clampOffset(o.y, natural.h, nextScale, VIEWPORT),
    }))
  }

  const handleSave = () => {
    if (!natural) return
    setSaving(true)

    const img = new Image()
    img.onload = () => {
      const { sx, sy, sSize } = cropSourceRect(natural.w, natural.h, scale, offset.x, offset.y, VIEWPORT)
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setSaving(false)
        return
      }
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT)
      canvas.toBlob((blob) => {
        setSaving(false)
        if (blob) onCropped(new File([blob], 'avatar.png', { type: 'image/png' }))
      }, 'image/png')
    }
    img.src = src
  }

  return (
    <div className="ac-root">
      <div className="ac-scrim" onClick={saving ? undefined : onCancel} />
      <div className="ac-box" role="dialog" aria-modal="true" aria-label="Crop profile picture">
        <header className="ac-head">
          <h3>Crop photo</h3>
          <button className="ac-x" onClick={onCancel} disabled={saving} aria-label="Cancel">
            <X size={16} />
          </button>
        </header>

        <div
          className="ac-viewport"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            className="ac-img"
            src={src}
            alt=""
            draggable={false}
            onLoad={handleImgLoad}
            style={layout ? { left: layout.left, top: layout.top, width: layout.width, height: layout.height } : undefined}
          />
        </div>

        <p className="ac-hint">Drag to reposition, use the slider to zoom.</p>

        <div className="ac-zoom">
          <ZoomIn size={15} />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!natural}
            onChange={(e) => handleZoom(Number(e.target.value))}
          />
        </div>

        <footer className="ac-foot">
          <button className="ac-btn ac-btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="ac-btn ac-btn-primary" onClick={handleSave} disabled={saving || !natural}>
            <Check size={15} />
            {saving ? 'Saving…' : 'Use photo'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AvatarCropper
