import { SECTION_ORDER, SECTION_LABELS, type PresubmitRequestType } from '../api/aiPresubmit'

interface RiskItem   { title: string; detail: string; severity: string; article_ref?: string }
interface FixItem    { title: string; detail: string }

const SEVERITY_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  low:      { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  medium:   { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  high:     { bg: '#FFF7ED', color: '#9A3412', border: '#FDBA74' },
  critical: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
}

function RiskBadge({ level }: { level: string }) {
  const s = SEVERITY_STYLE[level.toLowerCase()] ?? SEVERITY_STYLE.medium
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {level}
    </span>
  )
}

function renderValue(key: string, value: unknown) {
  // Overall risk level → big badge
  if (key === 'risk_level' && typeof value === 'string') {
    return <div style={{ marginTop: 4 }}><RiskBadge level={value} /></div>
  }

  // key_risks → cards
  if (key === 'key_risks' && Array.isArray(value)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {(value as RiskItem[]).map((r, i) => (
          <div key={i} style={{
            padding: '10px 14px', borderRadius: 'var(--r-md)',
            border: `1px solid ${SEVERITY_STYLE[r.severity?.toLowerCase()] ? SEVERITY_STYLE[r.severity.toLowerCase()].border : 'var(--line)'}`,
            background: SEVERITY_STYLE[r.severity?.toLowerCase()]?.bg ?? 'var(--surface-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', flex: 1 }}>{r.title}</span>
              {r.severity && <RiskBadge level={r.severity} />}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-700)', margin: 0, lineHeight: 1.5 }}>{r.detail}</p>
            {r.article_ref && (
              <p style={{ fontSize: 12, color: 'var(--ink-400)', margin: '4px 0 0', fontStyle: 'italic' }}>
                {r.article_ref}
              </p>
            )}
          </div>
        ))}
      </div>
    )
  }

  // suggested_fixes → numbered list
  if (key === 'suggested_fixes' && Array.isArray(value)) {
    return (
      <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(value as FixItem[]).map((f, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.55 }}>
            <strong>{f.title}:</strong> {f.detail}
          </li>
        ))}
      </ol>
    )
  }

  // Array of strings → bullet list
  if (Array.isArray(value)) {
    if (value.length === 0) return <p style={{ fontSize: 13, color: 'var(--ink-400)', margin: '4px 0 0' }}>None identified.</p>
    return (
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(value as string[]).map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.55 }}>{item}</li>
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

export function PresubmitAssessmentView({ data, requestType }: Props) {
  const order = SECTION_ORDER[requestType as PresubmitRequestType] ?? Object.keys(data)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {order.map((key) => {
        const value = data[key]
        if (value === undefined || value === null) return null
        return (
          <div key={key} style={{
            padding: '14px 16px',
            background: 'var(--surface-0)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
          }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
              {SECTION_LABELS[key] ?? key.replace(/_/g, ' ')}
            </h3>
            {renderValue(key, value)}
          </div>
        )
      })}
    </div>
  )
}
