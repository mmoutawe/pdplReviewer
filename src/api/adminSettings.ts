import { supabase } from '../lib/supabase'
import type { AdminExternalLink } from '../data/types'

export interface AppSettings { id: string; requireDocumentValidation: boolean }

export async function fetchAppSettings(): Promise<AppSettings | null> {
  if (!supabase) return null
  const { data, error } = await (supabase as any)
    .from('app_settings')
    .select('id, require_document_validation')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return { id: data.id, requireDocumentValidation: data.require_document_validation }
}

export async function updateDocValidationSetting(settingsId: string, value: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await (supabase as any)
    .from('app_settings')
    .update({ require_document_validation: value, updated_by: user?.id ?? null })
    .eq('id', settingsId)
  if (error) throw error
}

export async function fetchExternalLinks(): Promise<AdminExternalLink[]> {
  if (!supabase) return []
  const { data, error } = await (supabase as any)
    .from('external_request_links')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminExternalLink[]
}

export async function createExternalAccount(params: {
  email: string; fullName: string; label: string; expiresAt: string | null
}): Promise<{ tempPassword: string; portalUrl: string }> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('create-external-account', { body: params })
  if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message ?? 'Failed')
  return data as { tempPassword: string; portalUrl: string }
}

export async function toggleRevokeLink(id: string, currentRevoked: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await (supabase as any)
    .from('external_request_links')
    .update({ revoked: !currentRevoked })
    .eq('id', id)
  if (error) throw error
}

export async function deleteExternalLink(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await (supabase as any).from('external_request_links').delete().eq('id', id)
  if (error) throw error
}
