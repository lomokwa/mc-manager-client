import { NavLink } from 'react-router-dom'
import { Terminal, Users, UserCog, Activity, FolderOpen, Archive, Server, SlidersHorizontal, LogOut, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../context/PermissionsContext'
import type { Permission } from '../../lib/permissions'
import { getAvatarColor } from '../../lib/avatar'
import './Sidebar.css'

const navItems: { to: string; label: string; icon: LucideIcon; need?: Permission[] }[] = [
  { to: '/', label: 'Console', icon: Terminal, need: ['console.read'] },
  { to: '/players', label: 'Players', icon: Users, need: ['players.view'] },
  { to: '/performance', label: 'Performance', icon: Activity, need: ['performance.view'] },
  { to: '/users', label: 'Users', icon: UserCog, need: ['admin.manage_users', 'admin.manage_roles'] },
  { to: '/files', label: 'Files', icon: FolderOpen, need: ['files.read'] },
  { to: '/backups', label: 'Backups', icon: Archive, need: ['backups.view'] },
  { to: '/server', label: 'Server', icon: Server, need: ['server.start'] },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal }, // browser-local prefs, not permission-gated
]

function Sidebar() {
  const { logout, username } = useAuth()
  const { can } = usePermissions()
  const visibleItems = navItems.filter((item) => !item.need || item.need.some(can))

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {visibleItems.map((item, i) => (
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
      {username && (
        <NavLink to="/account" className="sidebar-user" title={`Signed in as ${username} — view your account`}>
          <span
            className="sidebar-user-avatar"
            aria-hidden="true"
            style={{ background: getAvatarColor(username) }}
          >
            {username.charAt(0).toUpperCase()}
          </span>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">{username}</span>
            <span className="sidebar-user-sub">Signed in</span>
          </div>
        </NavLink>
      )}
      <button className="sidebar-item sidebar-logout" onClick={logout}>
        <LogOut className="sidebar-icon" size={18} />
        <span className="sidebar-label">Logout</span>
      </button>
    </aside>
  )
}

export default Sidebar