import { useServer } from '../../context/ServerContext'
import './Navbar.css'

function Navbar() {
  const { running, loading, actionError, handleStart, handleStop } = useServer()

  return (
    <header className="header">
      <h1>MC Manager</h1>
      <div className="controls">
        {actionError && (
          <span className="action-error" role="alert" title={actionError}>
            {actionError}
          </span>
        )}
        <span className={`status-dot ${running ? 'online' : 'offline'}`} />
        <span className="status-text">{running ? 'Running' : 'Stopped'}</span>
        {running ? (
          <button onClick={handleStop} disabled={loading} className="btn btn-stop">
            {loading ? 'Stopping...' : 'Stop Server'}
          </button>
        ) : (
          <button onClick={handleStart} disabled={loading} className="btn btn-start">
            {loading ? 'Starting...' : 'Start Server'}
          </button>
        )}
      </div>
    </header>
  )
}

export default Navbar
