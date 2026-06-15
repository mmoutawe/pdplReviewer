import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUDIT, userById } from '../data/seed'
import { FilterBar } from '../components/table'
import { Avatar } from '../components/primitives'
import { formatDateTime, timeAgo } from '../lib/utils'

const ACTION_COLOR: Record<string, string> = {
  'ticket.created': 'var(--brand-700)',
  'ticket.submitted': 'var(--brand-700)',
  'ticket.state.transition': 'var(--emerald-700)',
  'ticket.review.decided': 'var(--emerald-700)',
  'ticket.returned': 'var(--amber-700)',
  'ticket.approved': 'var(--emerald-700)',
  'ticket.rejected': 'var(--red-700)',
  'ticket.archived': 'var(--ink-400)',
  'comment.added': 'var(--violet-700)',
  'attachment.uploaded': 'var(--violet-700)',
  'ai.assessment.run': 'var(--violet-700)',
  'user.signin': 'var(--ink-400)',
  'role.changed': 'var(--amber-700)',
}

function dotColor(action: string): string {
  return ACTION_COLOR[action] ?? 'var(--ink-300)'
}

export default function AuditLedger() {
  useEffect(() => { document.title = 'Audit Ledger — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const sorted = [...AUDIT].sort((a, b) => b.ts.localeCompare(a.ts))

  const visible = sorted.filter((ev) => {
    if (filterAction && ev.action !== filterAction) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        ev.targetId?.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q) ||
        ev.actorId.toLowerCase().includes(q) ||
        ev.id.toLowerCase().includes(q)
      )
    }
    return true
  })

  const uniqueActions = [...new Set(AUDIT.map((e) => e.action))].sort()

  function exportCSV() {
    const header = ['Timestamp', 'Actor ID', 'Actor Role', 'Action', 'Target Type', 'Target ID', 'Immutable Hash', 'Prev Hash']
    const rows = visible.map((ev) => [
      ev.ts,
      ev.actorId,
      ev.actorRole,
      ev.action,
      ev.targetType,
      ev.targetId ?? '',
      ev.immutableHash,
      ev.prevHash ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Ledger</h1>
          <p className="page-subtitle">Append-only immutable record · {AUDIT.length} entries</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Export visible entries to CSV">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v8M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Export CSV
          </button>
          <span style={{ fontSize: 11.5, background: 'var(--emerald-50)', color: 'var(--emerald-700)', border: '1px solid var(--emerald-200)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontWeight: 500 }}>
            Hash-chained · Tamper-evident
          </span>
        </div>
      </div>

      <FilterBar
        search={search} onSearch={setSearch} placeholder="Search by target ID, action, or actor…"
        filters={[{
          key: 'action', label: 'Action',
          options: uniqueActions.map((a) => ({ value: a, label: a })),
          value: filterAction, onChange: setFilterAction,
        }]}
      />

      <div style={{ padding: '0 24px 24px' }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 0', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
          {[
            { color: 'var(--brand-700)', label: 'Creation / Submission' },
            { color: 'var(--emerald-700)', label: 'Approval / Transition' },
            { color: 'var(--amber-700)', label: 'Return / Role change' },
            { color: 'var(--red-700)', label: 'Rejection' },
            { color: 'var(--violet-700)', label: 'AI / Comments' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-500)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>

        {visible.length === 0 ? (
          <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>No audit events match your filters.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visible.map((ev, i) => {
              const actor = userById(ev.actorId)
              const color = dotColor(ev.action)
              const isLast = i === visible.length - 1
              const isTicket = ev.targetType === 'ticket'

              return (
                <div key={ev.id} style={{ display: 'flex', gap: 0, position: 'relative' }}>
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid var(--surface-0)', marginTop: 16, flexShrink: 0, zIndex: 1, position: 'relative' }} />
                    {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--line)', minHeight: 16 }} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: '12px 0 12px 8px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', fontFamily: 'var(--font-mono)' }}>{ev.action}</span>
                      {isTicket && ev.targetId && (
                        <button className="btn btn-ghost btn-sm" style={{ height: 18, padding: '0 6px', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                          onClick={() => navigate(`/requests/${ev.targetId}`)}>
                          {ev.targetId}
                        </button>
                      )}
                      {!!(ev.before?.state) && !!(ev.after?.state) && (
                        <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>
                          {String(ev.before.state).replace(/_/g, ' ')} → {String(ev.after.state).replace(/_/g, ' ')}
                        </span>
                      )}
                      {ev.reason && (
                        <span style={{ fontSize: 11.5, color: 'var(--ink-500)', fontStyle: 'italic' }}>"{ev.reason}"</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      {actor && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar initials={actor.initials} color={actor.avatarColor} size={18} />
                          <span style={{ fontSize: 12, color: 'var(--ink-600)' }}>{actor.fullName}</span>
                          <span style={{ fontSize: 11, color: 'var(--ink-300)' }}>({ev.actorRole})</span>
                        </div>
                      )}
                      <span style={{ fontSize: 11.5, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                        {formatDateTime(ev.ts)}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{timeAgo(ev.ts)}</span>
                    </div>

                    {/* Hash */}
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>
                        id: {ev.id}
                      </span>
                      {ev.immutableHash && (
                        <span style={{ fontSize: 10, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>
                          hash: {ev.immutableHash.slice(0, 16)}…
                        </span>
                      )}
                      {ev.prevHash && (
                        <span style={{ fontSize: 10, color: 'var(--ink-300)', fontFamily: 'var(--font-mono)' }}>
                          prev: {ev.prevHash.slice(0, 16)}…
                        </span>
                      )}
                    </div>

                    {/* Before/after snapshot */}
                    {(ev.before || ev.after) && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11.5, color: 'var(--ink-400)', cursor: 'pointer', userSelect: 'none' }}>Show snapshot diff</summary>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                          {ev.before && (
                            <div>
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 3 }}>BEFORE</div>
                              <pre style={{ fontSize: 11, background: 'var(--red-50)', border: '1px solid var(--red-200)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', overflowX: 'auto', color: 'var(--ink-700)', margin: 0 }}>
                                {JSON.stringify(ev.before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {ev.after && (
                            <div>
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 3 }}>AFTER</div>
                              <pre style={{ fontSize: 11, background: 'var(--emerald-50)', border: '1px solid var(--emerald-200)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', overflowX: 'auto', color: 'var(--ink-700)', margin: 0 }}>
                                {JSON.stringify(ev.after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
