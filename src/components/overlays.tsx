import { type ReactNode, useEffect, useRef } from 'react'
import { toastStore } from '../store'
import { useStore } from '../hooks/useStore'

// ─── Modal ───────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string; open: boolean; onClose: () => void
  children: ReactNode; footer?: ReactNode; wide?: boolean
}
export function Modal({ title, open, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined}>
        <div className="modal-header">
          <h2 id="modal-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-900)' }}>{title}</h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Drawer ──────────────────────────────────────────────────────────────────
interface DrawerProps {
  title: string; open: boolean; onClose: () => void
  children: ReactNode; width?: number; side?: 'right' | 'left'
  headerActions?: ReactNode
}
export function Drawer({ title, open, onClose, children, width, side = 'right', headerActions }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div className={`drawer${side === 'left' ? ' drawer-left' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby="drawer-title"
        style={width ? { width } : undefined}>
        <div className="drawer-header">
          <h2 id="drawer-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>{title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerActions}
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close drawer" style={{ padding: '0 6px', minWidth: 28 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  )
}

// ─── ConfirmDialog ───────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean; title: string; body: string
  confirmLabel?: string; danger?: boolean
  onConfirm: () => void; onCancel: () => void
}
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }>
      <p style={{ color: 'var(--ink-600)', fontSize: 14, lineHeight: 1.6 }}>{body}</p>
    </Modal>
  )
}

// ─── LoadingOverlay ──────────────────────────────────────────────────────────
interface LoadingOverlayProps { show: boolean; label?: string }
export function LoadingOverlay({ show, label = 'Submitting…' }: LoadingOverlayProps) {
  if (!show) return null
  return (
    <div className="modal-overlay" role="status" aria-live="polite" style={{ zIndex: 300 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Toast stack ─────────────────────────────────────────────────────────────
const KIND_ICON: Record<string, string> = {
  success: '✓', error: '✕', info: 'ℹ', default: '·',
}
const KIND_COLOR: Record<string, string> = {
  success: 'var(--emerald-700)', error: 'var(--red-700)', info: 'var(--brand-700)', default: 'var(--ink-300)',
}

export function ToastStack() {
  const { items } = useStore(toastStore)
  if (!items.length) return null
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <span style={{ color: KIND_COLOR[t.kind ?? 'default'], fontWeight: 700, fontSize: 14 }}>
            {KIND_ICON[t.kind ?? 'default']}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
interface TooltipProps { label: string; children: ReactNode }
export function Tooltip({ label, children }: TooltipProps) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span ref={ref} title={label} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
interface Tab { key: string; label: string; count?: number }
interface TabsProps { tabs: Tab[]; active: string; onChange: (k: string) => void }
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div role="tablist" style={{
      display: 'flex', gap: 0, borderBottom: '1px solid var(--line)',
      padding: '0 24px', background: 'var(--surface-0)',
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === active}
          onClick={() => onChange(tab.key)}
          style={{
            padding: '10px 16px', fontSize: 13, fontWeight: tab.key === active ? 600 : 400,
            color: tab.key === active ? 'var(--brand-700)' : 'var(--ink-500)',
            borderBottom: `2px solid ${tab.key === active ? 'var(--brand-700)' : 'transparent'}`,
            background: 'transparent', border: 'none', borderRadius: 0,
            cursor: 'pointer', transition: 'color var(--t-fast)',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              background: tab.key === active ? 'var(--brand-50)' : 'var(--surface-2)',
              color: tab.key === active ? 'var(--brand-800)' : 'var(--ink-500)',
              border: `1px solid ${tab.key === active ? '#BFDBFE' : 'var(--line)'}`,
              borderRadius: 999, padding: '0 6px', fontSize: 10.5, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums', lineHeight: '18px',
            }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
