import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, ticketStore } from '../store'
import { useStore } from '../hooks/useStore'
import { REQUEST_TYPE_LABELS, ROLE_LABELS, PRE_ASSESSMENTS } from '../data/seed'
import { KPI, StatusPill, EmptyState, RiskBadge } from '../components/primitives'
import { formatDate } from '../lib/utils'
import type { ReactNode } from 'react'

export default function Dashboard() {
  const { user } = useStore(authStore)
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()

  useEffect(() => { document.title = 'Dashboard — PDPL Reviewer' }, [])

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

  // Requester-scoped KPIs
  const myApproved = myTickets.filter((t) => t.state === 'approved').length
  const myRejected = myTickets.filter((t) => t.state === 'rejected').length
  const myPending  = myTickets.filter((t) => !['approved', 'rejected', 'archived', 'draft'].includes(t.state)).length
  const myHighRisk = myTickets.filter((t) => {
    const a = PRE_ASSESSMENTS.find((pa) => pa.ticketId === t.id)
    return a?.overallRisk === 'high'
  }).length

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
            New Request
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
  const pending = myTickets.filter((t) => !['approved', 'rejected', 'archived', 'draft'].includes(t.state)).length
  const highRisk = myTickets.filter((t) => {
    const a = PRE_ASSESSMENTS.find((pa) => pa.ticketId === t.id)
    return a?.overallRisk === 'high' || a?.overallRisk === 'critical'
  }).length
  const myApproved2 = myTickets.filter((t) => t.state === 'approved').length
  const myRejected2 = myTickets.filter((t) => t.state === 'rejected').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.fullName}</p>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* KPI row — matches Lovable: Pending, Approved, High Risk, Rejected */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <ReviewerKPI
            label="Pending"
            value={pending}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6.5V10.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--emerald-50)"
            iconColor="var(--emerald-600)"
          />
          <ReviewerKPI
            label="Approved"
            value={myApproved2}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M7 10.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            iconBg="var(--emerald-50)"
            iconColor="var(--emerald-600)"
          />
          <ReviewerKPI
            label="High Risk"
            value={highRisk}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3L18 16H2L10 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 9v3M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            iconBg="var(--amber-50)"
            iconColor="var(--amber-600)"
            valueColor={highRisk > 0 ? 'var(--amber-700)' : undefined}
          />
          <ReviewerKPI
            label="Rejected"
            value={myRejected2}
            icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            iconBg="var(--red-50)"
            iconColor="var(--red-500)"
            valueColor={myRejected2 > 0 ? 'var(--red-700)' : undefined}
          />
        </div>

        {/* Review Queue table */}
        <section className="card" aria-labelledby="review-queue-heading">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="review-queue-heading" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>Review Queue</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(queuePath())}>View all</button>
          </div>
          {myTickets.length === 0 ? (
            <EmptyState title="Queue is clear" body="No tickets pending your review." icon="✓" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {['ID', 'Title', 'Status', 'Risk', 'Date'].map((h) => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-500)', fontSize: 12.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myTickets.slice(0, 10).map((t, i) => {
                    const assessment = PRE_ASSESSMENTS.find((a) => a.ticketId === t.id)
                    return (
                      <tr key={t.id}
                        style={{ borderBottom: i < Math.min(myTickets.length, 10) - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                        onClick={() => navigate(`/requests/${t.id}`)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-1)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>{t.id}</td>
                        <td style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--ink-900)' }}>{t.title}</td>
                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                          <StatusPill state={t.state} size="sm" />
                        </td>
                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                          {assessment ? <RiskBadge level={assessment.overallRisk} compact /> : <span style={{ color: 'var(--ink-300)' }}>—</span>}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12.5, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>
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

function ReviewerKPI({
  label, value, icon, iconBg, iconColor, valueColor,
}: {
  label: string; value: number; icon: ReactNode
  iconBg: string; iconColor: string; valueColor?: string
}) {
  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--r-lg)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: iconBg, color: iconColor,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: valueColor ?? 'var(--ink-900)', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}
