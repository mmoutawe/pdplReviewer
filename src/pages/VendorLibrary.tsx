import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VENDORS } from '../data/seed'
import type { Vendor } from '../data/types'
import { FilterBar } from '../components/table'
import { RiskMeter } from '../components/forms'
import { formatDate, riskColor } from '../lib/utils'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function CreateVendorDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Vendor) => void }) {
  const [tradeName, setTradeName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [jurisdiction, setJurisdiction] = useState('KSA')
  const [category, setCategory] = useState('')
  const [primaryContact, setPrimaryContact] = useState('')
  const [hasDPA, setHasDPA] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tradeName.trim()) { setError('Trade name is required.'); return }
    if (!legalName.trim()) { setError('Legal name is required.'); return }
    const now = new Date().toISOString()
    const newVendor: Vendor = {
      id: `v-new-${Date.now()}`,
      tradeName: tradeName.trim(),
      legalName: legalName.trim(),
      jurisdiction: jurisdiction.trim() || 'KSA',
      category: category.trim() || 'Other',
      primaryContact: primaryContact.trim(),
      riskScore: 50,
      riskTier: 'medium',
      status: 'pending',
      certifications: [],
      hasDPA,
      lastReviewedAt: now,
      ticketIds: [],
      notes: '',
    }
    onCreated(newVendor)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 480, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>New vendor</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>TRADE NAME *</label>
            <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="e.g. Acme Cloud" style={inputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>LEGAL NAME *</label>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Acme Cloud Services LLC" style={inputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>JURISDICTION</label>
              <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. KSA, UAE" style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>CATEGORY</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. SaaS, Payments" style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>PRIMARY CONTACT EMAIL</label>
            <input type="email" value={primaryContact} onChange={(e) => setPrimaryContact(e.target.value)} placeholder="compliance@vendor.com" style={inputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-700)', cursor: 'pointer' }}>
            <input type="checkbox" checked={hasDPA} onChange={(e) => setHasDPA(e.target.checked)} />
            DPA (Data Processing Agreement) signed
          </label>
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create vendor</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function VendorLibrary() {
  useEffect(() => { document.title = 'Vendors — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([...VENDORS])
  const [showCreate, setShowCreate] = useState(false)

  const visible = vendors.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return v.tradeName.toLowerCase().includes(q) || v.legalName.toLowerCase().includes(q) || v.jurisdiction.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Vendor Library</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          New vendor
        </button>
      </div>
      <FilterBar search={search} onSearch={setSearch} placeholder="Search by name or jurisdiction…" />
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((v) => (
          <button key={v.id} onClick={() => navigate(`/vendors/${v.id}`)}
            className="card card-hover"
            style={{ padding: '14px 20px', textAlign: 'left', width: '100%', background: 'var(--surface-0)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink-900)' }}>{v.tradeName}</span>
                <span className={`pill pill-no-dot ${v.status === 'active' ? 'pill-emerald' : v.status === 'pending' ? 'pill-amber' : 'pill-slate'}`}
                  style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>{v.status}</span>
                {!v.hasDPA && <span className="pill pill-red pill-no-dot" style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>No DPA</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 6 }}>
                {v.category} · {v.jurisdiction} · Last reviewed {formatDate(v.lastReviewedAt)}
              </div>
              <RiskMeter score={v.riskScore} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', minWidth: 100, flexShrink: 0 }}>
              <span className={`pill pill-no-dot ${riskColor(v.riskTier) === 'emerald' ? 'pill-emerald' : riskColor(v.riskTier) === 'amber' ? 'pill-amber' : 'pill-red'}`}>
                {v.riskTier} risk
              </span>
              {v.certifications.slice(0, 2).map((c) => (
                <span key={c} className="tag" style={{ fontSize: 10.5 }}>{c}</span>
              ))}
            </div>
          </button>
        ))}
        {visible.length === 0 && (
          <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>No vendors match your search.</p>
        )}
      </div>
      {showCreate && (
        <CreateVendorDialog
          onClose={() => setShowCreate(false)}
          onCreated={(v) => setVendors((prev) => [v, ...prev])}
        />
      )}
    </div>
  )
}
