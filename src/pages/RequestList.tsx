import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, ticketStore } from '../store'
import { useStore } from '../hooks/useStore'
import { REQUEST_TYPE_LABELS, STATE_LABELS } from '../data/seed'
import { StatusPill, SLAIndicator } from '../components/primitives'
import { EnterpriseTable, FilterBar, type Column } from '../components/table'
import type { Ticket } from '../data/types'
import { formatDate } from '../lib/utils'

export default function RequestList() {
  useEffect(() => { document.title = 'Requests — PDPL Reviewer' }, [])
  const { user } = useStore(authStore)
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterType, setFilterType] = useState('')

  const visible = tickets.filter((t) => {
    if (user.role === 'requester' && t.requesterId !== user.id) return false
    if (filterState && t.state !== filterState) return false
    if (filterType && t.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    }
    return true
  })

  const columns: Column<Ticket>[] = [
    {
      key: 'id', label: 'ID', width: 160, sortable: true,
      render: (t) => <span className="mono" style={{ fontSize: 12, color: 'var(--ink-500)' }}>{t.id}</span>,
    },
    {
      key: 'title', label: 'Title', sortable: true,
      render: (t) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--ink-800)', fontSize: 13.5 }}>{t.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 2 }}>{REQUEST_TYPE_LABELS[t.type]}</div>
        </div>
      ),
    },
    {
      key: 'state', label: 'Status', width: 180,
      render: (t) => <StatusPill state={t.state} />,
    },
    {
      key: 'sla', label: 'SLA', width: 120,
      render: (t) => !['draft', 'approved', 'rejected', 'archived'].includes(t.state)
        ? <SLAIndicator dueAt={t.sla.decisionDueAt} breached={t.sla.breached} />
        : <span style={{ color: 'var(--ink-300)', fontSize: 12 }}>—</span>,
    },
    {
      key: 'date', label: 'Submitted', width: 120, sortable: true,
      render: (t) => (
        <span style={{ fontSize: 12.5, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
          {t.submittedAt ? formatDate(t.submittedAt) : <span style={{ color: 'var(--ink-300)' }}>Draft</span>}
        </span>
      ),
    },
  ]

  const stateOptions = Object.entries(STATE_LABELS).map(([v, l]) => ({ value: v, label: l }))
  const typeOptions = Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

  function exportCSV() {
    const header = ['ID', 'Title', 'Type', 'Status', 'Submitted', 'SLA due', 'Breached', 'Subjects', 'Contains PII', 'Cross-border']
    const rows = visible.map((t) => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      REQUEST_TYPE_LABELS[t.type],
      STATE_LABELS[t.state] ?? t.state,
      t.submittedAt ? t.submittedAt.slice(0, 10) : '',
      t.sla.decisionDueAt.slice(0, 10),
      t.sla.breached ? 'Yes' : 'No',
      t.dataDeclaration.estimatedSubjectCount,
      t.dataDeclaration.containsPII ? 'Yes' : 'No',
      t.dataDeclaration.crossBorderInvolved ? 'Yes' : 'No',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `requests-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.role === 'requester' ? 'My Requests' : 'All Requests'}</h1>
          <p className="page-subtitle">{visible.length} record{visible.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Export filtered results to CSV">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v8M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Export CSV
          </button>
          {user.role === 'requester' && (
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/requests/new')}>
              New request
            </button>
          )}
        </div>
      </div>
      <FilterBar
        search={search} onSearch={setSearch} placeholder="Search by ID, title, description…"
        filters={[
          { key: 'state', label: 'Status', options: stateOptions, value: filterState, onChange: setFilterState },
          { key: 'type', label: 'Type', options: typeOptions, value: filterType, onChange: setFilterType },
        ]}
      />
      <div style={{ overflowX: 'auto' }}>
        <EnterpriseTable
          columns={columns}
          rows={visible}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate(`/requests/${t.id}`)}
        />
      </div>
    </div>
  )
}
