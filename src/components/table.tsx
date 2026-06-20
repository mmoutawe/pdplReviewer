import { type ReactNode, useState } from 'react'

// ─── EnterpriseTable ──────────────────────────────────────────────────────────
export interface Column<T> {
  key: string
  label: ReactNode
  width?: number | string
  numeric?: boolean
  sortable?: boolean
  render: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  sticky?: boolean
}

export function EnterpriseTable<T>({
  columns, rows, rowKey, onRowClick, loading = false, sticky: _sticky = true,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl" aria-busy={loading}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}
                className={col.numeric ? 'numeric' : undefined}
                style={{ width: col.width, cursor: col.sortable ? 'pointer' : undefined }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {col.sortable && (
                    <span aria-hidden="true" style={{ opacity: sortKey === col.key ? 1 : 0.3, fontSize: 10 }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-400)', fontSize: 13 }}>
                No records found
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)}
              className={onRowClick ? 'row-link' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row) } : undefined}>
              {columns.map((col) => (
                <td key={col.key} className={col.numeric ? 'numeric' : undefined}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────
interface FilterOption { value: string; label: string }
interface FilterBarProps {
  search: string; onSearch: (v: string) => void; placeholder?: string
  filters?: { key: string; label: string; options: FilterOption[]; value: string; onChange: (v: string) => void }[]
  actions?: ReactNode
}

export function FilterBar({ search, onSearch, placeholder = 'Search…', filters, actions }: FilterBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderBottom: '1px solid var(--line)',
      background: 'var(--surface-0)', flexWrap: 'wrap',
    }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }}
          aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          className="input"
          value={search} onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          style={{ paddingLeft: 32, height: 32, fontSize: 13 }}
          aria-label={placeholder}
        />
      </div>
      {filters?.map((f) => (
        <select key={f.key} className="select" value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          style={{ height: 32, fontSize: 13, width: 'auto', flex: '0 0 auto' }}
          aria-label={f.label}>
          <option value="">{f.label}: All</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
