import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Sidebar from './components/sidebar/Sidebar'
import Navbar from './components/navbar/Navbar'
import Console from './pages/Console'
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
            </Routes>
          </div>
        </div>
      </ServerProvider>
    </BrowserRouter>
  )
}

export default App
