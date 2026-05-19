import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { ticketStore } from '../store'
import { useStore } from '../hooks/useStore'
import { REQUEST_TYPE_LABELS, ROLE_LABELS } from '../data/seed'
import { StatusPill, SLAIndicator, Avatar, EmptyState } from '../components/primitives'
import { FilterBar } from '../components/table'
import type { Role, Ticket, TicketState } from '../data/types'
import { formatDate, slaStatus } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { fetchTickets, subscribeToTickets } from '../api/tickets'
import { getCachedUser } from '../lib/userCache'

const ROLE_QUEUE_STATE: Record<string, TicketState[]> = {
  data_management: ['submitted', 'in_data_management'],
  legal: ['in_legal_review'],
  security: ['in_security_review'],
}

export default function ReviewerQueue() {
  const { role } = useParams<{ role: string }>()
  const { tickets: storeTickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'sla' | 'date'>('sla')
  const [liveTickets, setLiveTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const queueRole = role as Role
  const states = ROLE_QUEUE_STATE[role ?? ''] ?? []

  useEffect(() => { document.title = `${ROLE_LABELS[queueRole] ?? 'Review'} Queue — PDPL Reviewer` }, [queueRole])

  useEffect(() => {
    if (!isSupabaseConfigured || !states.length) return
    setLoading(true)
    fetchTickets({ state: states })
      .then(setLiveTickets)
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load queue'))
      .finally(() => setLoading(false))

    return subscribeToTickets((updated) => {
      setLiveTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === updated.id)
        const inQueue = states.includes(updated.state)
        if (idx >= 0 && !inQueue) return prev.filter((t) => t.id !== updated.id)
        if (idx >= 0 && inQueue) { const next = [...prev]; next[idx] = updated; return next }
        if (idx < 0 && inQueue) return [updated, ...prev]
        return prev
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const baseTickets = isSupabaseConfigured ? liveTickets : storeTickets.filter((t) => states.includes(t.state))

  const visible = baseTickets
    .filter((t) => {
      if (!search) return true
      const q = search.toLowerCase()
      return t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'sla') {
        if (a.sla.breached !== b.sla.breached) return a.sla.breached ? -1 : 1
        return new Date(a.sla.decisionDueAt).getTime() - new Date(b.sla.decisionDueAt).getTime()
      }
      return b.createdAt.localeCompare(a.createdAt)
    })

  const breached = visible.filter((t) => t.sla.breached).length
  const atRisk = visible.filter((t) => {
    if (t.sla.breached) return false
    const h = (new Date(t.sla.decisionDueAt).getTime() - Date.now()) / 3600000
    return h < 24
  }).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ROLE_LABELS[queueRole] ?? 'Review'} Queue</h1>
          <p className="page-subtitle">{visible.length} ticket{visible.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 24px 0' }}>
        <QueueKPI
          label="In Queue"
          value={visible.length}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 5h12M4 10h12M4 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>}
          iconBg="var(--teal-50)" iconColor="var(--teal-600)"
        />
        <QueueKPI
          label="SLA Breached"
          value={breached}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          iconBg="var(--red-50)" iconColor="var(--red-700)"
          valueColor={breached > 0 ? 'var(--red-700)' : undefined}
        />
        <QueueKPI
          label="At Risk (< 24h)"
          value={atRisk}
          icon={<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6.5V10.5l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          iconBg="var(--amber-50)" iconColor="var(--amber-700)"
          valueColor={atRisk > 0 ? 'var(--amber-700)' : undefined}
        />
      </div>

      <FilterBar
        search={search} onSearch={setSearch} placeholder="Search ticket ID or title…"
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn btn-sm ${sortBy === 'sla' ? 'btn-primary' : ''}`} onClick={() => setSortBy('sla')}>Sort by SLA</button>
            <button className={`btn btn-sm ${sortBy === 'date' ? 'btn-primary' : ''}`} onClick={() => setSortBy('date')}>Sort by date</button>
          </div>
        }
      />

      {fetchError ? (
        <div style={{ margin: '24px', padding: '14px 16px', background: 'var(--red-50)', border: '1px solid #FECACA', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--red-700)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>Failed to load queue: {fetchError}</span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setFetchError(null); setLoading(true); fetchTickets({ state: states }).then(setLiveTickets).catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load queue')).finally(() => setLoading(false)) }}>Retry</button>
        </div>
      ) : loading ? (
        <ul>{Array.from({ length: 5 }).map((_, i) => <QueueRowSkeleton key={i} />)}</ul>
      ) : visible.length === 0 ? (
        <EmptyState title="Queue is empty" body="No tickets are currently assigned to this queue." icon={<CheckCircle size={26} color="var(--teal-600)" />} />
      ) : (
        <ul>
          {visible.map((t) => (
            <QueueRow key={t.id} ticket={t} onClick={() => navigate(`/requests/${t.id}`)} />
          ))}
        </ul>
      )}
    </div>
  )
}

function QueueRowSkeleton() {
  const s = (w: number | string, h = 12, mb = 0): React.CSSProperties => ({
    width: w, height: h, borderRadius: 4, display: 'inline-block', marginBottom: mb,
  })
  return (
    <li style={{ borderBottom: '1px solid var(--line)', padding: '16px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }} aria-hidden="true">
      <div className="skel" style={{ width: 4, height: 56, borderRadius: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <span className="skel" style={s(80)} />
          <span className="skel" style={s(64)} />
          <span className="skel" style={s(72)} />
        </div>
        <span className="skel" style={{ ...s('55%', 14, 8), display: 'block' }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <span className="skel" style={s(90)} />
          <span className="skel" style={s(110)} />
        </div>
      </div>
    </li>
  )
}

function QueueRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const { label: _label, color } = slaStatus(ticket.sla.decisionDueAt, ticket.sla.breached)
  const urgentBg = color === 'red' ? 'var(--red-50)' : color === 'amber' ? 'var(--amber-50)' : 'transparent'
  const reviewer = ticket.reviews[0]?.reviewerId ? getCachedUser(ticket.reviews[0].reviewerId) : null

  return (
    <li style={{ borderBottom: '1px solid var(--line)' }}>
      <button onClick={onClick} style={{
        width: '100%', padding: '16px 24px',
        display: 'flex', gap: 16, alignItems: 'flex-start',
        background: urgentBg, border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background var(--t-fast)',
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = urgentBg }}>
        {/* SLA bar */}
        <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: color === 'red' ? 'var(--red-700)' : color === 'amber' ? 'var(--amber-700)' : 'var(--emerald-700)', flexShrink: 0 }} aria-hidden="true" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>{ticket.id}</span>
            <StatusPill state={ticket.state} size="sm" />
            <SLAIndicator dueAt={ticket.sla.decisionDueAt} breached={ticket.sla.breached} compact />
            {ticket.dataDeclaration.containsSensitive && (
              <span className="pill pill-red pill-no-dot" style={{ height: 18, fontSize: 10, padding: '0 6px' }}>Sensitive data</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>{ticket.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-500)', display: 'flex', gap: 12 }}>
            <span>{REQUEST_TYPE_LABELS[ticket.type]}</span>
            <span>Submitted {ticket.submittedAt ? formatDate(ticket.submittedAt) : '—'}</span>
            <span>{ticket.dataDeclaration.estimatedSubjectCount.toLocaleString()} subjects</span>
          </div>
        </div>

        {reviewer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Avatar initials={reviewer.initials} color={reviewer.avatarColor} size={24} />
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{reviewer.fullName}</span>
          </div>
        )}

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', marginTop: 4, flexShrink: 0 }}>
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}

function QueueKPI({ label, value, icon, iconBg, iconColor, valueColor }: {
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
