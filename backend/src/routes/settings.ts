import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (_req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM app_settings WHERE key='workflow'",
  )
  if (!row) { res.json(null); return }

  let workflowConfig = null
  try { workflowConfig = typeof row.value === 'string' ? JSON.parse(row.value) : row.value } catch { /* */ }

  res.json({
    id: row.id,
    requireDocumentValidation: (workflowConfig as Record<string, unknown>)?.requireDocumentValidation ?? true,
    workflowConfig,
  })
})

router.patch('/', requireAuth, async (req, res) => {
  const { workflowConfig } = req.body as { workflowConfig?: Record<string, unknown> }

  await query(
    `INSERT INTO app_settings (key, value) VALUES ('workflow', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value=$1::jsonb, updated_at=NOW()`,
    [JSON.stringify(workflowConfig ?? {})],
  )

  const row = await queryOne<Record<string, unknown>>("SELECT * FROM app_settings WHERE key='workflow'")
  let wc = null
  try { wc = typeof row?.value === 'string' ? JSON.parse(row.value as string) : row?.value } catch { /* */ }
  res.json({ id: row?.id, requireDocumentValidation: (wc as Record<string, unknown>)?.requireDocumentValidation ?? true, workflowConfig: wc })
})

export default router
