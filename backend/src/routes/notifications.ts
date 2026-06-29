import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const userId = (req.query.userId as string) ?? req.auth!.userId
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY ts DESC LIMIT 100',
    [userId],
  )
  res.json(rows.map((r) => ({
    id:          r.id,
    userId:      r.user_id,
    ts:          r.ts,
    read:        r.read,
    category:    r.category,
    title:       r.title,
    body:        r.body,
    link:        r.link ?? undefined,
    actionLabel: r.action_label ?? undefined,
    ticketId:    r.ticket_id ?? undefined,
  })))
})

router.post('/', requireAuth, async (req, res) => {
  const { userId, type: _type, title, body, link, actionLabel, ticketId, category } =
    req.body as Record<string, string>

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO notifications (user_id,title,body,link,action_label,ticket_id,category)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId ?? req.auth!.userId, title, body, link ?? null, actionLabel ?? null, ticketId ?? null, category ?? 'system'],
  )
  res.status(201).json(row)
})

router.patch('/:id/read', requireAuth, async (req, res) => {
  await query('UPDATE notifications SET read=TRUE WHERE id=$1', [req.params.id])
  res.status(204).end()
})

router.post('/read-all', requireAuth, async (req, res) => {
  const userId = (req.body as { userId?: string }).userId ?? req.auth!.userId
  await query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [userId])
  res.status(204).end()
})

export default router
