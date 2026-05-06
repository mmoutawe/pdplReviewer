import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RequestType } from '../../data/types'
import { REQUEST_TYPE_LABELS, VENDORS, PROJECTS } from '../../data/seed'

const TYPE_DESCRIPTIONS: Record<RequestType, string> = {
  vendor_onboarding: 'Assess a new vendor or third-party service provider that will process personal data on your behalf.',
  external_document_sharing: 'Share an internal document with an external party under a time-limited, permissioned link.',
  data_sharing_external: 'Share a dataset or data feed with an external organization on an ongoing or one-time basis.',
  internal_data_access: 'Request read or write access to an internal data system or analytics dataset.',
  cross_border_transfer: 'Transfer personal data to a recipient or system outside the Kingdom of Saudi Arabia.',
}

const TYPE_ICONS: Record<RequestType, string> = {
  vendor_onboarding: '🏢',
  external_document_sharing: '📤',
  data_sharing_external: '🔗',
  internal_data_access: '🔑',
  cross_border_transfer: '🌐',
}

const TYPES: RequestType[] = [
  'vendor_onboarding',
  'external_document_sharing',
  'data_sharing_external',
  'internal_data_access',
  'cross_border_transfer',
]

const selectSt: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)', background: 'var(--surface-0)',
  color: 'var(--ink-900)', outline: 'none', flex: 1,
}

export default function WizardStepType() {
  useEffect(() => { document.title = 'New Request — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [vendorId, setVendorId] = useState('')
  const [projectId, setProjectId] = useState('')

  function handleSelectType(type: RequestType) {
    const params = new URLSearchParams()
    if (vendorId) params.set('vendorId', vendorId)
    if (projectId) params.set('projectId', projectId)
    const qs = params.toString()
    navigate(`/requests/new/${type}/method${qs ? `?${qs}` : ''}`)
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 24, fontSize: 12.5, color: 'var(--ink-400)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')} style={{ padding: 0, fontSize: 12.5, color: 'var(--ink-500)' }}>Requests</button>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: 'var(--ink-800)' }}>New request</span>
      </nav>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>New privacy request</h1>
      <p style={{ color: 'var(--ink-500)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
        Select the type of request you want to submit. Each type follows a tailored assessment process aligned with PDPL obligations.
      </p>

      {/* Optional vendor + project linker */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 12 }}>
          Link to vendor / project <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--ink-400)' }}>(optional)</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.02em' }}>VENDOR</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={selectSt}>
              <option value="">— None —</option>
              {VENDORS.map((v) => (
                <option key={v.id} value={v.id}>{v.tradeName}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.02em' }}>PROJECT</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={selectSt}>
              <option value="">— None —</option>
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {(vendorId || projectId) && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-700)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {vendorId && <span>Vendor: <strong>{VENDORS.find((v) => v.id === vendorId)?.tradeName}</strong></span>}
            {projectId && <span>Project: <strong>{PROJECTS.find((p) => p.id === projectId)?.name}</strong></span>}
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', fontSize: 11.5, color: 'var(--ink-400)', height: 'auto' }}
              onClick={() => { setVendorId(''); setProjectId('') }}>Clear</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TYPES.map((type) => (
          <button key={type}
            onClick={() => handleSelectType(type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px',
              background: 'var(--surface-0)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-lg)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all var(--t-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand-700)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-50)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-0)'
            }}>
            <span style={{ fontSize: 28, flexShrink: 0 }} aria-hidden="true">{TYPE_ICONS[type]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
                {REQUEST_TYPE_LABELS[type]}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.55 }}>
                {TYPE_DESCRIPTIONS[type]}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: 'var(--ink-300)', flexShrink: 0 }}>
              <path d="M4.5 2.5l5 4.5-5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
