import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { USERS, POLICIES, AUDIT } from '../data/seed'
import { Avatar, RoleBadge, KPI } from '../components/primitives'
import { Tabs } from '../components/overlays'
import { formatDate, formatDateTime } from '../lib/utils'
import type { Role, User, Policy } from '../data/types'
import type { AdminExternalLink } from '../data/types'
import { isSupabaseConfigured } from '../lib/supabase'
import { showToast, ticketStore, demoDeleteTicket } from '../store'
import { useStore } from '../hooks/useStore'
import {
  fetchAppSettings, updateDocValidationSetting,
  fetchExternalLinks, createExternalAccount,
  toggleRevokeLink, deleteExternalLink,
  type AppSettings,
} from '../api/adminSettings'
import { getWorkflowSettings, setWorkflowSetting, type WorkflowSettings } from '../lib/workflowSettings'
import { deleteTicket as apiDeleteTicket } from '../api/tickets'

const ROLE_LABELS: Record<Role, string> = {
  requester: 'Requester',
  data_management: 'Data Management',
  legal: 'Legal',
  security: 'Security',
  admin: 'Admin',
  external_recipient: 'External Recipient',
}

const AI_SETTINGS = [
  { key: 'ai_intake_assistant', label: 'AI Request Builder', description: 'Conversational intake assistant for converting freeform input into structured requests.', enabled: true },
  { key: 'ai_pre_submission', label: 'Pre-Submission Assessment', description: 'Typed AI assessment run before submission to surface PDPL compliance gaps.', enabled: true },
  { key: 'ai_reviewer_copilot', label: 'Reviewer AI Co-Pilot', description: 'Role-aware assistant available in the ticket workspace during reviews.', enabled: true },
  { key: 'ai_document_chat', label: 'Document Chat', description: 'Q&A grounded on extracted document text from uploaded attachments.', enabled: true },
  { key: 'ai_policy_chat', label: 'Policy Chatbot', description: 'Answers questions grounded on policy library content.', enabled: true },
  { key: 'ai_evaluate_reply', label: 'Evaluate Reply', description: 'Scores requester responses to return comments using AI confidence scoring.', enabled: true },
]

type AuditPerm = { canView: boolean; canExport: boolean }
const DEFAULT_AUDIT_PERMS: Record<string, AuditPerm> = {
  admin:              { canView: true,  canExport: true  },
  data_management:    { canView: true,  canExport: false },
  legal:              { canView: false, canExport: false },
  security:           { canView: false, canExport: false },
  requester:          { canView: false, canExport: false },
}

const RETENTION_POLICIES = [
  { category: 'Active tickets', retention: '7 years', basis: 'PDPL Art.18 — retention period matches data subject rights window' },
  { category: 'Archived tickets', retention: '5 years', basis: 'PDPL Art.18 — post-approval archival period' },
  { category: 'Audit events', retention: 'Indefinite', basis: 'Regulatory compliance — immutable ledger' },
  { category: 'AI generations', retention: '3 years', basis: 'Operational review window' },
  { category: 'Attachments', retention: '7 years', basis: 'Mirrors ticket retention' },
  { category: 'Notifications', retention: '90 days', basis: 'Operational only' },
]

interface AdminProps { tab?: string }

export default function Admin({ tab: initialTab }: AdminProps) {
  useEffect(() => { document.title = 'Admin — PDPL Reviewer' }, [])
  const navigate = useNavigate()
  const { tickets } = useStore(ticketStore)
  const [tab, setTab] = useState(initialTab && initialTab !== 'home' ? initialTab : 'users')
  const [aiSettings, setAiSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(AI_SETTINGS.map((s) => [s.key, s.enabled]))
  )

  // ── Users tab ──
  const [localUsers, setLocalUsers] = useState<User[]>([...USERS])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // ── Policies tab ──
  const [localPolicies, setLocalPolicies] = useState<Policy[]>([...POLICIES])
  const [showNewPolicy, setShowNewPolicy] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)

  // ── Audit Access tab ──
  const [auditPerms, setAuditPerms] = useState<Record<string, AuditPerm>>({ ...DEFAULT_AUDIT_PERMS })
  const [editingAuditRole, setEditingAuditRole] = useState<string | null>(null)

  // ── All Tickets tab ──
  const [ticketSearch, setTicketSearch] = useState('')
  const filteredTickets = tickets.filter((t) => {
    if (!ticketSearch) return true
    const q = ticketSearch.toLowerCase()
    return t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
  })
  function exportFullLedger() {
    const header = ['Timestamp', 'Actor ID', 'Actor Role', 'Action', 'Target Type', 'Target ID', 'Immutable Hash', 'Prev Hash']
    const rows = [...AUDIT].sort((a, b) => b.ts.localeCompare(a.ts)).map((ev) => [
      ev.ts, ev.actorId, ev.actorRole, ev.action, ev.targetType ?? '',
      ev.targetId ?? '', ev.immutableHash, ev.prevHash ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-ledger-full-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleDeleteTicket(id: string, title: string) {
    if (!confirm(`Delete ticket "${title}"? This cannot be undone.`)) return
    try {
      if (isSupabaseConfigured) await apiDeleteTicket(id)
      demoDeleteTicket(id)
      showToast('Ticket deleted.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed.', 'error') }
  }

  // ── Settings tab ──
  const [appSettings, setAppSettings]       = useState<AppSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [links, setLinks]                   = useState<AdminExternalLink[]>([])
  const [linksLoading, setLinksLoading]     = useState(false)
  const [showNewLink, setShowNewLink]       = useState(false)
  const [newLabel, setNewLabel]             = useState('')
  const [newEmail, setNewEmail]             = useState('')
  const [newName, setNewName]               = useState('')
  const [newExpiry, setNewExpiry]           = useState('')
  const [creatingLink, setCreatingLink]     = useState(false)
  const [credentials, setCredentials]       = useState<{ email: string; tempPassword: string; portalUrl: string } | null>(null)
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowSettings>(() => getWorkflowSettings())

  const loadSettings = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setSettingsLoading(true)
    try { setAppSettings(await fetchAppSettings()) } catch { /* noop */ } finally { setSettingsLoading(false) }
  }, [])
  const loadLinks = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setLinksLoading(true)
    try { setLinks(await fetchExternalLinks()) } catch { /* noop */ } finally { setLinksLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'settings') { void loadSettings(); void loadLinks() }
  }, [tab, loadSettings, loadLinks])

  async function handleDocValidationToggle(value: boolean) {
    setWorkflowSetting('requireDocumentValidation', value)
    setWorkflowConfig((prev) => ({ ...prev, requireDocumentValidation: value }))
    if (appSettings) {
      try {
        await updateDocValidationSetting(appSettings.id, value)
        setAppSettings({ ...appSettings, requireDocumentValidation: value })
      } catch (err) { showToast(err instanceof Error ? err.message : 'Update failed.', 'error'); return }
    }
    showToast(value ? 'Document validation required.' : 'Document validation optional.', 'success')
  }

  async function handleCreateLink() {
    if (!newLabel.trim() || !newEmail.trim() || !newName.trim()) {
      showToast('Name, email and label are required.', 'error'); return
    }
    setCreatingLink(true)
    try {
      const result = await createExternalAccount({
        email: newEmail.trim(), fullName: newName.trim(),
        label: newLabel.trim(), expiresAt: newExpiry ? new Date(newExpiry).toISOString() : null,
      })
      setCredentials({ email: newEmail.trim(), ...result })
      setShowNewLink(false); setNewLabel(''); setNewEmail(''); setNewName(''); setNewExpiry('')
      showToast('External account created.', 'success')
      void loadLinks()
    } catch (err) { showToast(err instanceof Error ? err.message : 'Failed to create account.', 'error') }
    finally { setCreatingLink(false) }
  }

  async function handleToggleRevoke(link: AdminExternalLink) {
    try {
      await toggleRevokeLink(link.id, link.revoked)
      setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, revoked: !l.revoked } : l))
      showToast(link.revoked ? 'Link reactivated.' : 'Link revoked.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Update failed.', 'error') }
  }

  async function handleDeleteLink(link: AdminExternalLink) {
    if (!confirm(`Delete link "${link.label}"?`)) return
    try {
      await deleteExternalLink(link.id)
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
      showToast('Link deleted.', 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed.', 'error') }
  }

  const TABS = [
    { key: 'users',    label: 'Users & Roles' },
    { key: 'policies', label: 'Policies' },
    { key: 'tickets',  label: 'All Tickets' },
    { key: 'retention', label: 'Retention' },
    { key: 'ai',       label: 'AI Settings' },
    { key: 'audit',    label: 'Audit Access' },
    { key: 'settings', label: 'Settings' },
  ]


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">Manage users, policies, configuration, and compliance settings</p>
        </div>
        <span style={{ fontSize: 11.5, background: 'var(--red-50)', color: 'var(--red-700)', border: '1px solid var(--red-200)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', fontWeight: 500 }}>
          Admin only
        </span>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 12, padding: '0 24px 16px', flexWrap: 'wrap' }}>
        <KPI label="Total users" value={USERS.filter((u) => u.role !== 'external_recipient').length} style={{ flex: '1 1 120px' }} />
        <KPI label="Active policies" value={POLICIES.filter((p) => p.status === 'active').length} style={{ flex: '1 1 120px' }} />
        <KPI label="Total tickets" value={tickets.length} style={{ flex: '1 1 120px' }} />
        <KPI label="AI features" value={Object.values(aiSettings).filter(Boolean).length} style={{ flex: '1 1 120px' }} sub="enabled" />
      </div>

      <div style={{ padding: '0 24px' }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* ── USERS ─────────────────────────── */}
        {tab === 'users' && (
          <div>
            {(Object.entries(
              localUsers.reduce<Record<string, User[]>>((acc, u) => {
                if (!acc[u.role]) acc[u.role] = []
                acc[u.role].push(u)
                return acc
              }, {})
            ) as [Role, User[]][]).map(([role, users]) => (
              <div key={role} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <RoleBadge role={role} size="sm" />
                  <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {users.map((u) => (
                    <div key={u.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar initials={u.initials} color={u.avatarColor} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>{u.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email} · {u.department}</div>
                      </div>
                      <RoleBadge role={u.role} size="sm" />
                      <span className="pill pill-no-dot pill-emerald" style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                        active
                      </span>
                      <button className="btn btn-sm btn-ghost" style={{ flexShrink: 0 }}
                        onClick={() => setEditingUser(u)}>Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>+ Invite user</button>
            </div>
          </div>
        )}

        {/* ── POLICIES ─────────────────────── */}
        {tab === 'policies' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>Policy Library Management</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewPolicy(true)}>+ New policy</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {localPolicies.map((pol) => (
                <div key={pol.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="tag" style={{ flexShrink: 0 }}>{pol.code}</span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>{pol.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      v{pol.version} · {pol.ownerDept} · Effective {formatDate(pol.effectiveDate)}
                    </div>
                  </div>
                  <span className={`pill pill-no-dot ${pol.status === 'active' ? 'pill-emerald' : 'pill-slate'}`} style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>
                    {pol.status}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>
                    {pol.embeddingsBuilt ? '⬡ Searchable' : '⬡ Pending indexing'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingPolicy(pol)}>Edit</button>
                    <button className="btn btn-sm btn-ghost"
                      onClick={() => setLocalPolicies((prev) => prev.map((p) => p.id === pol.id ? { ...p, status: (p.status === 'active' ? 'retired' : 'active') as Policy['status'] } : p))}>
                      {pol.status === 'active' ? 'Retire' : 'Restore'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RETENTION ────────────────────── */}
        {tab === 'retention' && (
          <div>
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--amber-700)' }}>
              ⚠ Retention schedules are governed by PDPL Art.18 and approved by the Data Protection Officer. Changes require legal sign-off.
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12 }}>Data category</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12 }}>Retention period</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12 }}>Legal basis</th>
                  </tr>
                </thead>
                <tbody>
                  {RETENTION_POLICIES.map((rp, i) => (
                    <tr key={rp.category} style={{ borderBottom: i < RETENTION_POLICIES.length - 1 ? '1px solid var(--line)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink-900)' }}>{rp.category}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-700)' }}>{rp.retention}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--ink-500)', fontSize: 12 }}>{rp.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AI SETTINGS ──────────────────── */}
        {tab === 'ai' && (
          <div>
            <div style={{ marginBottom: 14, fontSize: 13.5, color: 'var(--ink-600)' }}>
              Control which AI features are active platform-wide. Disabling a feature hides it from all users.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AI_SETTINGS.map((s) => {
                const on = aiSettings[s.key]
                return (
                  <div key={s.key} className="card" style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{s.description}</div>
                    </div>
                    <button
                      role="switch"
                      aria-checked={on}
                      onClick={() => setAiSettings((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: on ? 'var(--violet-700)' : 'var(--ink-200)',
                        position: 'relative', transition: 'background var(--t-med)', flexShrink: 0,
                      }}
                      aria-label={`Toggle ${s.label}`}
                    >
                      <span style={{
                        position: 'absolute', top: 3, left: on ? 23 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)',
                      }} />
                    </button>
                    <span style={{ fontSize: 12, color: on ? 'var(--violet-700)' : 'var(--ink-400)', width: 52, textAlign: 'right', fontWeight: 500 }}>
                      {on ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--violet-50)', border: '1px solid var(--violet-200)', borderRadius: 'var(--radius)', fontSize: 12.5, color: 'var(--ink-600)' }}>
              AI responses are generated using a multi-model gateway. Grounding sources include PDPL articles and indexed policy documents. Confidence scores &lt; 0.7 trigger fallback disclaimers.
            </div>
          </div>
        )}

        {/* ── AUDIT ACCESS ─────────────────── */}
        {tab === 'audit' && (
          <div>
            <div style={{ marginBottom: 14, fontSize: 13.5, color: 'var(--ink-600)' }}>
              Control which roles can access the full audit ledger and export audit records.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['admin', 'data_management', 'legal', 'security', 'requester'] as Role[]).map((role) => {
                const perm = auditPerms[role] ?? { canView: false, canExport: false }
                return (
                  <div key={role} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <RoleBadge role={role} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{ROLE_LABELS[role]}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
                      <span style={{ color: perm.canView ? 'var(--emerald-700)' : 'var(--ink-300)' }}>
                        {perm.canView ? '✓' : '✕'} View ledger
                      </span>
                      <span style={{ color: perm.canExport ? 'var(--emerald-700)' : 'var(--ink-300)' }}>
                        {perm.canExport ? '✓' : '✕'} Export CSV
                      </span>
                      <span style={{ color: 'var(--emerald-700)' }}>✓ Own-ticket audit</span>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingAuditRole(role)}>Edit</button>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-sm btn-ghost" onClick={exportFullLedger}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1v8M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Export full ledger as CSV
              </button>
            </div>
          </div>
        )}

        {/* ── ALL TICKETS ───────────────────── */}
        {tab === 'tickets' && (
          <div>
            <div style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                className="input" style={{ maxWidth: 320, flex: 1 }}
                placeholder="Search by ID or title…"
                value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}
              />
              <span style={{ fontSize: 12.5, color: 'var(--ink-400)' }}>{filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}</span>
            </div>
            {filteredTickets.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--ink-400)', padding: '24px 0' }}>No tickets found.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--line)' }}>
                      {['ID', 'Title', 'Requester', 'State', 'Created', ''].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-600)', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t, i) => (
                      <tr key={t.id} style={{ borderBottom: i < filteredTickets.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer' }}
                        onClick={() => navigate(`/requests/${t.id}`)}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-500)' }}>{t.id}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink-900)' }}>{t.title}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--ink-600)' }}>{t.requesterId}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="tag" style={{ fontSize: 11 }}>{t.state.replace(/_/g, ' ')}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--ink-400)', fontSize: 12 }}>{formatDate(t.createdAt)}</td>
                        <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }}
                            onClick={() => void handleDeleteTicket(t.id, t.title)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ──────────────────────── */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Submission Policy */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Submission Policy</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 14 }}>
                Control whether requesters must resolve AI document validation before submitting.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 2 }}>
                    Require AI document validation before submission
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                    When enabled, requesters cannot submit if any supporting document is flagged irrelevant or expired.
                  </div>
                  {!isSupabaseConfigured && (
                    <div style={{ fontSize: 11.5, color: 'var(--amber-700)', marginTop: 4, fontStyle: 'italic' }}>
                      Requires Supabase to persist — changes are local only.
                    </div>
                  )}
                </div>
                <button
                  role="switch"
                  aria-checked={workflowConfig.requireDocumentValidation}
                  onClick={() => void handleDocValidationToggle(!workflowConfig.requireDocumentValidation)}
                  disabled={settingsLoading}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none',
                    cursor: 'pointer',
                    background: workflowConfig.requireDocumentValidation ? 'var(--brand-700)' : 'var(--ink-200)',
                    position: 'relative', transition: 'background var(--t-med)', flexShrink: 0, marginLeft: 24,
                    opacity: settingsLoading ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: workflowConfig.requireDocumentValidation ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)',
                  }} />
                </button>
              </div>
            </div>

            {/* Workflow Configuration */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Workflow Configuration</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 14 }}>Enable or disable conditional review steps.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'legalForCrossBorder',  label: 'Legal Review for Cross-Border Transfers', desc: 'Require legal review when sharing outside KSA' },
                  { key: 'securityForSensitive', label: 'Security Review for Sensitive Data',       desc: 'Require security review when sensitive data is detected' },
                  { key: 'autoRouteLowRisk',     label: 'Auto-Route Low Risk Tickets',              desc: 'Skip manual review for AI-flagged low risk submissions' },
                ] .map(({ key, label, desc }) => {
                  const on = workflowConfig[key as keyof typeof workflowConfig]
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{desc}</div>
                      </div>
                      <button
                        role="switch" aria-checked={on}
                        onClick={() => {
                          const next = !on
                          setWorkflowSetting(key as keyof WorkflowSettings, next)
                          setWorkflowConfig((prev) => ({ ...prev, [key]: next }))
                        }}
                        style={{
                          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                          background: on ? 'var(--brand-700)' : 'var(--ink-200)',
                          position: 'relative', transition: 'background var(--t-med)', flexShrink: 0, marginLeft: 24,
                        }}
                      >
                        <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)' }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* External Request Links */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>External Request Links</div>
                {isSupabaseConfigured && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowNewLink((o) => !o)}>
                    {showNewLink ? 'Cancel' : '+ New link'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: showNewLink ? 16 : 0 }}>
                Generate shareable links so external organizations can submit and track requests.
              </div>

              {!isSupabaseConfigured && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--amber-700)' }}>
                  External link management requires Supabase and the <code>create-external-account</code> edge function.
                </div>
              )}

              {showNewLink && isSupabaseConfigured && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: '16px', background: 'var(--surface-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                  <div>
                    <label style={settingLabelStyle}>Full name *</label>
                    <input className="input" placeholder="Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <label style={settingLabelStyle}>Email *</label>
                    <input className="input" type="email" placeholder="jane@partner.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={settingLabelStyle}>Purpose / Label *</label>
                    <input className="input" placeholder="e.g. Q1 vendor onboarding" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                  </div>
                  <div>
                    <label style={settingLabelStyle}>Expires (optional)</label>
                    <input className="input" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button className="btn" onClick={() => setShowNewLink(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => void handleCreateLink()} disabled={creatingLink}>
                      {creatingLink ? 'Creating…' : 'Create account & send invite'}
                    </button>
                  </div>
                </div>
              )}

              {credentials && (
                <div style={{ margin: '12px 0', padding: '14px 16px', background: 'var(--emerald-50)', border: '1px solid var(--emerald-200)', borderRadius: 'var(--radius)', fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--emerald-700)' }}>✓ Invitation sent — share these credentials if email doesn't arrive</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span><strong>Email:</strong> {credentials.email}</span>
                    <span><strong>Temp password:</strong> <code>{credentials.tempPassword}</code></span>
                    <span><strong>Portal URL:</strong> <code>{window.location.origin}{credentials.portalUrl}</code></span>
                  </div>
                  <button className="btn btn-sm btn-ghost" style={{ marginTop: 8 }}
                    onClick={() => {
                      navigator.clipboard.writeText(`Portal: ${window.location.origin}${credentials.portalUrl}\nEmail: ${credentials.email}\nTemp password: ${credentials.tempPassword}`)
                      showToast('Copied to clipboard.', 'success')
                    }}>Copy all</button>
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => setCredentials(null)}>Dismiss</button>
                </div>
              )}

              {isSupabaseConfigured && (
                linksLoading ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>Loading links…</div>
                ) : links.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 12 }}>No external links yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                    {links.map((link) => {
                      const expired = link.expires_at && new Date(link.expires_at) < new Date()
                      const status = link.revoked ? 'Revoked' : expired ? 'Expired' : 'Active'
                      const statusColor = link.revoked || expired ? 'var(--red-600)' : 'var(--emerald-700)'
                      return (
                        <div key={link.id} style={{ padding: '12px 14px', background: 'var(--surface-1)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{link.label}</div>
                              {link.recipient_name && <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{link.recipient_name} · {link.recipient_email}</div>}
                              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-400)', marginTop: 4 }}>{window.location.origin}/external/{link.token}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                              {link.status === 'approved' ? 'Approved' : link.status === 'deleted' ? 'Deleted' : status}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>
                              Created {formatDateTime(link.created_at)}
                              {link.expires_at && <> · Expires {formatDate(link.expires_at)}</>}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm"
                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/external/redeem/${link.token}`); showToast('Link copied.', 'success') }}>
                                Copy link
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => void handleToggleRevoke(link)}>
                                {link.revoked ? 'Reactivate' : 'Revoke'}
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-600)' }} onClick={() => void handleDeleteLink(link)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit user dialog ── */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(updated) => {
            setLocalUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
            setEditingUser(null)
            showToast('User updated.', 'success')
          }}
        />
      )}

      {/* ── Invite user dialog ── */}
      {showInvite && (
        <InviteUserDialog
          onClose={() => setShowInvite(false)}
          onInvited={(u) => {
            setLocalUsers((prev) => [...prev, u])
            setShowInvite(false)
            showToast('User invited.', 'success')
          }}
        />
      )}

      {/* ── New policy dialog ── */}
      {showNewPolicy && (
        <NewPolicyDialog
          onClose={() => setShowNewPolicy(false)}
          onCreated={(pol) => {
            setLocalPolicies((prev) => [...prev, pol])
            setShowNewPolicy(false)
            showToast('Policy created.', 'success')
          }}
        />
      )}

      {/* ── Edit policy dialog ── */}
      {editingPolicy && (
        <EditPolicyDialog
          policy={editingPolicy}
          onClose={() => setEditingPolicy(null)}
          onSave={(updated) => {
            setLocalPolicies((prev) => prev.map((p) => p.id === updated.id ? updated : p))
            setEditingPolicy(null)
            showToast('Policy updated.', 'success')
          }}
        />
      )}

      {/* ── Edit audit access dialog ── */}
      {editingAuditRole && (
        <EditAuditAccessDialog
          roleLabel={ROLE_LABELS[editingAuditRole as Role] ?? editingAuditRole}
          perm={auditPerms[editingAuditRole] ?? { canView: false, canExport: false }}
          onClose={() => setEditingAuditRole(null)}
          onSave={(perm) => {
            setAuditPerms((prev) => ({ ...prev, [editingAuditRole]: perm }))
            setEditingAuditRole(null)
            showToast('Audit access updated.', 'success')
          }}
        />
      )}
    </div>
  )
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

const ROLES_SELECTABLE: Role[] = ['requester', 'data_management', 'legal', 'security', 'admin']
const ROLE_LABELS_FULL: Record<Role, string> = {
  requester: 'Requester', data_management: 'Data Management', legal: 'Legal',
  security: 'Security', admin: 'Admin', external_recipient: 'External Recipient',
}

const dlgInputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-0)', color: 'var(--ink-900)',
  outline: 'none', boxSizing: 'border-box',
}
const dlgLabelSt: React.CSSProperties = {
  display: 'block', fontSize: 11.5, fontWeight: 600,
  color: 'var(--ink-600)', marginBottom: 4, letterSpacing: '0.02em',
}

function EditUserDialog({ user, onClose, onSave }: {
  user: User; onClose: () => void; onSave: (u: User) => void
}) {
  const [role, setRole] = useState<Role>(user.role)
  const [department, setDepartment] = useState(user.department)
  const [jobTitle, setJobTitle] = useState(user.jobTitle)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 440, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Edit user</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 20 }}>{user.fullName} · {user.email}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={dlgLabelSt}>ROLE</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={dlgInputSt}>
              {ROLES_SELECTABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS_FULL[r]}</option>)}
            </select>
          </div>
          <div>
            <label style={dlgLabelSt}>DEPARTMENT</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={dlgLabelSt}>JOB TITLE</label>
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          {!isSupabaseConfigured && (
            <p style={{ fontSize: 11.5, color: 'var(--amber-700)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
              Demo mode — changes apply this session only.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ ...user, role, department, jobTitle })}>Save changes</button>
        </div>
      </div>
    </div>
  )
}

function InviteUserDialog({ onClose, onInvited }: {
  onClose: () => void; onInvited: (u: User) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('requester')
  const [department, setDepartment] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) { setError('Full name and email are required.'); return }
    const initials = fullName.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    const colors = ['#0B5FFF', '#5B21B6', '#047857', '#B45309', '#0E7490', '#9333EA']
    const newUser: User = {
      id: `u-new-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      department: department.trim() || 'Unknown',
      jobTitle: jobTitle.trim() || 'Unknown',
      initials,
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    }
    onInvited(newUser)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 460, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>Invite user</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>FULL NAME *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Layla Al-Harbi" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>WORK EMAIL *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="layla@company.com" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={dlgLabelSt}>ROLE</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={dlgInputSt}>
                {ROLES_SELECTABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS_FULL[r]}</option>)}
              </select>
            </div>
            <div>
              <label style={dlgLabelSt}>DEPARTMENT</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Legal" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>JOB TITLE</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Privacy Analyst" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
          </div>
          {!isSupabaseConfigured && (
            <p style={{ fontSize: 11.5, color: 'var(--amber-700)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
              Demo mode — user will be added to the local list this session only. In production, an invitation email would be sent via Supabase.
            </p>
          )}
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Send invitation</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewPolicyDialog({ onClose, onCreated }: {
  onClose: () => void; onCreated: (p: Policy) => void
}) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Policy['category']>('internal')
  const [version, setVersion] = useState('1.0')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [ownerDept, setOwnerDept] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !title.trim()) { setError('Policy code and title are required.'); return }
    const newPolicy: Policy = {
      id: `pol-new-${Date.now()}`,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      category,
      version: version.trim() || '1.0',
      effectiveDate,
      ownerDept: ownerDept.trim() || 'Privacy Office',
      status: 'active',
      summary: summary.trim(),
      body: summary.trim(),
      embeddingsBuilt: false,
      citationCount: 0,
    }
    onCreated(newPolicy)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 520, padding: '28px 32px', zIndex: 1, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>New policy</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={dlgLabelSt}>POLICY CODE *</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. POL-AI-008" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={dlgLabelSt}>VERSION</label>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>TITLE *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Breach Response Policy" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div>
              <label style={dlgLabelSt}>CATEGORY</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as Policy['category'])} style={dlgInputSt}>
                <option value="internal">Internal</option>
                <option value="pdpl">PDPL</option>
                <option value="sama">SAMA</option>
                <option value="cma">CMA</option>
                <option value="iso27001">ISO 27001</option>
              </select>
            </div>
            <div>
              <label style={dlgLabelSt}>OWNER DEPARTMENT</label>
              <input value={ownerDept} onChange={(e) => setOwnerDept(e.target.value)} placeholder="e.g. Privacy Office" style={dlgInputSt}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>EFFECTIVE DATE</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={dlgInputSt} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={dlgLabelSt}>SUMMARY</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                placeholder="Brief description of the policy scope and key requirements…"
                style={{ ...dlgInputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
            </div>
          </div>
          {!isSupabaseConfigured && (
            <p style={{ fontSize: 11.5, color: 'var(--amber-700)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
              Demo mode — policy will be added locally this session only.
            </p>
          )}
          {error && <div style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create policy</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditPolicyDialog({ policy, onClose, onSave }: {
  policy: Policy; onClose: () => void; onSave: (p: Policy) => void
}) {
  const [title, setTitle] = useState(policy.title)
  const [code, setCode] = useState(policy.code)
  const [version, setVersion] = useState(policy.version)
  const [category, setCategory] = useState<Policy['category']>(policy.category)
  const [ownerDept, setOwnerDept] = useState(policy.ownerDept)
  const [effectiveDate, setEffectiveDate] = useState(policy.effectiveDate.slice(0, 10))
  const [summary, setSummary] = useState(policy.summary ?? '')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 520, padding: '28px 32px', zIndex: 1, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 20 }}>Edit policy</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={dlgLabelSt}>POLICY CODE</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={dlgLabelSt}>VERSION</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={dlgLabelSt}>TITLE</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div>
            <label style={dlgLabelSt}>CATEGORY</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Policy['category'])} style={dlgInputSt}>
              <option value="internal">Internal</option>
              <option value="pdpl">PDPL</option>
              <option value="sama">SAMA</option>
              <option value="cma">CMA</option>
              <option value="iso27001">ISO 27001</option>
            </select>
          </div>
          <div>
            <label style={dlgLabelSt}>OWNER DEPARTMENT</label>
            <input value={ownerDept} onChange={(e) => setOwnerDept(e.target.value)} style={dlgInputSt}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={dlgLabelSt}>EFFECTIVE DATE</label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={dlgInputSt} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={dlgLabelSt}>SUMMARY</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
              style={{ ...dlgInputSt, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-700)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }} />
          </div>
        </div>
        {!isSupabaseConfigured && (
          <p style={{ fontSize: 11.5, color: 'var(--amber-700)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginTop: 12 }}>
            Demo mode — changes apply this session only.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({
            ...policy, code: code.trim().toUpperCase(), title: title.trim(),
            category, version: version.trim(), ownerDept: ownerDept.trim(),
            effectiveDate, summary: summary.trim(), body: summary.trim(),
          })}>Save changes</button>
        </div>
      </div>
    </div>
  )
}

function EditAuditAccessDialog({ roleLabel, perm, onClose, onSave }: {
  roleLabel: string; perm: AuditPerm
  onClose: () => void; onSave: (p: AuditPerm) => void
}) {
  const [canView, setCanView] = useState(perm.canView)
  const [canExport, setCanExport] = useState(perm.canExport)

  const toggleSt = (on: boolean): React.CSSProperties => ({
    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
    background: on ? 'var(--brand-700)' : 'var(--ink-200)',
    position: 'relative', transition: 'background var(--t-med)', flexShrink: 0,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 400, padding: '28px 32px', zIndex: 1 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Edit audit access</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 20 }}>{roleLabel}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'View full audit ledger', desc: 'Can browse all events in /audit', value: canView, set: setCanView },
            { label: 'Export ledger as CSV', desc: 'Can download audit records to CSV', value: canExport, set: setCanExport },
          ].map(({ label, desc, value, set }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-1)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-900)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{desc}</div>
              </div>
              <button role="switch" aria-checked={value} onClick={() => set(!value)} style={toggleSt(value)}>
                <span style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left var(--t-med)', boxShadow: 'var(--shadow-sm)' }} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', fontSize: 11.5, color: 'var(--amber-700)' }}>
          Demo mode — changes apply this session only. In production these would persist to your access-control store.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ canView, canExport })}>Save</button>
        </div>
      </div>
    </div>
  )
}

const settingLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 500,
  color: 'var(--ink-700)', marginBottom: 4,
}
