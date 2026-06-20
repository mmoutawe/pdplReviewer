import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStore, ticketStore, showToast, demoDeleteTicket } from '../store'
import { useStore } from '../hooks/useStore'
import { REQUEST_TYPE_LABELS, STATE_LABELS } from '../data/seed'
import { StatusPill, SLAIndicator } from '../components/primitives'
import { EnterpriseTable, FilterBar, type Column } from '../components/table'
import { ConfirmDialog } from '../components/overlays'
import type { Ticket } from '../data/types'
import { formatDate } from '../lib/utils'
import { isDataverseConfigured as isSupabaseConfigured } from '../lib/dataverse'
import { deleteTicket as apiDeleteTicket } from '../api/tickets'

export default function RequestList() {
  useEffect(() => { document.title = 'Requests — PDPL Reviewer' }, [])
  const { user } = useStore(authStore)
  const { tickets } = useStore(ticketStore)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

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

  const visibleIds = visible.map((t) => t.id)
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someChecked = visibleIds.some((id) => selected.has(id))
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    if (allChecked) {
      setSelected((prev) => { const next = new Set(prev); visibleIds.forEach((id) => next.delete(id)); return next })
    } else {
      setSelected((prev) => new Set([...prev, ...visibleIds]))
    }
  }

  function toggleOne(e: React.ChangeEvent<HTMLInputElement>, id: string) {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function executeDeleteSelected() {
    setConfirmOpen(false)
    const toDelete = visible.filter((t) => selected.has(t.id))
    try {
      for (const t of toDelete) {
        if (isSupabaseConfigured) await apiDeleteTicket(t.id)
        demoDeleteTicket(t.id)
      }
      setSelected(new Set())
      showToast(`Deleted ${toDelete.length} ticket${toDelete.length !== 1 ? 's' : ''}.`, 'success')
    } catch (err) { showToast(err instanceof Error ? err.message : 'Delete failed.', 'error') }
  }

  const isAdmin = user.role === 'admin'

  const checkboxHeader = isAdmin ? (
    <input
      type="checkbox"
      checked={allChecked}
      ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
      onChange={toggleAll}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--brand-700)' }}
      aria-label="Select all"
    />
  ) : ''

  const columns: Column<Ticket>[] = [
    ...(isAdmin ? [{
      key: 'select', label: checkboxHeader, width: 44,
      render: (t: Ticket) => (
        <input
          type="checkbox"
          checked={selected.has(t.id)}
          onChange={(e) => toggleOne(e, t.id)}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--brand-700)' }}
          aria-label={`Select ${t.title}`}
        />
      ),
    }] : []),
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
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${selectedCount} ticket${selectedCount !== 1 ? 's' : ''}?`}
        body={`This will permanently delete ${selectedCount} selected ticket${selectedCount !== 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel={`Delete ${selectedCount}`}
        danger
        onConfirm={() => void executeDeleteSelected()}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.role === 'requester' ? 'My Requests' : 'All Requests'}</h1>
          <p className="page-subtitle">{visible.length} record{visible.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && someChecked && (
            <span style={{ fontSize: 13, color: 'var(--ink-500)', marginRight: 4 }}>
              {selectedCount} selected
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={exportCSV} title="Export filtered results to CSV">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1v8M3.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Export CSV
          </button>
          {isAdmin && someChecked && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmOpen(true)}>
              Delete selected ({selectedCount})
            </button>
          )}
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
