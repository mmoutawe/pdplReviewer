import { useState } from 'react'
import type { ReturnThreadEntry } from '../data/types'
import { userById } from '../data/seed'
import { Avatar, RoleBadge } from './primitives'
import { timeAgo } from '../lib/utils'

interface ThreadProps {
  entries: ReturnThreadEntry[]
  onReply?: (msg: string) => void
  readOnly?: boolean
}

export function CommentThread({ entries, onReply, readOnly = false }: ThreadProps) {
  const [draft, setDraft] = useState('')

  return (
    <div>
      {entries.length === 0 && (
        <p style={{ color: 'var(--ink-400)', fontSize: 13, padding: '12px 0' }}>No comments yet.</p>
      )}
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map((e) => {
          const user = userById(e.by)
          return (
            <li key={e.id} style={{
              background: 'var(--surface-0)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {user && <Avatar initials={user.initials} color={user.avatarColor} size={24} />}
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-800)' }}>
                  {user?.fullName ?? e.by}
                </span>
                <RoleBadge role={e.byRole} size="sm" />
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                  {timeAgo(e.createdAt)}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.65, margin: 0 }}>{e.message}</p>
              {e.resolvedAt && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--emerald-700)', fontWeight: 500 }}>
                  ✓ Resolved {timeAgo(e.resolvedAt)}
                </div>
              )}
              {e.aiScore && (
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: 'var(--violet-50)', border: '1px solid #DDD6FE',
                  borderRadius: 'var(--r-sm)', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--violet-700)' }}>AI score: {e.aiScore.score}/100 — </span>
                  <span style={{ color: 'var(--ink-600)' }}>{e.aiScore.reasoning}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!readOnly && onReply && (
        <div style={{ marginTop: 16 }}>
          <textarea
            className="textarea"
            placeholder="Write your response…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            aria-label="Write a response"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => setDraft('')} type="button">Clear</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!draft.trim()}
              onClick={() => { onReply(draft.trim()); setDraft('') }}
              type="button">
              Send reply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
