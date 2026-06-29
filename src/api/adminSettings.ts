import { apiGet, apiPatch, apiPost, apiDelete } from '../lib/api'
import type { AdminExternalLink } from '../data/types'
import type { WorkflowSettings } from '../lib/workflowSettings'

export interface AppSettings {
  id: string
  requireDocumentValidation: boolean
  workflowConfig: WorkflowSettings | null
}

export async function fetchAppSettings(): Promise<AppSettings | null> {
  return apiGet<AppSettings>('/settings').catch(() => null)
}

export async function updateDocValidationSetting(_settingsId: string, value: boolean): Promise<void> {
  const current = await fetchAppSettings()
  const wc = current?.workflowConfig ?? {}
  await apiPatch('/settings', { workflowConfig: { ...wc, requireDocumentValidation: value } })
}

export async function updateWorkflowConfig(_settingsId: string, config: WorkflowSettings): Promise<void> {
  await apiPatch('/settings', { workflowConfig: config })
}

export async function fetchExternalLinks(): Promise<AdminExternalLink[]> {
  return apiGet<AdminExternalLink[]>('/links').catch(() => [])
}

export async function createExternalAccount(params: {
  email: string
  fullName: string
  label: string
  expiresAt: string | null
}): Promise<{ tempPassword: string; portalUrl: string }> {
  return apiPost<{ tempPassword: string; portalUrl: string }>('/admin/create-account', params)
}

export async function toggleRevokeLink(id: string, _currentRevoked: boolean): Promise<void> {
  await apiPatch(`/links/${id}/revoke`, {})
}

export async function deleteExternalLink(id: string): Promise<void> {
  await apiDelete(`/links/${id}`)
}
