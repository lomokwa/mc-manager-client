import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="placeholder-page">
      <h2>404</h2>
      <p>This page doesn&apos;t exist.</p>
      <Link to="/" className="placeholder-link">Back to Console</Link>
    </div>
  )
}

export default NotFound
