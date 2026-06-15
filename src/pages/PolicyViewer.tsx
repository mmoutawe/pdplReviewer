import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { policyById } from '../data/seed'
import { EmptyState } from '../components/primitives'
import { AICoPilotPanel } from '../components/AICoPilotPanel'
import { formatDate } from '../lib/utils'

export default function PolicyViewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pol = policyById(id ?? '')

  useEffect(() => { document.title = pol ? `${pol.code} — PDPL Reviewer` : 'Policy — PDPL Reviewer' }, [pol])

  if (!pol) return <EmptyState title="Policy not found" icon={<ClipboardList size={26} color="var(--teal-600)" />}
    action={<button className="btn btn-primary" onClick={() => navigate('/policies')}>Back to library</button>} />

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: 720, minWidth: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/policies')} style={{ marginBottom: 16 }}>← Policies</button>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="tag">{pol.code}</span>
          <span className={`pill pill-no-dot ${pol.status === 'active' ? 'pill-emerald' : 'pill-slate'}`}
            style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>{pol.status}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>v{pol.version} · Effective {formatDate(pol.effectiveDate)}</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>{pol.title}</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 24, lineHeight: 1.6 }}>{pol.summary}</p>

        <div className="card" style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Policy body</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.75 }}>{pol.body}</p>
        </div>

        <div className="card" style={{ padding: '14px 20px', marginTop: 16 }}>
          <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 12px', fontSize: 13 }}>
            <dt style={{ color: 'var(--ink-500)' }}>Owner</dt><dd>{pol.ownerDept}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>Category</dt><dd style={{ textTransform: 'uppercase' }}>{pol.category}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>Citations in tickets</dt><dd>{pol.citationCount}</dd>
            <dt style={{ color: 'var(--ink-500)' }}>Embeddings built</dt><dd>{pol.embeddingsBuilt ? 'Yes — searchable' : 'Pending'}</dd>
          </dl>
        </div>
      </div>

      {/* AI chat panel */}
      <aside style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--line)', padding: 16, background: 'var(--surface-0)', display: 'flex', flexDirection: 'column' }} aria-label="Policy chatbot">
        <AICoPilotPanel
          title="Policy Chat"
          cannedKey="policy_chat_pdpl29"
          context={`${pol.code} — ${pol.title}`}
          feature="policy_chat"
        />
      </aside>
    </div>
  )
}
