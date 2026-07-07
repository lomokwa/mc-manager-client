import { NavLink } from 'react-router-dom'
import { Terminal, Users, UserCog, FolderOpen, Archive, Server, SlidersHorizontal, LogOut, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import './Sidebar.css'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Console', icon: Terminal },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/users', label: 'Users', icon: UserCog },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/backups', label: 'Backups', icon: Archive },
  { to: '/server', label: 'Server', icon: Server },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
]

function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-item stagger-item ${isActive ? 'active' : ''}`}
            style={{ '--i': i } as React.CSSProperties}
            end={item.to === '/'}
          >
            <item.icon className="sidebar-icon" size={18} />
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="sidebar-item sidebar-logout" onClick={logout}>
        <LogOut className="sidebar-icon" size={18} />
        <span className="sidebar-label">Logout</span>
      </button>
    </aside>
  )
}

export default Sidebar