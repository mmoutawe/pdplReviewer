// Compatibility shim — the app has been migrated to a local Node.js + PostgreSQL backend.
// All pages that import isDataverseConfigured / startPolling from here continue to work.
// Direct OData helpers (dvList, dvCreate, etc.) are no longer used — they are removed.

export { isBackendConfigured as isDataverseConfigured, startPolling } from './api'

// dvDownloadFile is no longer needed: attachment.signedUrl is always set to /api/attachments/:id/download
export function dvDownloadFile(_entitySet: string, _id: string, _column: string, _filename: string): Promise<void> {
  return Promise.resolve()
}

// T is not used anymore but kept so old imports don't break at the type level
export const T = {} as Record<string, string>
