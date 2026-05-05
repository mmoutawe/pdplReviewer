import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, ticketStore, notifStore } from '../store'
import { useStore } from '../hooks/useStore'
import { AUDIT, REQUEST_TYPE_LABELS, STATE_LABELS, ROLE_LABELS, userById, PRE_ASSESSMENTS } from '../data/seed'
import { KPI, StatusPill, SLAIndicator, Avatar, EmptyState, RiskBadge } from '../components/primitives'
import { formatDate, timeAgo } from '../lib/utils'
import type { Ticket } from '../data/types'

export default function Dashboard() {
  const { user } = useStore(authStore)
  const { tickets } = useStore(ticketStore)
  const { items: notifs } = useStore(notifStore)
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Dashboard — PDPL Reviewer' }, [])

  const myNotifs = notifs.filter((n) => n.userId === user.id && !n.read)
  const recentAudit = [...AUDIT].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6)

  // Role-specific ticket slices
  const myTickets = tickets.filter((t) => {
    if (user.role === 'requester') return t.requesterId === user.id
    if (user.role === 'data_management') return ['in_data_management', 'submitted'].includes(t.state)
    if (user.role === 'legal') return t.state === 'in_legal_review'
    if (user.role === 'security') return t.state === 'in_security_review'
    return true
  })

  const open = myTickets.filter((t) => !['approved', 'rejected', 'archived', 'draft'].includes(t.state))
  const slaAtRisk = open.filter((t) => {
    if (t.sla.breached) return true
    const h = (new Date(t.sla.decisionDueAt).getTime() - Date.now()) / 3600000
    return h < 24
  })
  const approved = tickets.filter((t) => t.state === 'approved').length
  const rejected = tickets.filter((t) => t.state === 'rejected').length

  function queuePath() {
    if (user.role === 'data_management') return '/queue/data_management'
    if (user.role === 'legal') return '/queue/legal'
    if (user.role === 'security') return '/queue/security'
    return '/requests'
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good {hour() < 12 ? 'morning' : hour() < 17 ? 'afternoon' : 'evening'},{' '}
            {user.fullName.split(' ')[0]}
          </h1>
          <p className="page-subtitle">
            {ROLE_LABELS[user.role]} · {formatDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user.role === 'requester' && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests/new')}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              New request
            </button>
          )}
          {(user.role === 'data_management' || user.role === 'legal' || user.role === 'security') && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate(queuePath())}>
              Open queue
            </button>
          )}
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          <KPI label="Open requests" value={open.length} sub="Awaiting action" color={open.length > 5 ? 'var(--amber-700)' : undefined} />
          <KPI label="SLA at risk" value={slaAtRisk.length} sub="< 24h or breached" color={slaAtRisk.length > 0 ? 'var(--red-700)' : undefined} />
          <KPI label="Approved (all time)" value={approved} trend="up" color="var(--emerald-700)" />
          <KPI label="Rejected (all time)" value={rejected} />
          {myNotifs.length > 0 && <KPI label="Unread alerts" value={myNotifs.length} color="var(--brand-700)" />}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16 }}>
          {/* My open tickets */}
          <section className="card" aria-labelledby="open-tickets-heading">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="open-tickets-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                {user.role === 'requester' ? 'My requests' : 'In my queue'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(user.role === 'requester' ? '/requests' : queuePath())}>
                View all
              </button>
            </div>
            {open.length === 0 ? (
              <EmptyState title="All clear" body="No open requests right now." icon="✓" />
            ) : (
              <ul>
                {open.slice(0, 6).map((t) => (
                  <TicketRow key={t.id} ticket={t} onClick={() => navigate(`/requests/${t.id}`)} />
                ))}
              </ul>
            )}
          </section>

          {/* Right column: SLA at risk + Recent activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SLA at risk */}
            <section className="card" aria-labelledby="sla-heading">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <h2 id="sla-heading" style={{ fontSize: 14, fontWeight: 600, color: slaAtRisk.length > 0 ? 'var(--red-700)' : 'var(--ink-900)' }}>
                  {slaAtRisk.length > 0 ? `⚠ ${slaAtRisk.length} SLA at risk` : 'SLA status'}
                </h2>
              </div>
              {slaAtRisk.length === 0 ? (
                <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-400)' }}>All SLAs on track.</div>
              ) : (
                <ul>
                  {slaAtRisk.map((t) => (
                    <li key={t.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <button onClick={() => navigate(`/requests/${t.id}`)}
                        style={{ width: '100%', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--red-50)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)' }}>{t.id}</span>
                          <SLAIndicator dueAt={t.sla.decisionDueAt} breached={t.sla.breached} compact />
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--ink-800)', fontWeight: 500 }}>{t.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent audit */}
            <section className="card" aria-labelledby="activity-heading">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
                <h2 id="activity-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Recent activity</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/audit')}>Ledger</button>
              </div>
              <ul style={{ padding: '8px 0' }}>
                {recentAudit.map((ev) => {
                  const actor = userById(ev.actorId)
                  return (
                    <li key={ev.id} style={{ padding: '8px 18px', display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid var(--line-soft)' }}>
                      {actor && <Avatar initials={actor.initials} color={actor.avatarColor} size={22} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-800)' }}>
                          <strong>{actor?.fullName ?? 'System'}</strong>{' '}
                          <span style={{ color: 'var(--ink-500)' }}>{ev.action.replace(/\./g, ' ')}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {timeAgo(ev.ts)} · {ev.targetId}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </div>

        {/* Unread notifications strip */}
        {myNotifs.length > 0 && (
          <section className="card" aria-labelledby="notif-heading">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 id="notif-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                Unread notifications
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/notifications')}>View all</button>
            </div>
            <ul>
              {myNotifs.slice(0, 4).map((n) => (
                <li key={n.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                  <strong style={{ color: 'var(--ink-800)' }}>{n.title}</strong>{' — '}
                  <span style={{ color: 'var(--ink-500)' }}>{n.body}</span>
                  {n.link && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}
                      onClick={() => navigate(n.link!)}>
                      {n.actionLabel ?? 'Open'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function hour() { return new Date().getHours() }

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === ticket.id)
  return (
    <li style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <button onClick={onClick} style={{
        width: '100%', padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'flex-start',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background var(--t-fast)',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)' }}>{ticket.id}</span>
            <StatusPill state={ticket.state} size="sm" />
            <SLAIndicator dueAt={ticket.sla.decisionDueAt} breached={ticket.sla.breached} compact />
            {assessment && <RiskBadge level={assessment.overallRisk} compact />}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-800)', marginBottom: 2 }}>{ticket.title}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>
            {REQUEST_TYPE_LABELS[ticket.type]} · {STATE_LABELS[ticket.state]}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', marginTop: 4, flexShrink: 0 }}>
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}
