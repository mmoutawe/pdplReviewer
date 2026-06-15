import type { ReplyEvaluation } from '../api/aiEvaluateReply'

const RECOMMENDATION_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  accept:       { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0', label: 'Accept & proceed' },
  return_again: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Return again' },
  escalate:     { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA', label: 'Escalate' },
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#166534' : score >= 50 ? '#92400E' : '#991B1B'
  const bg    = score >= 75 ? '#F0FDF4' : score >= 50 ? '#FFFBEB' : '#FEF2F2'
  return (
    <div style={{
      width: 64, height: 64, borderRadius: '50%',
      background: bg, border: `3px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{score}</span>
    </div>
  )
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return null
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6, marginBottom: 2 }}>
          <span style={{ color }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  evaluation: ReplyEvaluation
}

export function EvaluateReplyView({ evaluation: ev }: Props) {
  const recStyle = RECOMMENDATION_STYLE[ev.recommendation] ?? RECOMMENDATION_STYLE.return_again

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Score + recommendation header */}
      <div style={{
        display: 'flex', gap: 14, alignItems: 'center',
        padding: '12px 16px', borderRadius: 'var(--r-lg)',
        background: recStyle.bg, border: `1px solid ${recStyle.border}`,
      }}>
        <ScoreRing score={ev.overall_score} />
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'inline-block', padding: '3px 12px', borderRadius: 999, marginBottom: 6,
            fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
            background: recStyle.border, color: recStyle.color,
          }}>
            {recStyle.label}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6, margin: 0 }}>
            {ev.summary}
          </p>
        </div>
      </div>

      {/* Resolved */}
      {ev.resolved_points.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            ✓ Resolved
          </div>
          <BulletList items={ev.resolved_points} color="#166534" />
        </div>
      )}

      {/* Open concerns */}
      {ev.open_concerns.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#B45309', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            ⚠ Still open
          </div>
          <BulletList items={ev.open_concerns} color="#92400E" />
        </div>
      )}

      {/* New requirements */}
      {ev.new_requirements.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#991B1B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            ✕ New requirements
          </div>
          <BulletList items={ev.new_requirements} color="#991B1B" />
        </div>
      )}

      {/* Document review */}
      {ev.document_review && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--surface-1)', border: '1px solid var(--line)',
          fontSize: 12.5,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Document review</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: ev.document_review.present ? '#166534' : '#991B1B' }}>
              {ev.document_review.present ? '✓ Present' : '✕ Missing'}
            </span>
            {ev.document_review.present && (
              <>
                <span style={{ color: ev.document_review.relevant ? '#166534' : '#B45309' }}>
                  {ev.document_review.relevant ? '✓ Relevant' : '⚠ Irrelevant'}
                </span>
                <span style={{ color: ev.document_review.appears_signed ? '#166534' : '#B45309' }}>
                  {ev.document_review.appears_signed ? '✓ Appears signed' : '⚠ Not signed'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
