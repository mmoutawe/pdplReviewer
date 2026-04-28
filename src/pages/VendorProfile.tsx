import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { vendorById, TICKETS } from '../data/seed'
import { EmptyState } from '../components/primitives'
import { RiskMeter } from '../components/forms'
import { formatDate, riskColor } from '../lib/utils'

export default function VendorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const v = vendorById(id ?? '')

  useEffect(() => { document.title = v ? `${v.tradeName} — PDPL Reviewer` : 'Vendor — PDPL Reviewer' }, [v])

  if (!v) return <EmptyState title="Vendor not found" icon="🏢"
    action={<button className="btn btn-primary" onClick={() => navigate('/vendors')}>Back to vendors</button>} />

  const relatedTickets = TICKETS.filter((t) => t.vendorId === v.id)

  return (
    <div style={{ maxWidth: 860, padding: '28px 32px' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/vendors')} style={{ marginBottom: 16 }}>← Vendors</button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{v.tradeName}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{v.legalName} · {v.jurisdiction}</p>
        </div>
        <span className={`pill pill-no-dot ${riskColor(v.riskTier) === 'emerald' ? 'pill-emerald' : riskColor(v.riskTier) === 'amber' ? 'pill-amber' : 'pill-red'}`}>
          {v.riskTier} risk
        </span>
        <span className={`pill pill-no-dot ${v.status === 'active' ? 'pill-emerald' : 'pill-amber'}`}>{v.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Risk profile</h2>
          <RiskMeter score={v.riskScore} label="Risk score" />
          <dl style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ color: 'var(--ink-500)' }}>DPA signed</dt><dd>{v.hasDPA ? '✓ Yes' : '✕ No'}</dd></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ color: 'var(--ink-500)' }}>Category</dt><dd>{v.category}</dd></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><dt style={{ color: 'var(--ink-500)' }}>Last reviewed</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatDate(v.lastReviewedAt)}</dd></div>
          </dl>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Certifications</h2>
          {v.certifications.length > 0
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{v.certifications.map((c) => <span key={c} className="tag">{c}</span>)}</div>
            : <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No certifications on record.</p>}
        </div>
      </div>

      {v.notes && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Notes</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.65 }}>{v.notes}</p>
        </div>
      )}

      <div className="card" style={{ padding: '14px 20px' }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Linked requests ({relatedTickets.length})</h2>
        {relatedTickets.length === 0
          ? <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No requests linked to this vendor.</p>
          : <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {relatedTickets.map((t) => (
                <li key={t.id}>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requests/${t.id}`)}
                    style={{ justifyContent: 'flex-start', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{t.id}</span>
                    <span>{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>}
      </div>
    </div>
  )
}
