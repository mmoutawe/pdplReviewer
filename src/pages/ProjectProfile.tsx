import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectById, TICKETS, userById } from '../data/seed'
import { EmptyState, StatusPill, SLAIndicator, Avatar } from '../components/primitives'
import { formatDate } from '../lib/utils'

const STATUS_COLORS: Record<string, string> = {
  active: 'pill-emerald',
  on_hold: 'pill-amber',
  closed: 'pill-slate',
}

export default function ProjectProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const proj = projectById(id ?? '')

  useEffect(() => { document.title = proj ? `${proj.name} — PDPL Reviewer` : 'Project — PDPL Reviewer' }, [proj])

  if (!proj) return <EmptyState title="Project not found" icon="📁"
    action={<button className="btn btn-primary" onClick={() => navigate('/projects')}>Back to projects</button>} />

  const relatedTickets = TICKETS.filter((t) => t.projectId === proj.id)
  const owner = userById(proj.ownerId)

  const byState: Record<string, number> = {}
  relatedTickets.forEach((t) => { byState[t.state] = (byState[t.state] ?? 0) + 1 })

  return (
    <div style={{ maxWidth: 860, padding: '28px 32px' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>← Projects</button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{proj.name}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>{proj.description}</p>
        </div>
        <span className={`pill pill-no-dot ${STATUS_COLORS[proj.status] ?? 'pill-slate'}`}>
          {proj.status.replace('_', ' ')}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Project details</h2>
          <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Business unit</dt>
              <dd>{proj.businessUnit}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Created</dt>
              <dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDate(proj.startedAt)}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: 'var(--ink-500)' }}>Total requests</dt>
              <dd>{relatedTickets.length}</dd>
            </div>
          </dl>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Project owner</h2>
          {owner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={owner.initials} color={owner.avatarColor} size={36} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{owner.fullName}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{owner.department}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>Owner not found.</p>
          )}
        </div>
      </div>

      {Object.keys(byState).length > 0 && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Request breakdown</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byState).map(([state, count]) => (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-500)' }}>{state.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: '14px 20px' }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Requests ({relatedTickets.length})</h2>
        {relatedTickets.length === 0 ? (
          <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No requests linked to this project.</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relatedTickets.map((t) => (
              <li key={t.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${t.id}`)}
                  style={{ justifyContent: 'flex-start', gap: 10, width: '100%' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)', flexShrink: 0 }}>{t.id}</span>
                  <StatusPill state={t.state} size="sm" />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--ink-800)' }}>{t.title}</span>
                  <SLAIndicator dueAt={t.sla.decisionDueAt} breached={t.sla.breached} compact />
                  <span style={{ fontSize: 12, color: 'var(--ink-400)', flexShrink: 0 }}>{formatDate(t.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
