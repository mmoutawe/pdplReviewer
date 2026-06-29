import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'
import type { Policy, Vendor, Project, AuditEvent } from '../data/types'

// ── Policies ──────────────────────────────────────────────────────────────────

export async function fetchPolicies(): Promise<Policy[]> {
  return apiGet<Policy[]>('/policies')
}

export async function fetchPolicyById(id: string): Promise<Policy | null> {
  try { return await apiGet<Policy>(`/policies/${id}`) }
  catch { return null }
}

export async function createPolicy(p: Omit<Policy, 'id' | 'embeddingsBuilt' | 'citationCount'>): Promise<Policy> {
  return apiPost<Policy>('/policies', p)
}

export async function updatePolicy(id: string, p: Partial<Policy>): Promise<Policy> {
  return apiPatch<Policy>(`/policies/${id}`, p)
}

export async function deletePolicy(id: string): Promise<void> {
  await apiDelete(`/policies/${id}`)
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export async function fetchVendors(): Promise<Vendor[]> {
  return apiGet<Vendor[]>('/vendors')
}

export async function fetchVendorById(id: string): Promise<Vendor | null> {
  try { return await apiGet<Vendor>(`/vendors/${id}`) }
  catch { return null }
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  return apiGet<Project[]>('/projects')
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  try { return await apiGet<Project>(`/projects/${id}`) }
  catch { return null }
}

// ── Audit Events ──────────────────────────────────────────────────────────────

export async function fetchAuditEvents(filters?: {
  targetId?: string
  actorId?: string
  action?: string
  limit?: number
}): Promise<AuditEvent[]> {
  const params = new URLSearchParams()
  if (filters?.targetId) params.set('targetId', filters.targetId)
  if (filters?.actorId)  params.set('actorId',  filters.actorId)
  if (filters?.action)   params.set('action',   filters.action)
  if (filters?.limit)    params.set('limit',    String(filters.limit))
  const qs = params.toString()
  return apiGet<AuditEvent[]>(`/audit-events${qs ? `?${qs}` : ''}`)
}
