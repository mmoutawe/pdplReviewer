import { REVIEWER_SECTION_ORDER, REVIEWER_SECTION_LABELS, type ReviewerRequestType } from '../api/aiReviewer'

interface ComplianceCheck { area: string; status: string; detail: string }
interface ApprovalDecision { recommendation: string; rationale: string }

const APPROVAL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  approve:              { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  return:               { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  'escalate-legal':     { bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  'escalate-security':  { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
}

const CHECK_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pass:    { color: '#166534', bg: '#F0FDF4', border: '#BBF7D0' },
  concern: { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  fail:    { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
}

function renderValue(key: string, value: unknown) {
  // Approval guidance / decision
  if ((key === 'approval_guidance' || key === 'approval_decision') && typeof value === 'object' && value !== null) {
    const v = value as ApprovalDecision
    const s = APPROVAL_STYLE[v.recommendation?.toLowerCase()] ?? APPROVAL_STYLE.return
    return (
      <div style={{ marginTop: 8 }}>
        <span style={{
          display: 'inline-block', padding: '4px 16px', borderRadius: 999, marginBottom: 8,
          fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        }}>
          {v.recommendation}
        </span>
        <p style={{ fontSize: 13.5, color: 'var(--ink-700)', margin: 0, lineHeight: 1.65 }}>{v.rationale}</p>
      </div>
    )
  }

  // Compliance checks
  if (key === 'compliance_checks' && Array.isArray(value)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {(value as ComplianceCheck[]).map((c, i) => {
          const s = CHECK_STYLE[c.status?.toLowerCase()] ?? CHECK_STYLE.concern
          return (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '8px 12px', alignItems: 'flex-start',
              borderRadius: 'var(--r-md)', border: `1px solid ${s.border}`, background: s.bg,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                color: s.color, minWidth: 52, paddingTop: 1, letterSpacing: 0.3,
              }}>
                {c.status}
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-800)', marginBottom: 2 }}>{c.area}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.5 }}>{c.detail}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Arrays of strings
  if (Array.isArray(value)) {
    if (value.length === 0) return <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '4px 0 0' }}>None identified.</p>
    return (
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(value as string[]).map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.6 }}>{item}</li>
        ))}
      </ul>
    )
  }

  // Plain string
  if (typeof value === 'string') {
    return <p style={{ fontSize: 13.5, color: 'var(--ink-800)', margin: '4px 0 0', lineHeight: 1.65 }}>{value}</p>
  }

  return null
}

interface Props {
  data: Record<string, unknown>
  requestType: string
}

export function ReviewerAssessmentView({ data, requestType }: Props) {
  const order = REVIEWER_SECTION_ORDER[requestType as ReviewerRequestType] ?? Object.keys(data)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {order.map((key) => {
        const value = data[key]
        if (value === undefined || value === null) return null
        const isDecision = key === 'approval_guidance' || key === 'approval_decision'
        return (
          <div key={key} style={{
            padding: '14px 16px',
            background: isDecision ? 'var(--surface-1)' : 'var(--surface-0)',
            border: `1px solid ${isDecision ? 'var(--brand-200)' : 'var(--line)'}`,
            borderRadius: 'var(--r-lg)',
          }}>
            <h3 style={{
              fontSize: 12.5, fontWeight: 700, color: isDecision ? 'var(--brand-800)' : 'var(--ink-500)',
              textTransform: 'uppercase', letterSpacing: 0.5, margin: 0,
            }}>
              {REVIEWER_SECTION_LABELS[key] ?? key.replace(/_/g, ' ')}
            </h3>
            {renderValue(key, value)}
          </div>
        )
      })}
    </div>
  )
}
