import { useEffect, useState } from 'react'
import { useServer, type CreateServerConfig } from '../../context/ServerContext'
import { defaultProperties, basicPropertyFields, advancedPropertyFields, type PropertyField } from '../../types/properties'
import './ServerSetup.css'

interface GameVersion {
  id: string
  type: string
}

interface FabricLoaderVersion {
  loader: { version: string; stable: boolean }
}

function ServerSetup() {
  const { serverExists, loading, createServer, deleteServer, running, serverInfo } = useServer()

  const [serverType, setServerType] = useState('vanilla')
  const [releaseVersion, setReleaseVersion] = useState('')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [configureProperties, setConfigureProperties] = useState(false)
  const [properties, setProperties] = useState<Record<string, string>>(() => {
    const props: Record<string, string> = {}
    for (const [key, value] of Object.entries(defaultProperties)) {
      props[key] = String(value)
    }
    return props
  })

  const [gameVersions, setGameVersions] = useState<GameVersion[]>([])
  const [loaderVersions, setLoaderVersions] = useState<string[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // Fetch game versions from Mojang manifest
  useEffect(() => {
    setVersionsLoading(true)
    fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json')
      .then((res) => res.json())
      .then((data) => {
        const releases = data.versions.filter((v: GameVersion) => v.type === 'release')
        setGameVersions(releases)
        if (releases.length > 0 && !releaseVersion) {
          setReleaseVersion(releases[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setVersionsLoading(false))
  }, [])

  // Fetch Fabric loader versions when serverType is fabric and a game version is selected
  useEffect(() => {
    if (serverType !== 'fabric' || !releaseVersion) {
      setLoaderVersions([])
      setLoaderVersion('')
      return
    }

    fetch(`https://meta.fabricmc.net/v2/versions/loader/${releaseVersion}`)
      .then((res) => res.json())
      .then((data: FabricLoaderVersion[]) => {
        const versions = data.filter((v) => v.loader.stable).map((v) => v.loader.version)
        setLoaderVersions(versions)
        if (versions.length > 0) {
          setLoaderVersion(versions[0])
        }
      })
      .catch(() => setLoaderVersions([]))
  }, [serverType, releaseVersion])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const config: CreateServerConfig = {
      serverType,
      releaseVersion,
      loaderVersion: serverType === 'fabric' ? loaderVersion : undefined,
      createLaunchScript: true,
      configureProperties,
      properties: configureProperties ? properties : {},
    }

    try {
      await createServer(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server')
    }
  }

  const handleDelete = async () => {
    setError('')
    try {
      await deleteServer()
      setShowDeleteConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete server')
    }
  }

  const handlePropertyChange = (key: string, value: string) => {
    setProperties((prev) => ({ ...prev, [key]: value }))
  }

  const renderInput = (field: PropertyField, prefix: string) => {
    if (field.type === 'boolean') {
      return (
        <input
          id={`${prefix}-${field.key}`}
          type="checkbox"
          checked={properties[field.key] === 'true'}
          onChange={(e) => handlePropertyChange(field.key, String(e.target.checked))}
        />
      )
    }
    if (field.type === 'select') {
      return (
        <select
          id={`${prefix}-${field.key}`}
          value={properties[field.key]}
          onChange={(e) => handlePropertyChange(field.key, e.target.value)}
        >
          {field.options!.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        id={`${prefix}-${field.key}`}
        type={field.type === 'number' ? 'number' : 'text'}
        value={properties[field.key]}
        onChange={(e) => handlePropertyChange(field.key, e.target.value)}
      />
    )
  }

  if (serverExists) {
    return (
      <div className="server-setup-page">
        <h2>Server Management</h2>

        {error && <p className="setup-error">{error}</p>}

        <div className="server-info-card">
          <div className="server-info">
            <h3>Server Info</h3>
            <div className="server-info-grid">
              <div className="server-info-item">
                <span className="info-label">Type</span>
                <span className="info-value">{serverInfo?.serverType || 'Unknown'}</span>
              </div>
              <div className="server-info-item">
                <span className="info-label">Game Version</span>
                <span className="info-value">{serverInfo?.gameVersion || 'Unknown'}</span>
              </div>
              {serverInfo?.loaderVersion && (
                <div className="server-info-item">
                  <span className="info-label">Loader Version</span>
                  <span className="info-value">{serverInfo.loaderVersion}</span>
                </div>
              )}
            </div>
          </div>

          <div className="server-info-actions">
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={running || loading}
            >
              Delete Server
            </button>

            {running && (
              <p className="setup-hint">Stop the server before deleting it.</p>
            )}
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Delete Server</h3>
              <p className="delete-warning">
                This will permanently delete the server jar, world data, and all configuration files. This action cannot be undone.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="properties-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {basicPropertyFields.map((field) => (
              <tr key={field.key}>
                <td className="prop-name">{field.label}</td>
                <td className="prop-value">{renderInput(field, 'prop')}</td>
                <td className="prop-desc">{field.description}</td>
              </tr>
            ))}
            {showAdvanced && advancedPropertyFields.map((field) => (
              <tr key={field.key}>
                <td className="prop-name">{field.label}</td>
                <td className="prop-value">{renderInput(field, 'prop')}</td>
                <td className="prop-desc">{field.description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="properties-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
          </button>

          <button className="btn btn-primary" disabled={loading}>
            Save Properties
          </button>
        </div>

      </div>
    )
  }

  return (
    <div className="server-setup-page">
      <h2>Create Server</h2>

      {error && <p className="setup-error">{error}</p>}

      <form className="setup-form" onSubmit={handleCreate}>
        <div className="setup-section">
          <h3>Server Type</h3>
          <div className="setup-field">
            <label htmlFor="serverType">Type</label>
            <select
              id="serverType"
              value={serverType}
              onChange={(e) => setServerType(e.target.value)}
            >
              <option value="vanilla">Vanilla</option>
              <option value="fabric">Fabric</option>
            </select>
          </div>

          <div className="setup-field">
            <label htmlFor="releaseVersion">Game Version</label>
            <select
              id="releaseVersion"
              value={releaseVersion}
              onChange={(e) => setReleaseVersion(e.target.value)}
              disabled={versionsLoading}
            >
              {gameVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.id}</option>
              ))}
            </select>
          </div>

          {serverType === 'fabric' && (
            <div className="setup-field">
              <label htmlFor="loaderVersion">Loader Version</label>
              <select
                id="loaderVersion"
                value={loaderVersion}
                onChange={(e) => setLoaderVersion(e.target.value)}
                disabled={loaderVersions.length === 0}
              >
                {loaderVersions.length === 0 && (
                  <option value="">Loading...</option>
                )}
                {loaderVersions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="setup-section">
          <h3>
            <label className="setup-toggle">
              <input
                type="checkbox"
                checked={configureProperties}
                onChange={(e) => setConfigureProperties(e.target.checked)}
              />
              Configure Properties
            </label>
          </h3>

          {configureProperties && (
            <>
              <table className="properties-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {basicPropertyFields.map((field) => (
                    <tr key={field.key}>
                      <td className="prop-name">{field.label}</td>
                      <td className="prop-value">{renderInput(field, 'setup')}</td>
                      <td className="prop-desc">{field.description}</td>
                    </tr>
                  ))}
                  {showAdvanced && advancedPropertyFields.map((field) => (
                    <tr key={field.key}>
                      <td className="prop-name">{field.label}</td>
                      <td className="prop-value">{renderInput(field, 'setup')}</td>
                      <td className="prop-desc">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                className="btn btn-secondary advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </>
          )}
        </div>

        <button type="submit" className="btn btn-create" disabled={loading}>
          {loading ? 'Creating...' : 'Create Server'}
        </button>
      </form>
    </div>
  )
}

export default ServerSetup
