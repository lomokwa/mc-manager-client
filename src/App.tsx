import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import Navbar from './components/navbar/Navbar'
import Console from './pages/Console'
import Players from './pages/Players'
import Properties from './pages/Properties'
import Login from './pages/Login'
import Register from './pages/Register'
import { ServerProvider } from './context/ServerContext'
import { AuthProvider, useAuth } from './context/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ServerProvider>
              <div className="app">
                <Sidebar />
                <div className="main-content">
                  <Navbar />
                  <Routes>
                    <Route path="/" element={<Console />} />
                    <Route path="/players" element={<Players />} />
                    <Route path="/properties" element={<Properties />} />
                  </Routes>
                </div>
              </div>
            </ServerProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
