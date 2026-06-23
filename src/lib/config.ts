/**
 * Runtime configuration for PDPL Reviewer.
 *
 * Priority order:
 *   1. window.PDPL_CONFIG  — injected by Power Pages Liquid snippet (AppSource / customer deployments)
 *   2. import.meta.env     — Vite env vars from .env.local (local development)
 *
 * The Liquid snippet lives in powerpages/pdpl-config.html. Place it in the
 * Power Pages portal page template inside <head> so it executes before any
 * module scripts load.
 */

interface PDPLWindowConfig {
  dataverseUrl?:     string
  dvTablePrefix?:    string
  msalClientId?:     string
  msalTenantId?:     string
  afBaseUrl?:        string
  openAiKey?:        string
  openAiEndpoint?:   string
  openAiDeployment?: string
}

declare global {
  interface Window { PDPL_CONFIG?: PDPLWindowConfig }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

function pick(windowKey: keyof PDPLWindowConfig, viteKey: string): string | undefined {
  const fromWindow = window.PDPL_CONFIG?.[windowKey]
  if (fromWindow && fromWindow.trim()) return fromWindow.trim()
  const fromVite = viteEnv[viteKey]
  return fromVite && fromVite.trim() ? fromVite.trim() : undefined
}

export const config = {
  get dataverseUrl()     { return pick('dataverseUrl',     'VITE_DATAVERSE_URL') },
  get dvTablePrefix()    { return pick('dvTablePrefix',    'VITE_DV_TABLE_PREFIX')    ?? 'pdplr_' },
  get msalClientId()     { return pick('msalClientId',     'VITE_MSAL_CLIENT_ID')     ?? '' },
  get msalTenantId()     { return pick('msalTenantId',     'VITE_MSAL_TENANT_ID')     ?? 'common' },
  get afBaseUrl()        { return pick('afBaseUrl',        'VITE_AF_BASE_URL') },
  get openAiKey()        { return pick('openAiKey',        'VITE_AZURE_OPENAI_KEY') },
  get openAiEndpoint()   { return pick('openAiEndpoint',   'VITE_AZURE_OPENAI_ENDPOINT') },
  get openAiDeployment() { return pick('openAiDeployment', 'VITE_AZURE_OPENAI_DEPLOYMENT') ?? 'gpt-5.1-chat' },
}
