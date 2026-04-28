import { type ReactNode, type CSSProperties } from 'react'
import { cn, stateColor } from '../lib/utils'
import type { Role, TicketState } from '../data/types'
import { STATE_LABELS, ROLE_LABELS } from '../data/seed'

// ─── StatusPill ──────────────────────────────────────────────────────────────
interface StatusPillProps { state: TicketState; size?: 'sm' | 'md' }

export function StatusPill({ state, size = 'md' }: StatusPillProps) {
  const c = stateColor(state)
  return (
    <span className={cn('pill', `pill-${c}`, size === 'sm' && 'pill-no-dot')}
      style={size === 'sm' ? { height: 18, fontSize: 10.5, padding: '0 6px' } : undefined}>
      {size !== 'sm' && null}
      {STATE_LABELS[state]}
    </span>
  )
}

// ─── RoleBadge ───────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<Role, string> = {
  requester: 'pill-ink',
  data_management: 'pill-blue',
  legal: 'pill-violet',
  security: 'pill-amber',
  admin: 'pill-red',
  external_recipient: 'pill-slate',
}

interface RoleBadgeProps { role: Role; size?: 'sm' | 'md' }
export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  return (
    <span className={cn('pill pill-no-dot', ROLE_COLOR[role])}
      style={size === 'sm' ? { height: 18, fontSize: 10.5, padding: '0 6px' } : undefined}>
      {ROLE_LABELS[role]}
    </span>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
interface AvatarProps { initials: string; color: string; size?: number; ring?: boolean }
export function Avatar({ initials, color, size = 28, ring = false }: AvatarProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: color, color: 'white',
      fontSize: size * 0.35, fontWeight: 600, flexShrink: 0,
      fontFamily: 'var(--font-sans)', letterSpacing: '0.01em',
      outline: ring ? '2px solid var(--surface-0)' : undefined,
      outlineOffset: ring ? 1 : undefined,
    }}>
      {initials}
    </span>
  )
}

// ─── KPI card ────────────────────────────────────────────────────────────────
interface KPIProps {
  label: string; value: string | number; sub?: string
  trend?: 'up' | 'down' | 'flat'; color?: string
  style?: CSSProperties
}
export function KPI({ label, value, sub, trend, color, style }: KPIProps) {
  return (
    <div className="card" style={{ padding: '16px 20px', ...style }}>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-400)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: color ?? 'var(--ink-900)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: 12, color: trend === 'up' ? 'var(--emerald-700)' : trend === 'down' ? 'var(--red-700)' : 'var(--ink-400)' }}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── SLA indicator ───────────────────────────────────────────────────────────
import { slaStatus } from '../lib/utils'

interface SLAProps { dueAt: string; breached: boolean; compact?: boolean }
export function SLAIndicator({ dueAt, breached, compact = false }: SLAProps) {
  const { label, color } = slaStatus(dueAt, breached)
  const map: Record<typeof color, string> = { emerald: 'pill-emerald', amber: 'pill-amber', red: 'pill-red' }
  return (
    <span className={cn('pill', map[color])} style={compact ? { height: 18, fontSize: 10.5, padding: '0 6px' } : undefined}>
      {label}
    </span>
  )
}

// ─── ConfidenceBadge ─────────────────────────────────────────────────────────
interface ConfidenceProps { score: number }
export function ConfidenceBadge({ score }: ConfidenceProps) {
  const pct = Math.round(score * 100)
  return (
    <span className="badge-confidence">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 1l1.2 2.4L9 3.8 7 5.7l.5 2.7L5 7l-2.5 1.4L3 5.7 1 3.8l2.8-.4L5 1z" fill="var(--violet-700)" />
      </svg>
      {pct}%
    </span>
  )
}

// ─── Tag ─────────────────────────────────────────────────────────────────────
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '10px 14px' }}>
              <span className="skel" style={{ display: 'block', height: 14, width: j === 0 ? '70%' : j === 1 ? '50%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
interface EmptyProps { title: string; body?: string; action?: ReactNode; icon?: string }
export function EmptyState({ title, body, action, icon = '📋' }: EmptyProps) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--ink-400)' }}>
      <div style={{ fontSize: 36, marginBottom: 16 }} aria-hidden="true">{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 8 }}>{title}</div>
      {body && <div style={{ fontSize: 13, maxWidth: 360, margin: '0 auto 24px' }}>{body}</div>}
      {action}
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ vertical = false }: { vertical?: boolean }) {
  return (
    <span style={{
      display: 'block',
      [vertical ? 'width' : 'height']: 1,
      [vertical ? 'height' : 'width']: vertical ? '1em' : '100%',
      background: 'var(--line)',
      flexShrink: 0,
      alignSelf: 'stretch',
    }} aria-hidden="true" />
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
      {action}
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────
export function Page({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, ...style }}>
      {children}
    </div>
  )
}
