import { NavLink } from 'react-router-dom'
import { Terminal, Users, FolderOpen, Settings, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import './Sidebar.css'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Console', icon: Terminal },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/properties', label: 'Properties', icon: Settings },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
]

function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            end={item.to === '/'}
          >
            <item.icon className="sidebar-icon" size={18} />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar