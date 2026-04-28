import { type ReactNode, useRef } from 'react'
import { fileSize } from '../lib/utils'
import type { Attachment } from '../data/types'
import { ATTACHMENTS } from '../data/seed'

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
interface UploaderProps {
  attachmentIds: string[]
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
  readOnly?: boolean
}
export function EvidenceUploader({ attachmentIds, onAdd: _onAdd, onRemove, readOnly = false }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const items = attachmentIds.map((id) => ATTACHMENTS.find((a) => a.id === id)).filter(Boolean) as Attachment[]

  const CAT_ICON: Record<string, string> = {
    dpa: '📝', soc2: '🏅', iso27001: '🏅', contract: '📄', evidence: '📎', screenshot: '🖼️', other: '📎',
  }

  return (
    <div>
      {items.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }} aria-label="Attached files">
          {items.map((att) => (
            <li key={att.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: 'var(--surface-1)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', fontSize: 13,
            }}>
              <span aria-hidden="true">{CAT_ICON[att.category] ?? '📎'}</span>
              <span style={{ flex: 1, fontWeight: 500, color: 'var(--ink-800)' }}>{att.filename}</span>
              <span style={{ color: 'var(--ink-400)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{fileSize(att.sizeBytes)}</span>
              <span className={`pill pill-no-dot ${att.scanStatus === 'clean' ? 'pill-emerald' : att.scanStatus === 'flagged' ? 'pill-red' : 'pill-slate'}`}
                style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                {att.scanStatus}
              </span>
              {!readOnly && onRemove && (
                <button className="btn btn-ghost btn-sm" onClick={() => onRemove(att.id)}
                  aria-label={`Remove ${att.filename}`} style={{ padding: '0 4px', minWidth: 24, color: 'var(--ink-400)' }}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div>
          <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.txt"
            style={{ display: 'none' }} aria-label="Upload files" onChange={() => {
              /* In production: upload to storage bucket, get attachment id, call onAdd */
            }} />
          <button className="btn btn-sm" type="button" onClick={() => inputRef.current?.click()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Attach file
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--ink-400)', marginLeft: 8 }}>
            PDF, Word, Excel, Images up to 25 MB
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
