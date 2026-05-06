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

export function getWorkflowSettings(): WorkflowSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function setWorkflowSetting<K extends keyof WorkflowSettings>(
  key: K,
  value: WorkflowSettings[K],
): void {
  const current = getWorkflowSettings()
  localStorage.setItem(KEY, JSON.stringify({ ...current, [key]: value }))
}
