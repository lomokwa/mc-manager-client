import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import Navbar from './components/navbar/Navbar'
import Console from './pages/Console'
import Players from './pages/Players'
import Properties from './pages/Properties'
import Files from './pages/Files'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import { ServerProvider } from './context/ServerContext'
import { ToastProvider } from './components/toast/ToastContext'

function App() {
  return (
    <BrowserRouter>
      <ServerProvider>
        <ToastProvider>
          <div className="app">
            <Sidebar />
            <div className="main-content">
              <Navbar />
              <Routes>
                <Route path="/" element={<Console />} />
                <Route path="/players" element={<Players />} />
                <Route path="/files" element={<Files />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </div>
        </ToastProvider>
      </ServerProvider>
    </BrowserRouter>
  )
}

export default App
