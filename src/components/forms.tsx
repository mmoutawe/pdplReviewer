import { type ReactNode, useRef, useState } from 'react'
import { fileSize } from '../lib/utils'
import type { Attachment } from '../data/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { uploadAttachment, deleteAttachment } from '../api/attachments'

// ─── FormField ────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string; required?: boolean; help?: string; error?: string; children: ReactNode; id?: string
}
export function FormField({ label, required, help, error, children, id }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-label="required"> *</span>}
      </label>
      {children}
      {help && !error && <span className="help">{help}</span>}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
interface Step { label: string; done: boolean; active: boolean; index: number }
interface StepperProps { steps: Step[] }
export function Stepper({ steps }: StepperProps) {
  return (
    <nav aria-label="Progress" className="stepper">
      {steps.map((s, i) => (
        <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className={`step-pill${s.active ? ' active' : s.done ? ' done' : ''}`}>
            <span className="step-num">{s.done ? '✓' : s.index + 1}</span>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" style={{ color: 'var(--ink-300)', fontSize: 12 }}>›</span>
          )}
        </span>
      ))}
    </nav>
  )
}

// ─── EvidenceUploader ─────────────────────────────────────────────────────────

interface UploadingFile {
  name: string
  percent: number
  error?: string
}

interface UploaderProps {
  attachments: Attachment[]
  ticketId?: string
  onUploaded?: (a: Attachment) => void
  onRemove?: (id: string) => void
  readOnly?: boolean
}

const CAT_ICON: Record<string, string> = {
  dpa: '📝', soc2: '🏅', iso27001: '🏅', contract: '📄', evidence: '📎', screenshot: '🖼️', other: '📎',
}

export function EvidenceUploader({
  attachments,
  ticketId,
  onUploaded,
  onRemove,
  readOnly = false,
}: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<UploadingFile[]>([])

  async function handleFiles(files: FileList) {
    if (!ticketId || !isSupabaseConfigured) {
      // Demo: show a toast-style inline message instead of uploading
      const demos = Array.from(files).map((f) => ({ name: f.name, percent: 100 }))
      setUploading(demos)
      setTimeout(() => setUploading([]), 1500)
      return
    }

    const fileArray = Array.from(files)
    setUploading(fileArray.map((f) => ({ name: f.name, percent: 0 })))

    await Promise.allSettled(
      fileArray.map(async (file, i) => {
        try {
          const attachment = await uploadAttachment(ticketId, file, 'evidence', (p) => {
            setUploading((prev) => prev.map((u, j) => j === i ? { ...u, percent: p.percent } : u))
          })
          onUploaded?.(attachment)
          setUploading((prev) => prev.filter((_, j) => j !== i))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          setUploading((prev) => prev.map((u, j) => j === i ? { ...u, error: msg } : u))
        }
      })
    )
  }

  async function handleRemove(att: Attachment) {
    if (isSupabaseConfigured) {
      try {
        await deleteAttachment(att)
      } catch {
        // removal error is non-critical for UX — parent onRemove will still update local state
      }
    }
    onRemove?.(att.id)
  }

  return (
    <div>
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }} aria-label="Attached files">
          {attachments.map((att) => (
            <li key={att.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: 'var(--surface-1)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', fontSize: 13,
            }}>
              <span aria-hidden="true">{CAT_ICON[att.category] ?? '📎'}</span>
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--ink-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.signedUrl ? (
                  <a href={att.signedUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--brand-700)', textDecoration: 'none' }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}>
                    {att.filename}
                  </a>
                ) : att.filename}
              </span>
              <span style={{ color: 'var(--ink-400)', fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {fileSize(att.sizeBytes)}
              </span>
              <span className={`pill pill-no-dot ${att.scanStatus === 'clean' ? 'pill-emerald' : att.scanStatus === 'flagged' ? 'pill-red' : 'pill-slate'}`}
                style={{ height: 18, fontSize: 10.5, padding: '0 6px', flexShrink: 0 }}>
                {att.scanStatus}
              </span>
              {att.extractedSummary && (
                <span title={att.extractedSummary} style={{ cursor: 'help', color: 'var(--violet-600)', fontSize: 11, flexShrink: 0 }}>AI ✦</span>
              )}
              {!readOnly && (
                <button className="btn btn-ghost btn-sm" onClick={() => void handleRemove(att)}
                  aria-label={`Remove ${att.filename}`} style={{ padding: '0 4px', minWidth: 24, color: 'var(--ink-400)', flexShrink: 0 }}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* In-progress uploads */}
      {uploading.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {uploading.map((u, i) => (
            <li key={i} style={{
              padding: '8px 12px', background: 'var(--surface-1)',
              border: `1px solid ${u.error ? '#FECACA' : 'var(--line)'}`,
              borderRadius: 'var(--r-md)', fontSize: 13,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: u.error ? 0 : 4 }}>
                <span aria-hidden="true">📎</span>
                <span style={{ flex: 1, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                <span style={{ fontSize: 11.5, color: u.error ? 'var(--red-700)' : 'var(--ink-400)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {u.error ? u.error : `${u.percent}%`}
                </span>
              </div>
              {!u.error && (
                <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${u.percent}%`, height: '100%', background: 'var(--brand-700)', borderRadius: 999, transition: 'width 0.2s' }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Upload button */}
      {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input ref={inputRef} type="file" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.csv"
            style={{ display: 'none' }} aria-label="Upload files"
            onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files) }}
          />
          <button className="btn btn-sm" type="button" onClick={() => inputRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Attach file
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>
            PDF, Word, Excel, Images up to 25 MB
            {!isSupabaseConfigured && <span style={{ color: 'var(--amber-600)', marginLeft: 6 }}>(demo — uploads not persisted)</span>}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Risk meter ────────────────────────────────────────────────────────────────
interface RiskMeterProps { score: number; label?: string }
export function RiskMeter({ score, label }: RiskMeterProps) {
  const color = score < 30 ? 'var(--emerald-700)' : score < 60 ? 'var(--amber-700)' : 'var(--red-700)'
  return (
    <div>
      {label && <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 4 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.4s var(--ease-out)' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color, minWidth: 30 }}>{score}</span>
      </div>
    </div>
  )
}
