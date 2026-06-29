import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const userId = (req.query.userId as string) ?? req.auth!.userId
  const rows = await query<Record<string, unknown>>(
    'SELECT type, in_app FROM notif_preferences WHERE user_id=$1',
    [userId],
  ).catch(() => [])

  const map: Record<string, boolean> = {}
  for (const r of rows) map[r.type as string] = r.in_app as boolean
  res.json(map)
})

router.put('/', requireAuth, async (req, res) => {
  const { userId, type, inApp } = req.body as { userId?: string; type: string; inApp: boolean }
  const uid = userId ?? req.auth!.userId

  await query(
    `INSERT INTO notif_preferences (user_id, type, in_app) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, type) DO UPDATE SET in_app=$3`,
    [uid, type, inApp],
  )
  res.status(204).end()
})

export default router
