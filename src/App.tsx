import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import Navbar from './components/navbar/Navbar'
import Console from './pages/Console'
import Players from './pages/Players'
import Properties from './pages/Properties'
import { ServerProvider } from './context/ServerContext'

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

export default App
