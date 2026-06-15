import {
  FileText, Users, AlertTriangle, XCircle, Lightbulb,
  Globe, Lock, Scale, ShieldCheck, ShieldAlert,
  CircleCheck, Info, TrendingUp,
} from 'lucide-react'
import { SECTION_ORDER, SECTION_LABELS, type PresubmitRequestType } from '../api/aiPresubmit'
import type { ReactNode } from 'react'

interface RiskItem  { title: string; detail: string; severity: string; article_ref?: string }
interface FixItem   { title: string; detail: string }
interface RoleData  { data_controller?: string; data_processor?: string; sub_processor?: string }

// ─── Risk pill ────────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  low:      { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  medium:   { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  high:     { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  critical: { bg: '#FEF2F2', color: '#7F1D1D', border: '#FECACA' },
}

function RiskPill({ level, large = false }: { level: string; large?: boolean }) {
  const s = RISK_COLORS[level?.toLowerCase()] ?? RISK_COLORS.medium
  const sz = large ? 13 : 11
  const Icon = level?.toLowerCase() === 'low' ? CircleCheck : AlertTriangle
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: large ? '4px 12px' : '2px 8px', borderRadius: 999,
      border: `1px solid ${s.border}`, background: s.bg, color: s.color,
      fontSize: large ? 12.5 : 11, fontWeight: 600,
    }}>
      <Icon size={sz} strokeWidth={2} />
      {level?.charAt(0).toUpperCase()}{level?.slice(1)} Risk
    </span>
  )
}

// ─── PDPL article badge ───────────────────────────────────────────────────────
function ArticleBadge({ ref: articleRef }: { ref: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      border: '1px solid var(--brand-200)', background: 'var(--brand-50)',
      color: 'var(--brand-800)', fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' as const,
    }}>
      <FileText size={10} strokeWidth={2} />
      {articleRef}
    </span>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({
  icon, iconBg = 'var(--surface-2)', iconColor = 'var(--ink-500)',
  title, children, accent,
}: {
  icon: ReactNode; iconBg?: string; iconColor?: string
  title: string; children: ReactNode; accent?: string
}) {
  return (
    <div style={{
      background: 'var(--surface-0)', borderRadius: 'var(--r-lg)',
      border: '1px solid var(--line)',
      borderLeft: accent ? `3px solid ${accent}` : '1px solid var(--line)',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 'var(--r-md)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: iconBg, color: iconColor,
        }}>{icon}</div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ─── Icon configs ─────────────────────────────────────────────────────────────
type IconCfg = { icon: ReactNode; iconBg: string; iconColor: string; accent?: string }

const ICON_CFG: Record<string, IconCfg> = {
  executive_summary:               { icon: <FileText size={15} strokeWidth={1.8}/>,   iconBg: 'var(--surface-2)',  iconColor: 'var(--ink-600)' },
  inferred_roles:                  { icon: <Users size={15} strokeWidth={1.8}/>,       iconBg: 'var(--teal-50)',    iconColor: 'var(--teal-600)' },
  key_risks:                       { icon: <AlertTriangle size={15} strokeWidth={1.8}/>, iconBg: '#FFF7ED',         iconColor: '#C2410C', accent: '#F97316' },
  missing_inputs:                  { icon: <XCircle size={15} strokeWidth={1.8}/>,     iconBg: '#FFF7ED',          iconColor: '#C2410C' },
  suggested_fixes:                 { icon: <Lightbulb size={15} strokeWidth={1.8}/>,   iconBg: 'var(--teal-50)',   iconColor: 'var(--teal-600)' },
  cross_border_risk:               { icon: <Globe size={15} strokeWidth={1.8}/>,       iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  security_readiness:              { icon: <Lock size={15} strokeWidth={1.8}/>,        iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  data_minimization_check:         { icon: <ShieldCheck size={15} strokeWidth={1.8}/>, iconBg: '#FFFBEB',          iconColor: '#92400E' },
  missing_controls:                { icon: <XCircle size={15} strokeWidth={1.8}/>,     iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  missing_safeguards:              { icon: <XCircle size={15} strokeWidth={1.8}/>,     iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  policy_compliance_gaps:          { icon: <Scale size={15} strokeWidth={1.8}/>,       iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  destination_risk_level:          { icon: <Globe size={15} strokeWidth={1.8}/>,       iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  legal_safeguard_check:           { icon: <Scale size={15} strokeWidth={1.8}/>,       iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  document_risk_summary:           { icon: <FileText size={15} strokeWidth={1.8}/>,    iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  personal_data_detection:         { icon: <ShieldAlert size={15} strokeWidth={1.8}/>, iconBg: '#FFFBEB',          iconColor: '#92400E' },
  sensitive_data_presence:         { icon: <ShieldAlert size={15} strokeWidth={1.8}/>, iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  data_minimization_issues:        { icon: <ShieldCheck size={15} strokeWidth={1.8}/>, iconBg: '#FFFBEB',          iconColor: '#92400E' },
  sharing_risk:                    { icon: <AlertTriangle size={15} strokeWidth={1.8}/>, iconBg: '#FFF7ED',         iconColor: '#C2410C', accent: '#F97316' },
  data_sensitivity_classification: { icon: <ShieldCheck size={15} strokeWidth={1.8}/>, iconBg: 'var(--teal-50)',   iconColor: 'var(--teal-600)' },
  purpose_vs_necessity:            { icon: <Scale size={15} strokeWidth={1.8}/>,       iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  access_justification_assessment: { icon: <Info size={15} strokeWidth={1.8}/>,        iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  data_sensitivity_level:          { icon: <ShieldAlert size={15} strokeWidth={1.8}/>, iconBg: '#FFFBEB',          iconColor: '#92400E' },
  least_privilege_evaluation:      { icon: <Lock size={15} strokeWidth={1.8}/>,        iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  duration_risk:                   { icon: <TrendingUp size={15} strokeWidth={1.8}/>,  iconBg: '#FFF7ED',          iconColor: '#C2410C' },
  transfer_justification:          { icon: <Scale size={15} strokeWidth={1.8}/>,       iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  missing_legal_controls:          { icon: <XCircle size={15} strokeWidth={1.8}/>,     iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
}

function getIconCfg(key: string): IconCfg {
  return ICON_CFG[key] ?? { icon: <FileText size={15} strokeWidth={1.8}/>, iconBg: 'var(--surface-2)', iconColor: 'var(--ink-500)' }
}

function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Specialized renderers ────────────────────────────────────────────────────
function RenderInferredRoles({ value }: { value: unknown }) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const r = value as RoleData
    const roles = [
      { label: 'Data Controller', value: r.data_controller },
      { label: 'Data Processor',  value: r.data_processor },
      { label: 'Sub-processor',   value: r.sub_processor },
    ].filter(x => x.value)
    if (roles.length > 0) return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${roles.length}, 1fr)`, gap: 10 }}>
        {roles.map((r) => (
          <div key={r.label} style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 500, marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.4 }}>{r.value}</div>
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'string') return <p style={{ fontSize: 13.5, color: 'var(--ink-800)', margin: 0, lineHeight: 1.65 }}>{value}</p>
  return null
}

function RenderKeyRisks({ value }: { value: RiskItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((r, i) => (
        <div key={i} style={{
          padding: '12px 14px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)', background: 'var(--surface-0)',
          borderLeft: `3px solid ${r.severity === 'critical' || r.severity === 'high' ? '#EF4444' : r.severity === 'medium' ? '#F59E0B' : '#22c55e'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', flex: 1, lineHeight: 1.4 }}>{r.title}</span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
              {r.article_ref && <ArticleBadge ref={r.article_ref} />}
              <RiskPill level={r.severity} />
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-700)', margin: 0, lineHeight: 1.55 }}>{r.detail}</p>
        </div>
      ))}
    </div>
  )
}

function RenderBulletList({ value }: { value: string[] }) {
  if (value.length === 0) return <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: 0 }}>None identified.</p>
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {value.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.55 }}>
          <AlertTriangle size={14} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2, color: '#C2410C' }} />
          {item}
        </li>
      ))}
    </ul>
  )
}

function RenderSuggestedFixes({ value }: { value: FixItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
            background: 'var(--teal-50)', color: 'var(--teal-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{i + 1}</span>
          <div style={{ paddingTop: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{f.title}: </span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.55 }}>{f.detail}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function sectionContent(key: string, value: unknown): ReactNode {
  if (key === 'inferred_roles') return <RenderInferredRoles value={value} />
  if (key === 'key_risks' && Array.isArray(value)) return <RenderKeyRisks value={value as RiskItem[]} />
  if (key === 'suggested_fixes' && Array.isArray(value)) return <RenderSuggestedFixes value={value as FixItem[]} />
  if (Array.isArray(value)) return <RenderBulletList value={value as string[]} />
  if (typeof value === 'string') return <p style={{ fontSize: 13.5, color: 'var(--ink-800)', margin: 0, lineHeight: 1.65 }}>{value}</p>
  return null
}

// ─── Sections that look better side-by-side ──────────────────────────────────
const PAIRED: [string, string][] = [
  ['data_minimization_check', 'cross_border_risk'],
  ['security_readiness',      'missing_controls'],
  ['data_minimization_issues','missing_safeguards'],
]

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props { data: Record<string, unknown>; requestType: string }

export function PresubmitAssessmentView({ data, requestType }: Props) {
  const rawOrder  = SECTION_ORDER[requestType as PresubmitRequestType] ?? Object.keys(data)
  const riskLevel = typeof data.risk_level === 'string' ? data.risk_level : null
  const rendered  = new Set<string>()
  const elements: ReactNode[] = []

  for (const key of rawOrder) {
    if (key === 'risk_level') { rendered.add(key); continue }
    if (rendered.has(key)) continue

    const pair      = PAIRED.find(([a, b]) => a === key || b === key)
    const pairedKey = pair ? (pair[0] === key ? pair[1] : pair[0]) : null

    if (pairedKey && rawOrder.includes(pairedKey) && data[pairedKey] !== undefined) {
      rendered.add(key); rendered.add(pairedKey)
      const cfgA = getIconCfg(key), cfgB = getIconCfg(pairedKey)
      elements.push(
        <div key={`${key}+${pairedKey}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <SectionCard icon={cfgA.icon} iconBg={cfgA.iconBg} iconColor={cfgA.iconColor} accent={cfgA.accent}
            title={SECTION_LABELS[key] ?? formatKey(key)}>
            {sectionContent(key, data[key])}
          </SectionCard>
          <SectionCard icon={cfgB.icon} iconBg={cfgB.iconBg} iconColor={cfgB.iconColor} accent={cfgB.accent}
            title={SECTION_LABELS[pairedKey] ?? pairedKey.replace(/_/g, ' ')}>
            {sectionContent(pairedKey, data[pairedKey])}
          </SectionCard>
        </div>
      )
    } else {
      rendered.add(key)
      if (data[key] === undefined || data[key] === null) continue
      const cfg   = getIconCfg(key)
      const label = SECTION_LABELS[key] ?? formatKey(key)
      const count = Array.isArray(data[key]) ? ` (${(data[key] as unknown[]).length})` : ''
      elements.push(
        <SectionCard key={key} icon={cfg.icon} iconBg={cfg.iconBg} iconColor={cfg.iconColor} accent={cfg.accent}
          title={`${label}${count}`}>
          {sectionContent(key, data[key])}
        </SectionCard>
      )
    }
  }

  return (
    <div>
      {riskLevel && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', marginBottom: 16,
          background: 'var(--surface-1)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={15} strokeWidth={1.8} style={{ color: 'var(--ink-500)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)' }}>Overall Risk Level</span>
          </div>
          <RiskPill level={riskLevel} large />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{elements}</div>
    </div>
  )
}
