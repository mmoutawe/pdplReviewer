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

  // Only this user's notifications
  const myNotifs = notifs.filter((n) => n.userId === user.id && !n.read)

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

  // Requester-scoped KPIs
  const myApproved = myTickets.filter((t) => t.state === 'approved').length
  const myRejected = myTickets.filter((t) => t.state === 'rejected').length
  const myPending  = myTickets.filter((t) => !['approved', 'rejected', 'archived', 'draft'].includes(t.state)).length
  const myHighRisk = myTickets.filter((t) => {
    const a = PRE_ASSESSMENTS.find((pa) => pa.ticketId === t.id)
    return a?.overallRisk === 'high'
  }).length

  const recentAudit = [...AUDIT].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 6)

  function queuePath() {
    if (user.role === 'data_management') return '/queue/data_management'
    if (user.role === 'legal') return '/queue/legal'
    if (user.role === 'security') return '/queue/security'
    return '/requests'
  }

  // ── Requester dashboard ──────────────────────────────────────────────────────
  if (user.role === 'requester') {
    return (
      <div>
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
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests/new')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            + New Request
          </button>
        </div>

        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KPI row — Pending / Approved / High Risk / Rejected */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KPI label="Pending"   value={myPending}  sub="Awaiting action" />
            <KPI label="Approved"  value={myApproved} color="var(--emerald-700)" />
            <KPI label="High Risk" value={myHighRisk} color={myHighRisk > 0 ? 'var(--red-700)' : undefined} />
            <KPI label="Rejected"  value={myRejected} color={myRejected > 0 ? 'var(--amber-700)' : undefined} />
          </div>

          {/* Compliance at a glance */}
          <section className="card" aria-labelledby="compliance-heading" style={{ padding: '18px 24px' }}>
            <h2 id="compliance-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 20 }}>
              Compliance at a glance
            </h2>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
              <ComplianceRing
                rate={myApproved + myRejected > 0 ? Math.round((myApproved / (myApproved + myRejected)) * 100) : 0}
                label="Approval rate"
                sublabel={`${myApproved} of ${myApproved + myRejected} decisions`}
              />
              <ComplianceRing
                rate={myPending > 0 ? Math.round(((myPending - slaAtRisk.length) / myPending) * 100) : 100}
                label="SLA compliance"
                sublabel={`${Math.max(0, myPending - slaAtRisk.length)} of ${myPending} on track`}
              />
              <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Approved',    count: myApproved,           color: 'var(--emerald-700)', bg: 'var(--emerald-50)' },
                  { label: 'Rejected',    count: myRejected,           color: 'var(--red-700)',     bg: 'var(--red-50)' },
                  { label: 'In review',   count: myPending,            color: 'var(--amber-700)',   bg: 'var(--amber-50)' },
                  { label: 'SLA at risk', count: slaAtRisk.length,     color: 'var(--red-700)',     bg: 'var(--red-50)' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-600)', flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '1px 8px', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* My Requests table */}
          <section className="card" aria-labelledby="my-requests-heading">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="my-requests-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>My Requests</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')}>View all</button>
            </div>
            {myTickets.length === 0 ? (
              <EmptyState title="No tickets found" body="Submit a new request to get started." icon="📋" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--line)' }}>
                      {['ID', 'Title', 'Status', 'Risk', 'Date'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-500)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myTickets.slice(0, 8).map((t, i) => {
                      const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === t.id)
                      return (
                        <tr key={t.id}
                          style={{ borderBottom: i < Math.min(myTickets.length, 8) - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', transition: 'background var(--t-fast)' }}
                          onClick={() => navigate(`/requests/${t.id}`)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-1)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{t.id}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--ink-800)' }}>{t.title}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{REQUEST_TYPE_LABELS[t.type]}</div>
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <StatusPill state={t.state} size="sm" />
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            {assessment ? <RiskBadge level={assessment.overallRisk} compact /> : <span style={{ color: 'var(--ink-300)', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>
                            {t.submittedAt ? formatDate(t.submittedAt) : <span style={{ color: 'var(--ink-300)' }}>Draft</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    )
  }

  // ── Reviewer / Admin dashboard ───────────────────────────────────────────────
  return (
    <div>
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
        {(user.role === 'data_management' || user.role === 'legal' || user.role === 'security') && (
          <button className="btn btn-primary btn-lg" onClick={() => navigate(queuePath())}>Open queue</button>
        )}
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

        {/* Compliance at a glance */}
        <section className="card" aria-labelledby="compliance-heading" style={{ padding: '18px 24px' }}>
          <h2 id="compliance-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 20 }}>
            Compliance at a glance
          </h2>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
            <ComplianceRing
              rate={approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0}
              label="Approval rate"
              sublabel={`${approved} of ${approved + rejected} decisions`}
            />
            <ComplianceRing
              rate={open.length > 0 ? Math.round(((open.length - slaAtRisk.length) / open.length) * 100) : 100}
              label="SLA compliance"
              sublabel={`${open.length - slaAtRisk.length} of ${open.length} on track`}
            />
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Approved',    count: approved,               color: 'var(--emerald-700)', bg: 'var(--emerald-50)' },
                { label: 'Rejected',    count: rejected,               color: 'var(--red-700)',     bg: 'var(--red-50)' },
                { label: 'In review',   count: open.length,            color: 'var(--amber-700)',   bg: 'var(--amber-50)' },
                { label: 'SLA at risk', count: slaAtRisk.length,       color: 'var(--red-700)',     bg: 'var(--red-50)' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink-600)', flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '1px 8px', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16 }}>
          {/* Open tickets */}
          <section className="card" aria-labelledby="open-tickets-heading">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 id="open-tickets-heading" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>In my queue</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(queuePath())}>View all</button>
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

          {/* Right column */}
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
      </div>
    </div>
  )
}

function hour() { return new Date().getHours() }

function ComplianceRing({ rate, label, sublabel }: { rate: number; label: string; sublabel: string }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(rate, 100) / 100)
  const color = rate >= 80 ? 'var(--emerald-600)' : rate >= 60 ? 'var(--amber-600)' : 'var(--red-600)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={96} height={96} viewBox="0 0 96 96" aria-label={`${label}: ${rate}%`}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="var(--line)" strokeWidth={9} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x={48} y={44} textAnchor="middle" fontSize={15} fontWeight={700} fill={color}>{rate}%</text>
        <text x={48} y={60} textAnchor="middle" fontSize={10} fill="var(--ink-400)">{label}</text>
      </svg>
      <span style={{ fontSize: 11.5, color: 'var(--ink-400)', textAlign: 'center', maxWidth: 100 }}>{sublabel}</span>
    </div>
  )
}

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
