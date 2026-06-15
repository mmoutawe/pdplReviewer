import type { AuditEvent } from '../data/types'
import { userById } from '../data/seed'
import { formatDateTime } from '../lib/utils'
import { Avatar } from './primitives'

const ACTION_LABEL: Record<string, string> = {
  'ticket.created': 'Created ticket',
  'ticket.submitted': 'Submitted ticket',
  'ticket.assigned': 'Assigned to reviewer',
  'ticket.returned': 'Returned to requester',
  'ticket.approved': 'Ticket approved',
  'ticket.rejected': 'Ticket rejected',
  'review.decided': 'Review decision recorded',
  'review.in_progress': 'Review started',
  'thread.comment.added': 'Added return comment',
  'thread.comment.replied': 'Replied to return comment',
  'ai.generation.completed': 'AI assessment generated',
  'ai.evaluate_reply': 'AI evaluated reply',
  'role.assigned': 'Role assigned',
  'policy.updated': 'Policy updated',
}

const ACTION_COLOR: Record<string, string> = {
  'ticket.approved': 'var(--emerald-700)',
  'ticket.rejected': 'var(--red-700)',
  'ticket.returned': 'var(--amber-700)',
  'review.decided': 'var(--brand-700)',
  'ai.generation.completed': 'var(--violet-700)',
  'ai.evaluate_reply': 'var(--violet-700)',
}

interface Props { events: AuditEvent[]; compact?: boolean }

export function AuditTimeline({ events, compact = false }: Props) {
  const sorted = [...events].sort((a, b) => b.ts.localeCompare(a.ts))
  return (
    <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }} aria-label="Audit timeline">
      {sorted.map((ev, idx) => {
        const actor = userById(ev.actorId)
        const isLast = idx === sorted.length - 1
        const color = ACTION_COLOR[ev.action] ?? 'var(--ink-300)'
        return (
          <li key={ev.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
            {/* Line */}
            {!isLast && (
              <div aria-hidden="true" style={{
                position: 'absolute', left: 13, top: 28, bottom: 0, width: 1,
                background: 'var(--line)', zIndex: 0,
              }} />
            )}
            {/* Dot */}
            <div style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
              background: 'var(--surface-0)', border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1, marginTop: compact ? 8 : 10,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: compact ? 10 : 16, paddingTop: compact ? 6 : 8, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                {actor && !compact && <Avatar initials={actor.initials} color={actor.avatarColor} size={22} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-800)', fontWeight: 500 }}>
                    {ACTION_LABEL[ev.action] ?? ev.action}
                    {actor && <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}> by {actor.fullName}</span>}
                  </div>
                  {ev.reason && (
                    <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, fontStyle: 'italic' }}>
                      "{ev.reason}"
                    </div>
                  )}
                  {!compact && (ev.before ?? ev.after) && (
                    <div style={{
                      marginTop: 6, padding: '6px 10px',
                      background: 'var(--surface-1)', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--line)', fontSize: 11.5,
                      fontFamily: 'var(--font-mono)', color: 'var(--ink-600)',
                    }}>
                      {ev.before && <div style={{ color: 'var(--red-700)', marginBottom: ev.after ? 2 : 0 }}>− {JSON.stringify(ev.before)}</div>}
                      {ev.after && <div style={{ color: 'var(--emerald-700)' }}>+ {JSON.stringify(ev.after)}</div>}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {formatDateTime(ev.ts)}
                    {!compact && <span style={{ color: 'var(--ink-300)', marginLeft: 8 }}>{ev.immutableHash}</span>}
                  </div>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
