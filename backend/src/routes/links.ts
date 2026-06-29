import { Router } from 'express'
import { randomUUID } from 'crypto'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Generate a one-time external review link (authenticated)
router.post('/generate', requireAuth, async (req, res) => {
  const { ticketId, recipientEmail, expiresInHours = 72, label } =
    req.body as { ticketId: string; recipientEmail: string; expiresInHours?: number; label?: string }

  if (!ticketId || !recipientEmail) {
    res.status(400).json({ error: 'ticketId and recipientEmail are required' })
    return
  }

  const token     = randomUUID()
  const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000).toISOString()
  const appUrl    = (process.env.APP_URL ?? '').replace(/\/$/, '')

  await query(
    `INSERT INTO external_links (token,ticket_number,recipient_email,expires_at,status,revoked,label)
     VALUES ($1,$2,$3,$4,'pending',FALSE,$5)`,
    [token, ticketId, recipientEmail, expiresAt, label ?? ''],
  )

  res.json({ token, link: `${appUrl}/external/${token}`, expiresAt })
})

// Redeem a link (no auth — used by external parties)
router.post('/redeem', async (req, res) => {
  const { token } = req.body as { token?: string }
  if (!token) { res.status(400).json({ error: 'token is required' }); return }

  const link = await queryOne<Record<string, unknown>>(
    'SELECT * FROM external_links WHERE token=$1', [token],
  )
  if (!link)                   { res.status(404).json({ error: 'Invalid or expired link' }); return }
  if (link.revoked)            { res.status(403).json({ error: 'This link has been revoked' }); return }
  if (link.expires_at && new Date(link.expires_at as string) < new Date()) {
    res.status(410).json({ error: 'This link has expired' })
    return
  }

  const ticket = await queryOne<Record<string, unknown>>(
    'SELECT ticket_number,type,state,title,description FROM tickets WHERE ticket_number=$1',
    [link.ticket_number],
  )

  res.json({
    token,
    expiresAt:      link.expires_at,
    recipientEmail: link.recipient_email,
    alreadyDecided: link.status !== 'pending',
    decision:       link.status !== 'pending' ? link.status : null,
    ticket,
  })
})

// Submit external decision (no auth)
router.post('/submit', async (req, res) => {
  const { token, decision, notes } = req.body as { token?: string; decision?: string; notes?: string }
  if (!token)   { res.status(400).json({ error: 'token is required' }); return }
  if (decision !== 'approve' && decision !== 'reject') {
    res.status(400).json({ error: 'decision must be approve or reject' })
    return
  }

  const link = await queryOne<Record<string, unknown>>(
    'SELECT id,revoked,expires_at FROM external_links WHERE token=$1', [token],
  )
  if (!link)        { res.status(404).json({ error: 'Invalid token' }); return }
  if (link.revoked) { res.status(403).json({ error: 'Link has been revoked' }); return }

  await query(
    `UPDATE external_links SET status=$1, notes=$2, approved_at=NOW() WHERE id=$3`,
    [decision, notes ?? null, link.id],
  )
  res.json({})
})

// Admin: list all links
router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM external_links ORDER BY created_at DESC',
  )
  res.json(rows.map((r) => ({
    id:             r.id,
    token:          r.token,
    label:          r.label,
    created_at:     r.created_at,
    expires_at:     r.expires_at,
    revoked:        r.revoked,
    recipient_email: r.recipient_email,
    status:         r.status,
    approved_at:    r.approved_at,
  })))
})

// Admin: toggle revoke
router.patch('/:id/revoke', requireAuth, async (req, res) => {
  const link = await queryOne<Record<string, unknown>>('SELECT revoked FROM external_links WHERE id=$1', [req.params.id])
  if (!link) { res.status(404).json({ error: 'Not found' }); return }
  await query('UPDATE external_links SET revoked=$1 WHERE id=$2', [!link.revoked, req.params.id])
  res.status(204).end()
})

// Admin: delete link
router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM external_links WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
