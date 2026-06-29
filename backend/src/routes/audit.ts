import { Router } from 'express'
import { createHash } from 'crypto'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toAuditEvent(r: Record<string, unknown>) {
  return {
    id:            r.id,
    ts:            r.ts,
    actorId:       r.actor_id,
    actorRole:     r.actor_role,
    action:        r.action,
    targetType:    r.target_type,
    targetId:      r.target_id,
    before:        r.before_snapshot ?? undefined,
    after:         r.after_snapshot ?? undefined,
    ipHash:        r.ip_hash ?? undefined,
    sessionId:     r.session_id ?? undefined,
    reason:        r.reason ?? undefined,
    immutableHash: r.immutable_hash,
    prevHash:      r.prev_hash ?? undefined,
  }
}

router.get('/', requireAuth, async (req, res) => {
  const { targetId, actorId, action, limit = '500' } = req.query as Record<string, string>

  const conditions: string[] = []
  const params: unknown[] = []

  if (targetId) { conditions.push(`target_id=$${params.length + 1}`); params.push(targetId) }
  if (actorId)  { conditions.push(`actor_id=$${params.length + 1}`);  params.push(actorId) }
  if (action)   { conditions.push(`action=$${params.length + 1}`);    params.push(action) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(Math.min(parseInt(limit, 10), 1000))

  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM audit_events ${where} ORDER BY ts DESC LIMIT $${params.length}`,
    params,
  )
  res.json(rows.map(toAuditEvent))
})

router.post('/', requireAuth, async (req, res) => {
  const e = req.body as Record<string, unknown>

  const last = await queryOne<Record<string, unknown>>(
    'SELECT immutable_hash FROM audit_events ORDER BY ts DESC LIMIT 1',
  )
  const prevHash = (last?.immutable_hash as string) ?? ''
  const content  = JSON.stringify({ ...e, prevHash, ts: new Date().toISOString() })
  const hash     = createHash('sha256').update(content).digest('hex')

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO audit_events
       (actor_id,actor_role,action,target_type,target_id,before_snapshot,after_snapshot,
        ip_hash,session_id,reason,immutable_hash,prev_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      e.actorId ?? req.auth!.userId,
      e.actorRole ?? req.auth!.role,
      e.action, e.targetType, e.targetId,
      e.before ?? null, e.after ?? null,
      e.ipHash ?? null, e.sessionId ?? null, e.reason ?? null,
      hash, prevHash || null,
    ],
  )
  res.status(201).json(toAuditEvent(row!))
})

export default router
