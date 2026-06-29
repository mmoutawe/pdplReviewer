import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VENDORS } from '../data/seed'
import type { Vendor } from '../data/types'
import { fetchVendors, createVendor } from '../api/vendors'
import { isDataverseConfigured } from '../lib/dataverse'
import { authStore, showToast } from '../store'
import { useStore } from '../hooks/useStore'

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
  const [saving, setSaving]                 = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tradeName.trim()) { setError('Trade name is required.'); return }
    if (!legalName.trim()) { setError('Legal name is required.'); return }
    const vendorData = {
      tradeName: tradeName.trim(),
      legalName: legalName.trim(),
      jurisdiction: jurisdiction.trim() || 'KSA',
      category: category.trim() || 'Other',
      primaryContact: primaryContact.trim(),
      riskScore: 50 as number, riskTier: 'medium' as const, status: 'pending' as const,
      certifications: [], hasDPA,
      lastReviewedAt: new Date().toISOString().slice(0, 10), notes: '',
    }
    if (isDataverseConfigured) {
      setSaving(true)
      try {
        const saved = await createVendor(vendorData)
        onCreated(saved)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save vendor')
        showToast('Failed to save vendor.', 'error')
      } finally {
        setSaving(false)
      }
    } else {
      onCreated({ ...vendorData, id: `v-new-${Date.now()}`, ticketIds: [] })
      onClose()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 480, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>New vendor</h2>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InviteVendorDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail]   = useState('')
  const [name,  setName]    = useState('')
  const [link,  setLink]    = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Recipient email is required.'); return }
    setError(null)
    const token = `ext-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
    const url = `${window.location.origin}/external/register/${token}`
    setLink(url)
    // In demo mode: just display the link. In Dataverse mode: call API to create invite record.
  }

  function copyLink() {
    if (link) void navigator.clipboard.writeText(link)
    showToast('Link copied to clipboard.', 'success')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 500, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 6 }}>Invite vendor as External User</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 20, lineHeight: 1.6 }}>
          Generate a registration link for a vendor. They'll create an account with restricted access to submit their own onboarding request.
        </p>

        {!link ? (
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>VENDOR EMAIL *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@vendor.com" style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>CONTACT NAME (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmad Al-Rashid" style={inputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Generate invite link</button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 12px', background: 'var(--emerald-50)', border: '1px solid var(--emerald-200)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--emerald-700)' }}>
              ✓ Invite link generated for <strong>{email}</strong>{name ? ` (${name})` : ''}.
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 6, letterSpacing: '0.02em' }}>REGISTRATION LINK</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '8px 10px', background: 'var(--surface-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', wordBreak: 'break-all' }}>
                  {link}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={copyLink} style={{ flexShrink: 0 }}>Copy</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-400)', lineHeight: 1.6 }}>
              Send this link to the vendor by email. The link expires in 30 days and grants restricted access to submit a vendor onboarding request only.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VendorLibrary() {
  useEffect(() => { document.title = 'Vendors — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { user } = useStore(authStore)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vendors, setVendors]           = useState<Vendor[]>([...VENDORS])
  const [loading, setLoading]           = useState(false)
  const [showCreate, setShowCreate]     = useState(false)
  const [showInvite, setShowInvite]     = useState(false)

  useEffect(() => {
    if (!isDataverseConfigured) return
    setLoading(true)
    fetchVendors()
      .then(setVendors)
      .catch(() => showToast('Failed to load vendors.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const canInvite = user.role === 'data_management' || user.role === 'admin'

  const visible = vendors.filter((v) => {
    if (user.role === 'external_user' && v.createdBy !== user.id) return false
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
        <div style={{ display: 'flex', gap: 8 }}>
          {canInvite && (
            <button
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 14, fontWeight: 500 }}
              onClick={() => setShowInvite(true)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Invite Vendor
            </button>
          )}
          {user.role !== 'external_user' && (
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
          )}
          {user.role === 'external_user' && (
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 14, fontWeight: 600 }}
              onClick={() => setShowCreate(true)}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M6.5 1.5v10M1.5 6.5h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Add My Vendor
            </button>
          )}
        </div>
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
          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>Loading vendors…</div>
          ) : visible.length === 0 ? (
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
      {showInvite && <InviteVendorDialog onClose={() => setShowInvite(false)} />}
    </div>
  )
}
