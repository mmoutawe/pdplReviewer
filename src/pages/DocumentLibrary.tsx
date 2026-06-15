import { useEffect, useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { fetchDocuments, uploadDocument, downloadDocument, deleteDocument } from '../api/documentLibrary'
import { FilterBar } from '../components/table'
import { EmptyState } from '../components/primitives'
import { showToast, authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { VENDORS, PROJECTS } from '../data/seed'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '../data/types'
import type { ProjectDocument, ProjectDocumentType, ProjectDocumentStatus } from '../data/types'
import { formatDate } from '../lib/utils'

const STATUS_PILL: Record<ProjectDocumentStatus, string> = {
  active:     'pill-emerald',
  draft:      'pill-amber',
  superseded: 'pill-slate',
  expired:    'pill-red',
}

export default function DocumentLibrary() {
  useEffect(() => { document.title = 'Document Library — PDPL Reviewer' }, [])
  const { user } = useStore(authStore)

  const [docs, setDocs]           = useState<ProjectDocument[]>([])
  const [loading, setLoading]     = useState(isSupabaseConfigured)
  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState('')
  const [statusFilter, setStatus] = useState('')
  const [vendorFilter, setVendor] = useState('')
  const [uploading, setUploading] = useState(false)

  // Upload form state
  const [showUpload, setShowUpload] = useState(false)
  const [upTitle, setUpTitle]       = useState('')
  const [upType, setUpType]         = useState<ProjectDocumentType>('other')
  const [upDesc, setUpDesc]         = useState('')
  const [upVendor, setUpVendor]     = useState('')
  const [upProject, setUpProject]   = useState('')
  const [upFile, setUpFile]         = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    try {
      setDocs(await fetchDocuments())
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load documents.', 'error')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const vendorMap  = Object.fromEntries(VENDORS.map((v) => [v.id, v.tradeName]))
  const projectMap = Object.fromEntries(PROJECTS.map((p) => [p.id, p.name]))

  const visible = docs.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter   && d.document_type !== typeFilter)  return false
    if (statusFilter && d.status        !== statusFilter) return false
    if (vendorFilter && d.vendor_id     !== vendorFilter) return false
    return true
  })

  async function handleUpload() {
    if (!upFile || !upTitle.trim()) { showToast('Title and file are required.', 'error'); return }
    setUploading(true)
    try {
      let doc: ProjectDocument
      if (isSupabaseConfigured) {
        doc = await uploadDocument(upFile, {
          title: upTitle.trim(),
          document_type: upType,
          description: upDesc.trim() || undefined,
          project_id: upProject || undefined,
          vendor_id:  upVendor  || undefined,
        }, user?.id)
      } else {
        const now = new Date().toISOString()
        doc = {
          id:                 crypto.randomUUID(),
          title:              upTitle.trim(),
          document_type:      upType,
          description:        upDesc.trim() || null,
          project_id:         upProject || null,
          vendor_id:          upVendor  || null,
          parent_document_id: null,
          version:            1,
          status:             'draft',
          file_path:          upFile.name,
          file_type:          upFile.type || 'application/octet-stream',
          file_size:          upFile.size,
          tags:               null,
          effective_date:     null,
          expiry_date:        null,
          uploaded_by:        user?.id ?? null,
          created_at:         now,
          updated_at:         now,
        }
      }
      setDocs((prev) => [doc, ...prev])
      setShowUpload(false)
      setUpTitle(''); setUpDesc(''); setUpVendor(''); setUpProject(''); setUpFile(null)
      showToast('Document uploaded.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error')
    } finally { setUploading(false) }
  }

  async function handleDelete(doc: ProjectDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    try {
      await deleteDocument(doc)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      showToast('Document deleted.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error')
    }
  }

  async function handleDownload(doc: ProjectDocument) {
    try {
      await downloadDocument(doc)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed.', 'error')
    }
  }

  const typeOptions   = Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const statusOptions = Object.entries(DOCUMENT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const vendorOptions = VENDORS.map((v) => ({ value: v.id, label: v.tradeName }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Document Library</h1>
          <p className="page-subtitle">Search and manage project documents across vendors and engagements</p>
        </div>
        {isSupabaseConfigured && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowUpload((o) => !o)}>
            {showUpload ? 'Cancel' : '+ Upload document'}
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && isSupabaseConfigured && (
        <div className="card" style={{ margin: '0 24px 20px', padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Upload new document</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Title *</label>
              <input className="input" value={upTitle} onChange={(e) => setUpTitle(e.target.value)} placeholder="e.g. Sahab DPA v3" />
            </div>
            <div>
              <label style={labelStyle}>Document type</label>
              <select className="input" value={upType} onChange={(e) => setUpType(e.target.value as ProjectDocumentType)}>
                {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vendor</label>
              <select className="input" value={upVendor} onChange={(e) => setUpVendor(e.target.value)}>
                <option value="">None</option>
                {VENDORS.map((v) => <option key={v.id} value={v.id}>{v.tradeName}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <select className="input" value={upProject} onChange={(e) => setUpProject(e.target.value)}>
                <option value="">None</option>
                {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <input className="input" value={upDesc} onChange={(e) => setUpDesc(e.target.value)} placeholder="Brief description" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>File (PDF, DOCX, XLSX) *</label>
              <input type="file" className="input" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt"
                onChange={(e) => setUpFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setShowUpload(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div style={{ margin: '0 24px 16px', padding: '12px 16px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--amber-700)' }}>
          ⚠ Document Library requires a Dataverse connection. Configure <code>VITE_DATAVERSE_URL</code> and MSAL credentials in <code>.env.local</code> to upload and manage documents.
        </div>
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="Search by title…"
        filters={[
          { key: 'type',   label: 'Type',   options: typeOptions,   value: typeFilter,   onChange: setType },
          { key: 'status', label: 'Status', options: statusOptions, value: statusFilter, onChange: setStatus },
          { key: 'vendor', label: 'Vendor', options: vendorOptions, value: vendorFilter, onChange: setVendor },
        ]}
      />

      {loading ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-400)', fontSize: 14 }}>Loading documents…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={isSupabaseConfigured ? 'No documents found' : 'No documents yet'}
          body={isSupabaseConfigured ? 'Adjust filters or upload your first document.' : 'Connect Dataverse to upload and manage project documents.'}
          icon={<FileText size={26} color="var(--teal-600)" />}
        />
      ) : (
        <div style={{ padding: '0 24px 24px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--line)' }}>
                  {['Document', 'Vendor', 'Project', 'Type', 'Ver.', 'Status', 'Uploaded', ''].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{d.title}</div>
                      {d.description && <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{d.description}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-600)' }}>{d.vendor_id ? vendorMap[d.vendor_id] ?? '—' : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-600)' }}>{d.project_id ? projectMap[d.project_id] ?? '—' : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="tag" style={{ fontSize: 11 }}>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>v{d.version}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`pill pill-no-dot ${STATUS_PILL[d.status] ?? 'pill-slate'}`} style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                        {DOCUMENT_STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-400)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(d.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => void handleDownload(d)}>Download</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }} onClick={() => void handleDelete(d)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 500,
  color: 'var(--ink-700)', marginBottom: 4,
}
