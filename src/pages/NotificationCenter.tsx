import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifStore, markNotifRead, markAllRead, authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { timeAgo, formatDateTime } from '../lib/utils'
import type { Notification } from '../data/types'

const CATEGORY_ICON: Record<Notification['category'], string> = {
  ticket: '📋',
  review: '✓',
  mention: '💬',
  system: '⚙',
  security: '🔒',
}

const CATEGORY_COLOR: Record<Notification['category'], string> = {
  ticket: 'var(--brand-700)',
  review: 'var(--emerald-700)',
  mention: 'var(--violet-700)',
  system: 'var(--ink-500)',
  security: 'var(--red-700)',
}

const CATEGORY_LABEL: Record<Notification['category'], string> = {
  ticket: 'Ticket',
  review: 'Review',
  mention: 'Mention',
  system: 'System',
  security: 'Security',
}

export default function NotificationCenter() {
  useEffect(() => { document.title = 'Notifications — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { items } = useStore(notifStore)
  const { user } = useStore(authStore)

  const mine = items.filter((n) => n.userId === user.id)
  const sorted = [...mine].sort((a, b) => b.ts.localeCompare(a.ts))
  const unread = sorted.filter((n) => !n.read).length

  const handleClick = (n: Notification) => {
    markNotifRead(n.id)
    if (n.link) navigate(n.link)
    else if (n.ticketId) navigate(`/requests/${n.ticketId}`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-sm" onClick={() => markAllRead(user.id)}>
            Mark all read
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
          No notifications yet.
        </div>
      ) : (
        <div>
          {sorted.map((n) => {
            const dotColor = CATEGORY_COLOR[n.category] ?? 'var(--ink-300)'
            const clickable = !!(n.link || n.ticketId)

            return (
              <div key={n.id}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => handleClick(n) : undefined}
                onKeyDown={clickable ? (e) => e.key === 'Enter' && handleClick(n) : undefined}
                style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  padding: '14px 24px',
                  borderBottom: '1px solid var(--line)',
                  background: n.read ? 'transparent' : 'var(--brand-50)',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'background var(--t-fast)',
                }}
                onMouseEnter={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' } : undefined}
                onMouseLeave={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : 'var(--brand-50)' } : undefined}
              >
                {/* Unread dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--brand-700)', marginTop: 6, flexShrink: 0 }} aria-hidden="true" />

                {/* Category icon */}
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)', flexShrink: 0, fontSize: 15 }} aria-hidden="true">
                  {CATEGORY_ICON[n.category]}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: dotColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {CATEGORY_LABEL[n.category]}
                    </span>
                    {n.ticketId && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)' }}>{n.ticketId}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.5, marginBottom: 4 }}>{n.body}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{timeAgo(n.ts)}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>{formatDateTime(n.ts)}</span>
                    {n.actionLabel && (
                      <span style={{ fontSize: 12, color: 'var(--brand-700)', fontWeight: 500 }}>{n.actionLabel}</span>
                    )}
                  </div>
                </div>

                {clickable && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', marginTop: 8, flexShrink: 0 }}>
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
