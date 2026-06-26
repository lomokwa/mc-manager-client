import { useEffect, useState } from 'react'
import { type ServerProperties, defaultProperties, propertyFields } from '../types/properties'
import './Properties.css'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api'
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

type SaveState = { status: 'idle' | 'saving' | 'success' | 'error'; message?: string }

// Coerce the API's string-valued properties back into the typed shape the
// form uses (booleans / numbers / strings), keeping the default for anything
// the server didn't return.
function coerceProperties(raw: Record<string, string>): ServerProperties {
  const result = { ...defaultProperties }
  const defs = defaultProperties as unknown as Record<string, string | number | boolean>
  const out = result as unknown as Record<string, string | number | boolean>
  for (const key of Object.keys(defs)) {
    const value = raw[key]
    if (value === undefined) continue
    out[key] =
      typeof defs[key] === 'boolean' ? value === 'true' : typeof defs[key] === 'number' ? Number(value) : value
  }
  return result
}

function Properties() {
  const [properties, setProperties] = useState<ServerProperties>({ ...defaultProperties })
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const [loaded, setLoaded] = useState(false)

  // Pre-load the server's current properties so the form reflects reality
  // rather than starting from defaults. Falls back to defaults if the
  // endpoint isn't available.
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/properties`, {
      headers: { 'X-API-Key': API_KEY, 'ngrok-skip-browser-warning': 'true' },
    })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body.success && body.data) {
          setProperties(coerceProperties(body.data))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (key: keyof ServerProperties, value: string | number | boolean) => {
    setProperties((prev) => ({ ...prev, [key]: value }))
    setSave({ status: 'idle' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSave({ status: 'saving' })

    // The API expects every property value as a string.
    const payload: Record<string, string> = {}
    for (const [key, value] of Object.entries(properties)) {
      payload[key] = String(value)
    }

    try {
      const res = await fetch(`${API_BASE}/properties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ properties: payload }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSave({ status: 'success', message: 'Saved — changes apply on the next server start.' })
      } else {
        setSave({ status: 'error', message: data.error ?? 'Failed to save properties' })
      }
    } catch {
      setSave({ status: 'error', message: 'Could not reach the server' })
    }
  }

  return (
    <div className="properties-page">
      <h2>Server Properties{!loaded && <span className="props-loading"> · loading current values…</span>}</h2>
      <form className="properties-form" onSubmit={handleSubmit}>
        {propertyFields.map((field) => (
          <div key={field.key} className="property-field">
            <label htmlFor={field.key}>{field.label}</label>
            {field.type === 'boolean' ? (
              <input
                id={field.key}
                type="checkbox"
                checked={properties[field.key] as boolean}
                onChange={(e) => handleChange(field.key, e.target.checked)}
              />
            ) : field.type === 'select' ? (
              <select
                id={field.key}
                value={properties[field.key] as string}
                onChange={(e) => handleChange(field.key, e.target.value)}
              >
                {field.options!.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'number' ? (
              <input
                id={field.key}
                type="number"
                value={properties[field.key] as number}
                onChange={(e) => handleChange(field.key, Number(e.target.value))}
              />
            ) : (
              <input
                id={field.key}
                type="text"
                value={properties[field.key] as string}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
            )}
          </div>
        ))}
        <button type="submit" className="btn btn-save" disabled={save.status === 'saving'}>
          {save.status === 'saving' ? 'Saving…' : 'Save Properties'}
        </button>
        {save.message && (
          <p className={`save-msg ${save.status === 'error' ? 'save-error' : 'save-success'}`}>{save.message}</p>
        )}
      </form>
    </div>
  )
}

export default Properties
