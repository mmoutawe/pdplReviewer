import { supabase, toPolicy, toVendor, toProject, toAuditEvent } from '../lib/supabase'
import type { Policy, Vendor, Project, AuditEvent } from '../data/types'

// ── Policies ──────────────────────────────────────────────

export async function fetchPolicies(): Promise<Policy[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('policies').select('*').order('code')
  if (error) throw error
  return (data ?? []).map(toPolicy)
}

export async function fetchPolicyById(id: string): Promise<Policy | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data } = await supabase.from('policies').select('*').eq('id', id).single()
  return data ? toPolicy(data) : null
}

// ── Vendors ───────────────────────────────────────────────

export async function fetchVendors(): Promise<Vendor[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('vendors').select('*').order('trade_name')
  if (error) throw error
  return (data ?? []).map(toVendor)
}

export async function fetchVendorById(id: string): Promise<Vendor | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data } = await supabase.from('vendors').select('*').eq('id', id).single()
  return data ? toVendor(data) : null
}

// ── Projects ──────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('projects').select('*').order('name')
  if (error) throw error
  return (data ?? []).map(toProject)
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data } = await supabase.from('projects').select('*').eq('id', id).single()
  return data ? toProject(data) : null
}

// ── Audit ─────────────────────────────────────────────────

export async function fetchAuditEvents(filters?: {
  targetId?: string
  actorId?: string
  action?: string
  limit?: number
}): Promise<AuditEvent[]> {
  if (!supabase) throw new Error('Supabase not configured')

  let q = supabase.from('audit_events').select('*')

  if (filters?.targetId) q = q.eq('target_id', filters.targetId)
  if (filters?.actorId)  q = q.eq('actor_id', filters.actorId)
  if (filters?.action)   q = q.eq('action', filters.action)

  const { data, error } = await q
    .order('ts', { ascending: false })
    .limit(filters?.limit ?? 500)

  if (error) throw error
  return (data ?? []).map(toAuditEvent)
}
