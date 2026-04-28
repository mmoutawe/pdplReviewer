export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    ...opts,
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return formatDate(iso)
}

export function slaStatus(dueAt: string, breached: boolean): {
  label: string; color: 'emerald' | 'amber' | 'red'; hoursLeft: number
} {
  if (breached) return { label: 'Breached', color: 'red', hoursLeft: 0 }
  const diff = new Date(dueAt).getTime() - Date.now()
  const h = Math.round(diff / 3600000)
  if (h < 0) return { label: 'Breached', color: 'red', hoursLeft: 0 }
  if (h < 12) return { label: `${h}h left`, color: 'red', hoursLeft: h }
  if (h < 36) return { label: `${h}h left`, color: 'amber', hoursLeft: h }
  return { label: `${h}h left`, color: 'emerald', hoursLeft: h }
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function riskColor(tier: string): 'emerald' | 'amber' | 'red' | 'slate' {
  if (tier === 'low') return 'emerald'
  if (tier === 'medium') return 'amber'
  if (tier === 'high' || tier === 'critical') return 'red'
  return 'slate'
}

export function severityColor(s: string): 'emerald' | 'amber' | 'red' | 'slate' | 'violet' {
  if (s === 'info') return 'slate'
  if (s === 'low') return 'emerald'
  if (s === 'medium') return 'amber'
  if (s === 'high' || s === 'critical') return 'red'
  return 'slate'
}

export function stateColor(state: string): 'slate' | 'blue' | 'amber' | 'red' | 'emerald' | 'violet' {
  const map: Record<string, 'slate' | 'blue' | 'amber' | 'red' | 'emerald' | 'violet'> = {
    draft: 'slate',
    submitted: 'blue',
    in_data_management: 'blue',
    returned_to_requester: 'amber',
    in_legal_review: 'violet',
    in_security_review: 'violet',
    final_decision: 'blue',
    approved: 'emerald',
    rejected: 'red',
    archived: 'slate',
  }
  return map[state] ?? 'slate'
}

export function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
