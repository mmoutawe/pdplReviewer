import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { vendorById, TICKETS } from '../data/seed'
import { EmptyState } from '../components/primitives'
import { RiskMeter } from '../components/forms'
import { formatDate, riskColor } from '../lib/utils'
import type { ProjectDocumentType, ProjectDocumentStatus } from '../data/types'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '../data/types'

interface VendorDoc { id: string; title: string; type: ProjectDocumentType; status: ProjectDocumentStatus; date: string; fileType: string }

const VENDOR_DOC_MAP: Record<string, VendorDoc[]> = {
  'v-sahab': [
    { id: 'd1', title: 'DPA v3.2 — Sahab Cloud Services', type: 'dpa', status: 'active', date: '2026-02-10', fileType: 'PDF' },
    { id: 'd2', title: 'SOC 2 Type II Report (2025)', type: 'soc2', status: 'active', date: '2026-03-15', fileType: 'PDF' },
    { id: 'd3', title: 'ISO 27001 Certificate', type: 'iso27001', status: 'active', date: '2025-11-01', fileType: 'PDF' },
  ],
  'v-tasdeer': [
    { id: 'd4', title: 'DPA — Tasdeer Payments', type: 'dpa', status: 'active', date: '2026-01-22', fileType: 'PDF' },
    { id: 'd5', title: 'PCI DSS Attestation of Compliance', type: 'other', status: 'active', date: '2025-12-10', fileType: 'PDF' },
  ],
  'v-mada': [
    { id: 'd6', title: 'DPA — MADA Analytics', type: 'dpa', status: 'active', date: '2025-12-04', fileType: 'PDF' },
    { id: 'd7', title: 'Transfer Impact Assessment', type: 'report', status: 'active', date: '2026-01-08', fileType: 'PDF' },
    { id: 'd8', title: 'ISO 27001 Certificate', type: 'iso27001', status: 'active', date: '2025-09-30', fileType: 'PDF' },
  ],
  'v-zenith': [
    { id: 'd9', title: 'DPA — Zenith CRM (draft)', type: 'dpa', status: 'draft', date: '2026-04-08', fileType: 'DOCX' },
    { id: 'd10', title: 'Cross-Border Transfer Assessment', type: 'report', status: 'draft', date: '2026-04-10', fileType: 'PDF' },
  ],
  'v-baseera': [
    { id: 'd11', title: 'DPA — Baseera Insights', type: 'dpa', status: 'active', date: '2026-03-01', fileType: 'PDF' },
    { id: 'd12', title: 'NDA — Research Collaboration', type: 'nda', status: 'active', date: '2025-10-15', fileType: 'PDF' },
  ],
  'v-falcon': [
    { id: 'd13', title: 'DPA — Falcon Identity Solutions', type: 'dpa', status: 'active', date: '2026-03-18', fileType: 'PDF' },
    { id: 'd14', title: 'SOC 2 Type II Report (2025)', type: 'soc2', status: 'active', date: '2026-02-28', fileType: 'PDF' },
    { id: 'd15', title: 'NIA Approval Certificate', type: 'other', status: 'active', date: '2025-08-12', fileType: 'PDF' },
  ],
}

interface DocVersion {
  id: string
  title: string
  fileType: string
  date: string
  status: ProjectDocumentStatus
  uploadedBy: string
}

function UploadVersionDialog({ docTitle, onClose, onUpload }: {
  docTitle: string
  onClose: () => void
  onUpload: (filename: string, fileType: string) => void
}) {
  const [filename, setFilename] = useState('')
  const [fileType, setFileType] = useState('PDF')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filename.trim()) { setError('File name is required.'); return }
    onUpload(filename.trim(), fileType)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 400, padding: '24px 28px', zIndex: 1 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Upload new version</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 16 }}>{docTitle}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>FILE NAME *</label>
            <input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="e.g. DPA v4.0 — Vendor Name"
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em' }}>FILE TYPE</label>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', background: 'var(--surface-0)', color: 'var(--ink-900)', outline: 'none' }}>
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
              <option value="XLSX">XLSX</option>
            </select>
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">Upload version</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function VendorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const v = vendorById(id ?? '')

  useEffect(() => { document.title = v ? `${v.tradeName} — PDPL Reviewer` : 'Vendor — PDPL Reviewer' }, [v])

  const baseVendorDocs = VENDOR_DOC_MAP[id ?? ''] ?? []

  // version history: map from docId → versions[], newest first
  const [versionHistory, setVersionHistory] = useState<Record<string, DocVersion[]>>(() => {
    const initial: Record<string, DocVersion[]> = {}
    baseVendorDocs.forEach((doc) => {
      initial[doc.id] = [{
        id: doc.id + '-v1',
        title: doc.title,
        fileType: doc.fileType,
        date: doc.date,
        status: doc.status,
        uploadedBy: 'System',
      }]
    })
    return initial
  })
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  function handleUpload(docId: string, _docTitle: string, filename: string, fileType: string) {
    setVersionHistory((prev) => {
      const existingVersions = (prev[docId] ?? []).map((ver) => ({ ...ver, status: 'superseded' as ProjectDocumentStatus }))
      const newVer: DocVersion = {
        id: `${docId}-v${Date.now()}`,
        title: filename,
        fileType,
        date: new Date().toISOString().slice(0, 10),
        status: 'active',
        uploadedBy: 'Current user',
      }
      return { ...prev, [docId]: [newVer, ...existingVersions] }
    })
  }

  if (!v) return <EmptyState title="Vendor not found" icon={<Building2 size={26} color="var(--teal-600)" />}
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

      <div className="card" style={{ padding: '14px 20px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>Documents ({baseVendorDocs.length})</h2>
        {baseVendorDocs.length === 0 ? (
          <p style={{ color: 'var(--ink-400)', fontSize: 13 }}>No documents on file for this vendor.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {baseVendorDocs.map((doc) => {
              const versions = versionHistory[doc.id] ?? []
              const current = versions[0] ?? doc
              const isExpanded = expandedDoc === doc.id
              return (
                <div key={doc.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface-1)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--brand-700)', flexShrink: 0 }}>
                      {current.fileType}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 1 }}>
                        {DOCUMENT_TYPE_LABELS[doc.type]} · {formatDate(current.date)} · v{versions.length}
                      </div>
                    </div>
                    <span className={`pill pill-no-dot ${current.status === 'active' ? 'pill-emerald' : current.status === 'draft' ? 'pill-amber' : 'pill-slate'}`}
                      style={{ fontSize: 10.5, height: 18, padding: '0 6px', flexShrink: 0 }}>
                      {DOCUMENT_STATUS_LABELS[current.status]}
                    </span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, flexShrink: 0 }}
                      onClick={() => setUploadingFor(doc.id)}>
                      ↑ Upload
                    </button>
                    {versions.length > 1 && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11.5, flexShrink: 0 }}
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}>
                        {isExpanded ? 'Hide history' : `History (${versions.length})`}
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-0)' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-400)', marginBottom: 6, letterSpacing: '0.04em' }}>VERSION HISTORY</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {versions.map((ver, i) => (
                          <div key={ver.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-700)' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)', minWidth: 24 }}>v{versions.length - i}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ver.title}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>{formatDate(ver.date)}</span>
                            <span className={`pill pill-no-dot ${ver.status === 'active' ? 'pill-emerald' : 'pill-slate'}`}
                              style={{ fontSize: 10, height: 16, padding: '0 5px', flexShrink: 0 }}>
                              {ver.status === 'active' ? 'Active' : 'Superseded'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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

      {uploadingFor !== null && (() => {
        const doc = baseVendorDocs.find((d) => d.id === uploadingFor)!
        return (
          <UploadVersionDialog
            docTitle={doc.title}
            onClose={() => setUploadingFor(null)}
            onUpload={(filename, fileType) => handleUpload(doc.id, doc.title, filename, fileType)}
          />
        )
      })()}
    </div>
  )
}
