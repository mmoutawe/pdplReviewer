import { dvList, dvGet, T, toPolicy, toVendor, toProject, toAuditEvent } from '../lib/dataverse'
import type { Policy, Vendor, Project, AuditEvent } from '../data/types'

type DvRow = Record<string, unknown>

// ── Policies ──────────────────────────────────────────────

export async function fetchPolicies(): Promise<Policy[]> {
  const rows = await dvList<DvRow>(T.policies, '$orderby=pdplr_code asc')
  return rows.map(toPolicy)
}

export async function fetchPolicyById(id: string): Promise<Policy | null> {
  const row = await dvGet<DvRow>(T.policies, id)
  return row ? toPolicy(row) : null
}

// ── Vendors ───────────────────────────────────────────────

export async function fetchVendors(): Promise<Vendor[]> {
  const rows = await dvList<DvRow>(T.vendors, '$orderby=pdplr_tradename asc')
  return rows.map(toVendor)
}

export async function fetchVendorById(id: string): Promise<Vendor | null> {
  const row = await dvGet<DvRow>(T.vendors, id)
  return row ? toVendor(row) : null
}

// ── Projects ──────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const rows = await dvList<DvRow>(T.projects, '$orderby=pdplr_name asc')
  return rows.map(toProject)
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  const row = await dvGet<DvRow>(T.projects, id)
  return row ? toProject(row) : null
}

// ── Audit ─────────────────────────────────────────────────

export async function fetchAuditEvents(filters?: {
  targetId?: string
  actorId?: string
  action?: string
  limit?: number
}): Promise<AuditEvent[]> {
  const parts: string[] = []
  if (filters?.targetId) parts.push(`pdplr_targetid eq '${filters.targetId}'`)
  if (filters?.actorId)  parts.push(`pdplr_actorid eq '${filters.actorId}'`)
  if (filters?.action)   parts.push(`pdplr_action eq '${filters.action}'`)

  const filter = parts.length ? `&$filter=${parts.join(' and ')}` : ''
  const top    = `&$top=${filters?.limit ?? 500}`

  const rows = await dvList<DvRow>(T.auditEvents, `$orderby=pdplr_ts desc${filter}${top}`)
  return rows.map(toAuditEvent)
}
