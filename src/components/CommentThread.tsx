import { useState } from 'react'
import { Paperclip, CheckCircle, Sparkles } from 'lucide-react'
import type { ReturnThreadEntry, Attachment } from '../data/types'
import { getCachedUser } from '../lib/userCache'
import { Avatar, RoleBadge } from './primitives'
import { timeAgo } from '../lib/utils'
import { dvDownloadFile, isDataverseConfigured, T } from '../lib/dataverse'

interface ThreadProps {
  entries: ReturnThreadEntry[]
  attachments?: Attachment[]
  onReply?: (msg: string) => void
  onEvaluate?: (entryId: string) => Promise<void>
  readOnly?: boolean
  evaluatingId?: string
}

function handleDownload(att: Attachment) {
  if (att.signedUrl) {
    const a = document.createElement('a')
    a.href = att.signedUrl
    a.download = att.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else if (isDataverseConfigured) {
    void dvDownloadFile(T.attachments, att.id, 'pdplr_filecontent', att.filename)
  }
}

export function CommentThread({ entries, attachments = [], onReply, onEvaluate, readOnly = false, evaluatingId }: ThreadProps) {
  const [draft, setDraft] = useState('')

  return (
    <div>
      {entries.length === 0 && (
        <p style={{ color: 'var(--ink-400)', fontSize: 13, padding: '12px 0' }}>No comments yet.</p>
      )}
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {entries.map((e) => {
          const user = getCachedUser(e.by)
          const entryAtts = attachments.filter((a) => e.attachmentIds?.includes(a.id))
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
              {entryAtts.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {entryAtts.map((att) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => handleDownload(att)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 8px', border: '1px solid var(--line)',
                        borderRadius: 'var(--r-sm)', background: 'var(--surface-1)',
                        fontSize: 12, color: 'var(--ink-700)', cursor: 'pointer',
                      }}
                    >
                      <Paperclip size={12} style={{ flexShrink: 0 }} /> {att.filename}
                      <span style={{ color: 'var(--ink-400)' }}>({Math.round(att.sizeBytes / 1024)} KB)</span>
                    </button>
                  ))}
                </div>
              )}
              {e.resolvedAt && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--emerald-700)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={12} /> Resolved {timeAgo(e.resolvedAt)}
                </div>
              )}
              {e.aiScore && (
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: 'var(--violet-50)', border: '1px solid #DDD6FE',
                  borderRadius: 'var(--r-sm)', fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Sparkles size={12} style={{ color: 'var(--violet-600)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: 'var(--violet-700)' }}>AI Evaluation — Score: {e.aiScore.score}/100</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-600)', margin: 0, lineHeight: 1.55 }}>{e.aiScore.reasoning}</p>
                </div>
              )}
              {!e.aiScore && onEvaluate && !readOnly && (
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}
                    disabled={evaluatingId === e.id}
                    onClick={() => void onEvaluate(e.id)}
                  >
                    <Sparkles size={11} />
                    {evaluatingId === e.id ? 'Evaluating…' : 'Get AI Help'}
                  </button>
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
