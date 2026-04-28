import { useEffect, useState } from 'react'
import { USERS, POLICIES } from '../data/seed'
import { Avatar, RoleBadge, KPI } from '../components/primitives'
import { Tabs } from '../components/overlays'
import { formatDate } from '../lib/utils'
import type { Role } from '../data/types'

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
  const [tab, setTab] = useState(initialTab && initialTab !== 'home' ? initialTab : 'users')
  const [aiSettings, setAiSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(AI_SETTINGS.map((s) => [s.key, s.enabled]))
  )

  const TABS = [
    { key: 'users', label: 'Users & Roles' },
    { key: 'policies', label: 'Policies' },
    { key: 'retention', label: 'Retention' },
    { key: 'ai', label: 'AI Settings' },
    { key: 'audit', label: 'Audit Access' },
  ]

  const roleGroups = USERS.reduce<Record<string, typeof USERS>>((acc, u) => {
    if (!acc[u.role]) acc[u.role] = []
    acc[u.role].push(u)
    return acc
  }, {})

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
        <KPI label="AI features" value={Object.values(aiSettings).filter(Boolean).length} style={{ flex: '1 1 120px' }} sub="enabled" />
        <KPI label="Retention tiers" value={RETENTION_POLICIES.length} style={{ flex: '1 1 120px' }} />
      </div>

      <div style={{ padding: '0 24px' }}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* ── USERS ─────────────────────────── */}
        {tab === 'users' && (
          <div>
            {(Object.entries(roleGroups) as [Role, typeof USERS][]).map(([role, users]) => (
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
                      <button className="btn btn-sm btn-ghost" style={{ flexShrink: 0 }}>Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
              <button className="btn btn-primary btn-sm">+ Invite user</button>
            </div>
          </div>
        )}

        {/* ── POLICIES ─────────────────────── */}
        {tab === 'policies' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>Policy Library Management</span>
              <button className="btn btn-primary btn-sm">+ New policy</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {POLICIES.map((pol) => (
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
                    <button className="btn btn-sm btn-ghost">Edit</button>
                    <button className="btn btn-sm btn-ghost">Archive</button>
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
                const canView = ['admin', 'data_management'].includes(role)
                const canExport = role === 'admin'
                return (
                  <div key={role} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <RoleBadge role={role} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-900)' }}>{ROLE_LABELS[role]}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12.5 }}>
                      <span style={{ color: canView ? 'var(--emerald-700)' : 'var(--ink-300)' }}>
                        {canView ? '✓' : '✕'} View ledger
                      </span>
                      <span style={{ color: canExport ? 'var(--emerald-700)' : 'var(--ink-300)' }}>
                        {canExport ? '✓' : '✕'} Export CSV
                      </span>
                      <span style={{ color: 'var(--emerald-700)' }}>
                        ✓ Own-ticket audit
                      </span>
                    </div>
                    <button className="btn btn-sm btn-ghost">Edit</button>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-sm btn-ghost">Export full ledger as CSV</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
