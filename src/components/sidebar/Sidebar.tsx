import { Terminal, Users, FolderOpen, Settings, type LucideIcon } from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  active?: string
  onNavigate?: (page: string) => void
}

const navItems: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function Sidebar({ active = 'console', onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNavigate?.(item.id)}
          >
            <item.icon className="sidebar-icon" size={18} />
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar