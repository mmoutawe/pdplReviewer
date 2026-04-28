import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifStore, markNotifRead, markAllRead, unreadCount } from '../store'
import { useStore } from '../hooks/useStore'
import { timeAgo } from '../lib/utils'
import type { Role } from '../data/types'

const CAT_ICON: Record<string, string> = {
  ticket: '🎫', review: '🔍', mention: '@', system: '⚙', security: '🔒',
}

interface Props { userId: string; role: Role }

export function NotificationBell({ userId, role: _role }: Props) {
  const [open, setOpen] = useState(false)
  const { items } = useStore(notifStore)
  const navigate = useNavigate()
  const mine = items.filter((n) => n.userId === userId)
  const unread = unreadCount(userId)

  function handleClick(id: string, link?: string) {
    markNotifRead(id)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm focus-ring"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications — ${unread} unread`}
        aria-haspopup="true"
        aria-expanded={open}
        style={{ padding: '0 8px', position: 'relative', gap: 0 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 2a5.5 5.5 0 00-5.5 5.5c0 2.5-.8 3.8-1.5 4.5h14c-.7-.7-1.5-2-1.5-4.5A5.5 5.5 0 009 2z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7.5 15a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span aria-hidden="true" style={{
            position: 'absolute', top: 3, right: 3,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--red-700)', border: '1.5px solid var(--surface-0)',
          }} />
        )}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            width: 380, maxHeight: 480,
            background: 'var(--surface-0)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)',
            zIndex: 50, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                Notifications {unread > 0 && <span style={{ color: 'var(--red-700)' }}>({unread})</span>}
              </span>
              {unread > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => markAllRead(userId)} style={{ fontSize: 12 }}>
                  Mark all read
                </button>
              )}
            </div>
            <ul style={{ overflow: 'auto', flex: 1 }}>
              {mine.length === 0 && (
                <li style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
                  All caught up
                </li>
              )}
              {mine.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n.id, n.link)}
                    style={{
                      width: '100%', padding: '12px 16px', textAlign: 'left',
                      background: n.read ? 'transparent' : 'var(--brand-50)',
                      borderBottom: '1px solid var(--line-soft)',
                      display: 'flex', gap: 10, cursor: 'pointer',
                      border: 'none', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--line-soft)',
                      transition: 'background var(--t-fast)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = n.read ? 'transparent' : 'var(--brand-50)' }}>
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }} aria-hidden="true">
                      {CAT_ICON[n.category] ?? '🔔'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--ink-900)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                        {timeAgo(n.ts)}
                      </div>
                    </div>
                    {!n.read && (
                      <span aria-label="Unread" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-700)', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); navigate('/notifications') }} style={{ width: '100%', justifyContent: 'center' }}>
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
