import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authStore, signIn, signOut } from '../store'
import { useStore } from '../hooks/useStore'
import { USERS, ROLE_LABELS } from '../data/seed'
import type { Role } from '../data/types'
import Logo from './Logo'
import { Avatar, RoleBadge } from './primitives'
import { NotificationBell } from './NotificationBell'
import { useMobile } from '../hooks/useMobile'

// ─── Nav items per role ───────────────────────────────────────────────────────
interface NavItem { label: string; path: string; icon: ReactNode; exact?: boolean }

function DashIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>
}
function TicketIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
function QueueIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
function PolicyIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 5.5h5M5.5 8.5h5M5.5 11.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
function VendorIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 14v-3l1-1h8l1 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/></svg>
}
function AuditIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function AdminIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2l1.5 3.5 3.5.5-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
}
function ArchIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 13L7 3l3 7 2-3 2 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function NewIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
}
function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 5.5h5M5.5 8.5h5M5.5 11.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
function TemplateIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="7" width="5" height="7" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="7" width="5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>
}

function getNavItems(role: Role): NavItem[] {
  const base: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashIcon />, exact: true },
  ]
  const requesterItems: NavItem[] = [
    { label: 'My Requests', path: '/requests', icon: <TicketIcon /> },
    { label: 'New Request', path: '/requests/new', icon: <NewIcon /> },
    { label: 'Policies', path: '/policies', icon: <PolicyIcon /> },
    { label: 'Documents', path: '/documents', icon: <DocIcon /> },
  ]
  const reviewerItems: NavItem[] = [
    { label: 'Queue', path: `/queue/${role}`, icon: <QueueIcon /> },
    { label: 'All Requests', path: '/requests', icon: <TicketIcon /> },
    { label: 'Policies', path: '/policies', icon: <PolicyIcon /> },
    { label: 'Vendors', path: '/vendors', icon: <VendorIcon /> },
    { label: 'Documents', path: '/documents', icon: <DocIcon /> },
    { label: 'Templates', path: '/templates', icon: <TemplateIcon /> },
    { label: 'Audit Ledger', path: '/audit', icon: <AuditIcon /> },
  ]
  const adminItems: NavItem[] = [
    { label: 'All Requests', path: '/requests', icon: <TicketIcon /> },
    { label: 'Policies', path: '/policies', icon: <PolicyIcon /> },
    { label: 'Vendors', path: '/vendors', icon: <VendorIcon /> },
    { label: 'Documents', path: '/documents', icon: <DocIcon /> },
    { label: 'Templates', path: '/templates', icon: <TemplateIcon /> },
    { label: 'Audit Ledger', path: '/audit', icon: <AuditIcon /> },
    { label: 'Admin', path: '/admin', icon: <AdminIcon /> },
  ]
  const archItem: NavItem = { label: 'Architecture', path: '/architecture', icon: <ArchIcon /> }

  if (role === 'requester') return [...base, ...requesterItems, archItem]
  if (role === 'data_management' || role === 'legal' || role === 'security') return [...base, ...reviewerItems, archItem]
  if (role === 'admin') return [...base, ...adminItems, archItem]
  return base
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
interface TopBarProps { collapsed: boolean; onToggle: () => void; isMobile: boolean }

function TopBar({ collapsed, onToggle, isMobile }: TopBarProps) {
  const { user } = useStore(authStore)
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [roleSwitchOpen, setRoleSwitchOpen] = useState(false)

  const demoUsers = USERS.filter((u) => u.role !== 'external_recipient')

  return (
    <header style={{
      height: 'var(--topbar-h)', display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: isMobile ? 8 : 12,
      borderBottom: '1px solid var(--line)',
      background: 'var(--surface-0)',
      position: 'sticky', top: 0, zIndex: 40, flexShrink: 0,
    }}>
      {/* Hamburger + Logo */}
      <button className="btn btn-ghost btn-sm focus-ring" onClick={onToggle}
        aria-label={isMobile ? (collapsed ? 'Open navigation' : 'Close navigation') : (collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
        style={{ padding: '0 6px', minWidth: 28 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <Link to="/dashboard" style={{ textDecoration: 'none' }} aria-label="PDPL Reviewer home">
        <Logo size="md" collapsed={!isMobile && collapsed} />
      </Link>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Role switcher — demo only */}
      <div style={{ position: 'relative' }}>
        <button className="btn btn-sm focus-ring" onClick={() => setRoleSwitchOpen((o) => !o)}
          style={{ gap: 6 }} aria-label="Switch demo role" aria-haspopup="true" aria-expanded={roleSwitchOpen}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 6h10M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!isMobile && 'Demo role'}
          <RoleBadge role={user.role} size="sm" />
        </button>
        {roleSwitchOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setRoleSwitchOpen(false)} aria-hidden="true" />
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: 'var(--surface-0)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
              zIndex: 50, width: 280, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-400)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Switch demo persona
              </div>
              {demoUsers.map((u) => (
                <button key={u.id} onClick={() => { signIn(u.id); setRoleSwitchOpen(false); navigate('/dashboard') }}
                  style={{
                    width: '100%', padding: '10px 14px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: u.id === user.id ? 'var(--brand-50)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid var(--line-soft)',
                    transition: 'background var(--t-fast)',
                  }}
                  onMouseEnter={(e) => { if (u.id !== user.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (u.id !== user.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  <Avatar initials={u.initials} color={u.avatarColor} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{u.fullName}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{ROLE_LABELS[u.role]}</div>
                  </div>
                  {u.id === user.id && <span style={{ marginLeft: 'auto', color: 'var(--brand-700)', fontSize: 12 }}>✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <NotificationBell userId={user.id} role={user.role} />

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button className="btn btn-ghost btn-sm focus-ring" onClick={() => setUserMenuOpen((o) => !o)}
          style={{ padding: '0 4px', gap: 6 }}
          aria-label="User menu" aria-haspopup="true" aria-expanded={userMenuOpen}>
          <Avatar initials={user.initials} color={user.avatarColor} size={28} />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {userMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: 'var(--surface-0)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
              zIndex: 50, width: 220,
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{user.fullName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{user.email}</div>
              </div>
              <div style={{ padding: 4 }}>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { navigate('/notifications'); setUserMenuOpen(false) }}>
                  Notifications
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { navigate('/notifications/preferences'); setUserMenuOpen(false) }}>
                  Notification preferences
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { navigate('/change-password'); setUserMenuOpen(false) }}>
                  Change password
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
                  onClick={() => { navigate('/architecture'); setUserMenuOpen(false) }}>
                  Architecture doc
                </button>
                <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--red-700)' }}
                  onClick={() => { signOut(); navigate('/sign-in') }}>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

// ─── LeftRail ─────────────────────────────────────────────────────────────────
interface RailProps { collapsed: boolean; isMobile: boolean; onClose: () => void }

function LeftRail({ collapsed, isMobile, onClose }: RailProps) {
  const { user } = useStore(authStore)
  const location = useLocation()
  const navItems = getNavItems(user.role)

  // Close mobile drawer on route change
  useEffect(() => { if (isMobile) onClose() }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(item: NavItem) {
    if (item.exact) return location.pathname === item.path
    return location.pathname.startsWith(item.path)
  }

  const drawerOpen = isMobile && !collapsed

  return (
    <aside style={isMobile ? {
      position: 'fixed',
      top: 'var(--topbar-h)',
      left: 0,
      height: 'calc(100vh - var(--topbar-h))',
      width: 'var(--leftrail-w)',
      zIndex: 60,
      background: 'var(--surface-0)',
      borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column',
      transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform var(--t-slow) var(--ease-out)',
      boxShadow: drawerOpen ? 'var(--shadow-lg)' : 'none',
    } : {
      width: collapsed ? 'var(--leftrail-w-collapsed)' : 'var(--leftrail-w)',
      flexShrink: 0, borderRight: '1px solid var(--line)',
      background: 'var(--surface-0)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'width var(--t-slow) var(--ease-out)',
    }} aria-label="Main navigation">
      <nav style={{ padding: '8px 8px', flex: 1, overflow: 'auto' }}>
        <ul>
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.path}>
                <Link to={item.path} style={{ textDecoration: 'none' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 'var(--r-md)',
                    fontSize: 13.5, fontWeight: active ? 600 : 400,
                    color: active ? 'var(--brand-700)' : 'var(--ink-600)',
                    background: active ? 'var(--brand-50)' : 'transparent',
                    transition: 'background var(--t-fast), color var(--t-fast)',
                    cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLSpanElement).style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLSpanElement).style.background = 'transparent' }}>
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                    {!collapsed && item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom: user info strip */}
      {!collapsed && (
        <div style={{
          padding: '12px 14px', borderTop: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Avatar initials={user.initials} color={user.avatarColor} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{ROLE_LABELS[user.role]}</div>
          </div>
        </div>
      )}
    </aside>
  )
}

// ─── Shell (Layout wrapper) ───────────────────────────────────────────────────
interface ShellProps { children: ReactNode }

export default function Shell({ children }: ShellProps) {
  const isMobile = useMobile()
  // Desktop: collapsed = sidebar icon-only mode
  // Mobile: collapsed = drawer hidden
  const [collapsed, setCollapsed] = useState(false)

  // When switching to mobile, close the drawer by default
  useEffect(() => { if (isMobile) setCollapsed(true) }, [isMobile])

  const drawerOpen = isMobile && !collapsed

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} isMobile={isMobile} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mobile backdrop */}
        {drawerOpen && (
          <div
            aria-hidden="true"
            onClick={() => setCollapsed(true)}
            style={{
              position: 'fixed', inset: 0, top: 'var(--topbar-h)',
              background: 'rgba(0,0,0,0.35)', zIndex: 55,
            }}
          />
        )}
        <LeftRail collapsed={collapsed} isMobile={isMobile} onClose={() => setCollapsed(true)} />
        <main id="main-content" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
