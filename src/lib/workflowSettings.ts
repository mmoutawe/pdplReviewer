import { isDataverseConfigured } from './dataverse'
import { fetchAppSettings, updateWorkflowConfig } from '../api/adminSettings'

const KEY = 'pdpl_workflow_cfg'

export interface WorkflowSettings {
  requireDocumentValidation: boolean
  legalForCrossBorder: boolean
  securityForSensitive: boolean
  autoRouteLowRisk: boolean
}

const DEFAULTS: WorkflowSettings = {
  requireDocumentValidation: true,
  legalForCrossBorder: true,
  securityForSensitive: true,
  autoRouteLowRisk: false,
}

/** Synchronous read — always returns quickly from localStorage cache. */
export function getWorkflowSettings(): WorkflowSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

/** Write to localStorage (and Dataverse if configured). */
export function setWorkflowSetting<K extends keyof WorkflowSettings>(
  key: K,
  value: WorkflowSettings[K],
): void {
  const current = getWorkflowSettings()
  const updated = { ...current, [key]: value }
  localStorage.setItem(KEY, JSON.stringify(updated))
}

/**
 * Pulls workflow settings from Dataverse and writes them to localStorage so
 * that synchronous callers (e.g. the wizard) always see the latest value.
 * Returns the settings id so callers can persist changes back.
 */
export async function syncWorkflowSettings(): Promise<{ settingsId: string | null; settings: WorkflowSettings }> {
  if (!isDataverseConfigured) {
    return { settingsId: null, settings: getWorkflowSettings() }
  }
  try {
    const appSettings = await fetchAppSettings()
    if (appSettings?.workflowConfig) {
      localStorage.setItem(KEY, JSON.stringify(appSettings.workflowConfig))
      return { settingsId: appSettings.id, settings: appSettings.workflowConfig }
    }
    return { settingsId: appSettings?.id ?? null, settings: getWorkflowSettings() }
  } catch {
    return { settingsId: null, settings: getWorkflowSettings() }
  }
}

/**
 * Saves workflow settings to both localStorage and Dataverse.
 * settingsId comes from syncWorkflowSettings().
 */
export async function saveWorkflowSettings(settingsId: string, settings: WorkflowSettings): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(settings))
  await updateWorkflowConfig(settingsId, settings)
}
