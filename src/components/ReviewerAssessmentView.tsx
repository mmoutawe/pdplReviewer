import {
  FileText, ShieldCheck, Users, AlertTriangle, CircleCheck,
  CircleX, Lightbulb, Globe, Lock, Scale, BarChart2,
  ClipboardCheck, ListChecks, ShieldAlert, CornerUpLeft,
} from 'lucide-react'
import { REVIEWER_SECTION_ORDER, REVIEWER_SECTION_LABELS, type ReviewerRequestType } from '../api/aiReviewer'
import type { ReactNode } from 'react'
import React from 'react'

interface ComplianceCheck  { area: string; status: string; detail: string }
interface ApprovalDecision { recommendation: string; rationale: string }
interface Recommendation   { action: string; priority: string; owner?: string }
interface RiskItem         { risk: string; detail: string; priority: string }
interface CPRoles {
  questionnaire: { vendor_role: string; our_org_role: string; joint_controllers: boolean }
  document:      { vendor_role: string; our_org_role: string; status: string; detail: string }
  match:         boolean
  mismatch_note: string
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const CHECK_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pass:    { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  concern: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  fail:    { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
}

function CheckBadge({ status }: { status: string }) {
  const s   = CHECK_COLORS[status?.toLowerCase()] ?? CHECK_COLORS.concern
  const Icon = status?.toLowerCase() === 'pass' ? CircleCheck : status?.toLowerCase() === 'fail' ? CircleX : AlertTriangle
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4, flexShrink: 0,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
    }}>
      <Icon size={11} strokeWidth={2} />
      {status}
    </span>
  )
}

// ─── Approval pill ────────────────────────────────────────────────────────────
const APPROVAL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  approve:             { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  return:              { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  'escalate-legal':    { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  'escalate-security': { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  reject:              { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
}

const APPROVAL_ICON: Record<string, React.ReactNode> = {
  approve:             <CircleCheck size={13} strokeWidth={2} />,
  return:              <CornerUpLeft size={13} strokeWidth={2} />,
  'escalate-legal':    <Scale size={13} strokeWidth={2} />,
  'escalate-security': <ShieldAlert size={13} strokeWidth={2} />,
  reject:              <CircleX size={13} strokeWidth={2} />,
}

function ApprovalPill({ recommendation }: { recommendation: string }) {
  const key = recommendation?.toLowerCase()
  const s   = APPROVAL_COLORS[key] ?? APPROVAL_COLORS.return
  const icon = APPROVAL_ICON[key] ?? <AlertTriangle size={13} strokeWidth={2} />
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 14px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 12.5, fontWeight: 700,
    }}>
      {icon}
      {recommendation?.charAt(0).toUpperCase()}{recommendation?.slice(1)}
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

// ─── Icon map ─────────────────────────────────────────────────────────────────
type IconCfg = { icon: ReactNode; iconBg: string; iconColor: string; accent?: string }

const ICON_CFG: Record<string, IconCfg> = {
  executive_summary:            { icon: <FileText size={15} strokeWidth={1.8}/>,       iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  data_classification:          { icon: <ShieldCheck size={15} strokeWidth={1.8}/>,    iconBg: 'var(--teal-50)',   iconColor: 'var(--teal-600)' },
  controller_processor_roles:   { icon: <Users size={15} strokeWidth={1.8}/>,          iconBg: 'var(--teal-50)',   iconColor: 'var(--teal-600)' },
  risk_assessment:              { icon: <AlertTriangle size={15} strokeWidth={1.8}/>,  iconBg: '#FFF7ED',          iconColor: '#C2410C', accent: '#F97316' },
  compliance_checks:            { icon: <ClipboardCheck size={15} strokeWidth={1.8}/>, iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  issues:                       { icon: <CircleX size={15} strokeWidth={1.8}/>,        iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  compliance_issues:            { icon: <CircleX size={15} strokeWidth={1.8}/>,        iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  compliance_gaps:              { icon: <CircleX size={15} strokeWidth={1.8}/>,        iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  recommendations:              { icon: <Lightbulb size={15} strokeWidth={1.8}/>,      iconBg: 'var(--teal-50)',   iconColor: 'var(--teal-600)' },
  approval_guidance:            { icon: <ShieldCheck size={15} strokeWidth={1.8}/>,    iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  approval_decision:            { icon: <ShieldCheck size={15} strokeWidth={1.8}/>,    iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  document_classification:      { icon: <FileText size={15} strokeWidth={1.8}/>,       iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  personal_data_analysis:       { icon: <ShieldAlert size={15} strokeWidth={1.8}/>,   iconBg: '#FFFBEB',          iconColor: '#92400E' },
  sensitive_data_exposure:      { icon: <ShieldAlert size={15} strokeWidth={1.8}/>,   iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  data_minimization_assessment: { icon: <ShieldCheck size={15} strokeWidth={1.8}/>,    iconBg: '#FFFBEB',          iconColor: '#92400E' },
  sharing_risk_analysis:        { icon: <AlertTriangle size={15} strokeWidth={1.8}/>,  iconBg: '#FFF7ED',          iconColor: '#C2410C', accent: '#F97316' },
  purpose_legitimacy:           { icon: <Scale size={15} strokeWidth={1.8}/>,          iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  data_minimization_evaluation: { icon: <ShieldCheck size={15} strokeWidth={1.8}/>,    iconBg: '#FFFBEB',          iconColor: '#92400E' },
  transfer_risk:                { icon: <Globe size={15} strokeWidth={1.8}/>,          iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  security_control_assessment:  { icon: <Lock size={15} strokeWidth={1.8}/>,           iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  access_justification_review:  { icon: <ListChecks size={15} strokeWidth={1.8}/>,     iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  data_sensitivity:             { icon: <ShieldAlert size={15} strokeWidth={1.8}/>,   iconBg: '#FFFBEB',          iconColor: '#92400E' },
  least_privilege_assessment:   { icon: <Lock size={15} strokeWidth={1.8}/>,           iconBg: 'var(--surface-2)', iconColor: 'var(--ink-600)' },
  duration_scope_risk:          { icon: <BarChart2 size={15} strokeWidth={1.8}/>,      iconBg: '#FFF7ED',          iconColor: '#C2410C' },
  policy_compliance:            { icon: <Scale size={15} strokeWidth={1.8}/>,          iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  transfer_risk_assessment:     { icon: <Globe size={15} strokeWidth={1.8}/>,          iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  destination_country_risk:     { icon: <Globe size={15} strokeWidth={1.8}/>,          iconBg: '#FEF2F2',          iconColor: '#B91C1C' },
  legal_safeguards_check:       { icon: <Scale size={15} strokeWidth={1.8}/>,          iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
  data_sensitivity_impact:      { icon: <ShieldAlert size={15} strokeWidth={1.8}/>,   iconBg: '#FFFBEB',          iconColor: '#92400E' },
  compliance_violations:        { icon: <CircleX size={15} strokeWidth={1.8}/>,        iconBg: '#FEF2F2',          iconColor: '#B91C1C', accent: '#EF4444' },
  required_legal_actions:       { icon: <Scale size={15} strokeWidth={1.8}/>,          iconBg: 'var(--brand-50)',  iconColor: 'var(--brand-700)' },
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

// ─── Content renderers ────────────────────────────────────────────────────────
function RenderApproval({ value }: { value: ApprovalDecision }) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}><ApprovalPill recommendation={value.recommendation} /></div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-700)', margin: 0, lineHeight: 1.65 }}>{value.rationale}</p>
    </div>
  )
}

function RenderComplianceChecks({ value }: { value: ComplianceCheck[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((c, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, padding: '10px 14px', alignItems: 'flex-start',
          borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface-0)',
        }}>
          <div style={{ paddingTop: 1 }}><CheckBadge status={c.status} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 3 }}>{c.area}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.55 }}>{c.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RenderRecommendations({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) return null
  const items = value as (Recommendation | string)[]
  const isStructured = typeof items[0] === 'object'
  const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
    high:   { bg: '#FEF2F2', color: '#B91C1C' },
    medium: { bg: '#FFFBEB', color: '#92400E' },
    low:    { bg: '#F0FDF4', color: '#166534' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, padding: '10px 14px', alignItems: 'flex-start',
          borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface-0)',
        }}>
          <span style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
            background: 'var(--teal-50)', color: 'var(--teal-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{i + 1}</span>
          {isStructured ? (() => {
            const r = item as Recommendation
            const pc = PRIORITY_COLORS[r.priority?.toLowerCase()] ?? PRIORITY_COLORS.medium
            return (
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13.5, color: 'var(--ink-800)', margin: '0 0 4px', lineHeight: 1.5 }}>{r.action}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: pc.bg, color: pc.color }}>{r.priority}</span>
                  {r.owner && <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>→ {r.owner}</span>}
                </div>
              </div>
            )
          })() : (
            <span style={{ fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.55, paddingTop: 2 }}>{String(item)}</span>
          )}
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

function RenderRiskAssessment({ value }: { value: RiskItem[] }) {
  const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    high:   { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
    medium: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    low:    { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((item, i) => {
        const pc = PRIORITY_COLORS[item.priority?.toLowerCase()] ?? PRIORITY_COLORS.medium
        return (
          <div key={i} style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: `1px solid ${pc.border}`, background: 'var(--surface-0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{item.risk}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                {item.priority}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-700)', margin: 0, lineHeight: 1.55 }}>{item.detail}</p>
          </div>
        )
      })}
    </div>
  )
}

function RenderControllerProcessorRoles({ value }: { value: CPRoles }) {
  const docStatusToCheck = (s: string) => s === 'confirmed' ? 'pass' : s === 'contradicts' ? 'fail' : 'concern'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!value.match && value.mismatch_note && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-md)', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={14} style={{ color: '#B91C1C', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>{value.mismatch_note}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface-1)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Per Questionnaire</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>Vendor Role</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)' }}>{value.questionnaire.vendor_role}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>Our Org Role</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)' }}>{value.questionnaire.our_org_role}</div>
            </div>
            {value.questionnaire.joint_controllers && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', display: 'inline-block', width: 'fit-content' }}>Joint Controllers</span>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'var(--surface-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Per Document</div>
            {value.document.status && <CheckBadge status={docStatusToCheck(value.document.status)} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>Vendor Role</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)' }}>{value.document.vendor_role}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 2 }}>Our Org Role</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-800)' }}>{value.document.our_org_role}</div>
            </div>
            {value.document.detail && (
              <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: 0, lineHeight: 1.5 }}>{value.document.detail}</p>
            )}
          </div>
        </div>
      </div>
      {value.match && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#166534', padding: '6px 12px', background: '#F0FDF4', borderRadius: 'var(--r-sm)', border: '1px solid #BBF7D0' }}>
          <CircleCheck size={13} strokeWidth={2} /> Questionnaire and document are consistent.
        </div>
      )}
    </div>
  )
}

function sectionContent(key: string, value: unknown): ReactNode {
  if ((key === 'approval_guidance' || key === 'approval_decision') && typeof value === 'object' && value !== null)
    return <RenderApproval value={value as ApprovalDecision} />
  if (key === 'compliance_checks' && Array.isArray(value))
    return <RenderComplianceChecks value={value as ComplianceCheck[]} />
  if (key === 'risk_assessment' && Array.isArray(value) && value.length > 0 && typeof (value as unknown[])[0] === 'object')
    return <RenderRiskAssessment value={value as RiskItem[]} />
  if (key === 'controller_processor_roles' && typeof value === 'object' && value !== null && !Array.isArray(value))
    return <RenderControllerProcessorRoles value={value as CPRoles} />
  if (key === 'recommendations')
    return <RenderRecommendations value={value} />
  if (Array.isArray(value))
    return <RenderBulletList value={value as string[]} />
  if (typeof value === 'string')
    return <p style={{ fontSize: 13.5, color: 'var(--ink-800)', margin: 0, lineHeight: 1.65 }}>{value}</p>
  return null
}

// ─── Standalone Controller/Processor Roles card ──────────────────────────────
export function ControllerProcessorRolesCard({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const cfg = getIconCfg('controller_processor_roles')
  return (
    <SectionCard icon={cfg.icon} iconBg={cfg.iconBg} iconColor={cfg.iconColor} title="Controller / Processor Roles">
      <RenderControllerProcessorRoles value={data as CPRoles} />
    </SectionCard>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props { data: Record<string, unknown>; requestType: string }

export function ReviewerAssessmentView({ data, requestType }: Props) {
  const order = REVIEWER_SECTION_ORDER[requestType as ReviewerRequestType] ?? Object.keys(data)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {order.map((key) => {
        const value = data[key]
        if (value === undefined || value === null) return null
        const cfg   = getIconCfg(key)
        const label = REVIEWER_SECTION_LABELS[key] ?? formatKey(key)
        const count = Array.isArray(value) ? ` (${(value as unknown[]).length})` : ''
        return (
          <SectionCard key={key}
            icon={cfg.icon} iconBg={cfg.iconBg} iconColor={cfg.iconColor} accent={cfg.accent}
            title={`${label}${count}`}
          >
            {sectionContent(key, value)}
          </SectionCard>
        )
      })}
    </div>
  )
}
