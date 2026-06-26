import { useState } from 'react'
import { type ServerProperties, defaultProperties, propertyFields } from '../types/properties'
import './Properties.css'

function Properties() {
  const [properties, setProperties] = useState<ServerProperties>({ ...defaultProperties })

  const handleChange = (key: keyof ServerProperties, value: string | number | boolean) => {
    setProperties((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: send properties to backend
    console.log('Save properties:', properties)
  }

  return (
    <div className="properties-page">
      <h2>Server Properties</h2>
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
        <button type="submit" className="btn btn-save">Save Properties</button>
      </form>
    </div>
  )
}

export default Properties
