import { dvList, dvUpdate, dvDelete, T } from '../lib/dataverse'
import { getDataverseToken } from './auth'
import type { AdminExternalLink } from '../data/types'
import type { WorkflowSettings } from '../lib/workflowSettings'
import { config } from '../lib/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _legacyEnv = (import.meta as any).env as Record<string, string | undefined>

type DvRow = Record<string, unknown>

export interface AppSettings {
  id: string
  requireDocumentValidation: boolean
  workflowConfig: WorkflowSettings | null
}

const WORKFLOW_DEFAULTS: WorkflowSettings = {
  requireDocumentValidation: true,
  legalForCrossBorder: true,
  securityForSensitive: true,
  autoRouteLowRisk: false,
  checklistItems: [
    'Purpose is clearly stated',
    'Data is necessary for purpose',
    'No excessive personal data',
    'Recipient is appropriate',
    'Attachments reviewed',
  ],
  riskThreshold: 3,
  confidenceThreshold: 95,
}

function toAppSettings(r: DvRow): AppSettings {
  let workflowConfig: WorkflowSettings | null = null
  try {
    const raw = r['pdplr_workflowconfig'] as string | null
    if (raw) workflowConfig = { ...WORKFLOW_DEFAULTS, ...JSON.parse(raw) }
  } catch { /* use null */ }
  return {
    id: r['pdplr_appsettingsid'] as string,
    requireDocumentValidation: !!(r['pdplr_requiredocumentvalidation']),
    workflowConfig,
  }
}

function toAdminExternalLink(r: DvRow): AdminExternalLink {
  return {
    id:              r['pdplr_externallinkid'] as string,
    token:           r['pdplr_token'] as string,
    label:           r['pdplr_label'] as string,
    created_at:      r['createdon'] as string,
    expires_at:      (r['pdplr_expiresat'] as string) ?? null,
    revoked:         !!(r['pdplr_revoked']),
    recipient_email: (r['pdplr_recipientemail'] as string) ?? null,
    recipient_name:  (r['pdplr_recipientname'] as string) ?? null,
    status:          r['pdplr_status'] as string,
    approved_at:     (r['pdplr_approvedat'] as string) ?? null,
  }
}

export async function fetchAppSettings(): Promise<AppSettings | null> {
  const rows = await dvList<DvRow>(T.appSettings, '$top=1').catch(() => [])
  return rows.length ? toAppSettings(rows[0]) : null
}

export async function updateDocValidationSetting(settingsId: string, value: boolean): Promise<void> {
  await dvUpdate(T.appSettings, settingsId, { pdplr_requiredocumentvalidation: value })
}

export async function updateWorkflowConfig(settingsId: string, config: WorkflowSettings): Promise<void> {
  await dvUpdate(T.appSettings, settingsId, { pdplr_workflowconfig: JSON.stringify(config) })
}

export async function fetchExternalLinks(): Promise<AdminExternalLink[]> {
  const rows = await dvList<DvRow>(T.externalLinks, '$orderby=createdon desc').catch(() => [])
  return rows.map(toAdminExternalLink)
}

/**
 * Calls a Power Automate HTTP-triggered cloud flow to create a new external account.
 * Set VITE_PA_CREATE_ACCOUNT_URL to your flow's HTTP trigger URL.
 */
export async function createExternalAccount(params: {
  email: string
  fullName: string
  label: string
  expiresAt: string | null
}): Promise<{ tempPassword: string; portalUrl: string }> {
  const afBase = config.afBaseUrl?.replace(/\/$/, '')
  const url = afBase ? `${afBase}/createAccount` : _legacyEnv.VITE_PA_CREATE_ACCOUNT_URL
  if (!url) throw new Error('VITE_AF_BASE_URL or VITE_PA_CREATE_ACCOUNT_URL is not configured')

  const tok = await getDataverseToken()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tok}`,
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(err)
  }

  return res.json() as Promise<{ tempPassword: string; portalUrl: string }>
}

export async function toggleRevokeLink(id: string, currentRevoked: boolean): Promise<void> {
  await dvUpdate(T.externalLinks, id, { pdplr_revoked: !currentRevoked })
}

export async function deleteExternalLink(id: string): Promise<void> {
  await dvDelete(T.externalLinks, id)
}
