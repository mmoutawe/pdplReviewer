import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VENDORS } from '../data/seed'
import { FilterBar } from '../components/table'
import { RiskMeter } from '../components/forms'
import { formatDate, riskColor } from '../lib/utils'

export default function VendorLibrary() {
  useEffect(() => { document.title = 'Vendors — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const visible = VENDORS.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    return v.tradeName.toLowerCase().includes(q) || v.legalName.toLowerCase().includes(q) || v.jurisdiction.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Vendor Library</h1>
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
      </div>
    </div>
  )
}
