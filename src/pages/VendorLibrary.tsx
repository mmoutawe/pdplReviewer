import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VENDORS } from '../data/seed'
import type { Vendor } from '../data/types'

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l2 2-8 8H2.5v-2l8-8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

function StatusBadge({ status }: { status: Vendor['status'] }) {
  const colors: Record<Vendor['status'], { bg: string; color: string; border: string }> = {
    active:     { bg: 'var(--emerald-50)', color: 'var(--emerald-700)', border: 'var(--emerald-200)' },
    pending:    { bg: 'var(--amber-50)',   color: 'var(--amber-700)',   border: 'var(--amber-200)' },
    sunset:     { bg: 'var(--surface-2)', color: 'var(--ink-500)',      border: 'var(--line)' },
    terminated: { bg: 'var(--red-50)',    color: 'var(--red-700)',      border: '#FECACA' },
  }
  const s = colors[status] ?? colors.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 'var(--r-full)',
      fontSize: 12, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function CreateVendorDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (v: Vendor) => void }) {
  const [tradeName, setTradeName]           = useState('')
  const [legalName, setLegalName]           = useState('')
  const [jurisdiction, setJurisdiction]     = useState('KSA')
  const [category, setCategory]             = useState('')
  const [primaryContact, setPrimaryContact] = useState('')
  const [hasDPA, setHasDPA]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)

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
      riskScore: 50, riskTier: 'medium', status: 'pending',
      certifications: [], hasDPA,
      lastReviewedAt: now, ticketIds: [], notes: '',
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
              <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="KSA, UAE…" style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>CATEGORY</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="SaaS, Payments…" style={inputSt}
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
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vendors, setVendors]     = useState<Vendor[]>([...VENDORS])
  const [showCreate, setShowCreate] = useState(false)

  const visible = vendors.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.tradeName.toLowerCase().includes(q) ||
      v.legalName.toLowerCase().includes(q) ||
      v.jurisdiction.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Vendor Registry</h1>
          <p className="page-subtitle">Manage vendor profiles and compliance status</p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 14, fontWeight: 600 }}
          onClick={() => setShowCreate(true)}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 1.5v10M1.5 6.5h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New Vendor
        </button>
      </div>

      {/* ── Search + filter bar ── */}
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Search & filter row */}
          <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors..."
                style={{ ...inputSt, paddingLeft: 32 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 32px 8px 12px', fontSize: 13, border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-700)',
                  outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: 130,
                }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="sunset">Sunset</option>
                <option value="terminated">Terminated</option>
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Table */}
          {visible.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>
              No vendors match your search.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Vendor', 'Type', 'Country', 'Status', 'Compliance', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-500)', fontSize: 12.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((v, i) => (
                  <tr
                    key={v.id}
                    style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/vendors/${v.id}`)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-1)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                  >
                    {/* Vendor name + legal name */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{v.tradeName}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>{v.legalName}</div>
                    </td>
                    {/* Type / category */}
                    <td style={{ padding: '14px 20px', color: 'var(--brand-700)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {v.category}
                    </td>
                    {/* Country / jurisdiction */}
                    <td style={{ padding: '14px 20px', color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>
                      {v.jurisdiction}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={v.status} />
                    </td>
                    {/* Compliance: DPA + risk tier */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {v.hasDPA ? (
                          <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--emerald-50)', color: 'var(--emerald-700)', border: '1px solid var(--emerald-200)', fontWeight: 500 }}>DPA ✓</span>
                        ) : (
                          <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--red-50)', color: 'var(--red-700)', border: '1px solid #FECACA', fontWeight: 500 }}>No DPA</span>
                        )}
                        <span style={{
                          fontSize: 11.5, padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 500,
                          ...(v.riskTier === 'low'
                            ? { background: 'var(--emerald-50)', color: 'var(--emerald-700)', border: '1px solid var(--emerald-200)' }
                            : v.riskTier === 'medium'
                            ? { background: 'var(--amber-50)', color: 'var(--amber-700)', border: '1px solid var(--amber-200)' }
                            : { background: 'var(--red-50)', color: 'var(--red-700)', border: '1px solid #FECACA' }),
                        }}>
                          {v.riskTier} risk
                        </span>
                      </div>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '14px 20px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/vendors/${v.id}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-500)', padding: 4, borderRadius: 'var(--r-sm)', display: 'inline-flex' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-700)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-500)' }}
                        title="Edit vendor"
                        aria-label={`Edit ${v.tradeName}`}
                      >
                        <EditIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
