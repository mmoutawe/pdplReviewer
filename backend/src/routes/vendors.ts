import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toVendor(r: Record<string, unknown>) {
  return {
    id:             r.id,
    legalName:      r.legal_name,
    tradeName:      r.trade_name,
    jurisdiction:   r.jurisdiction,
    riskScore:      r.risk_score,
    riskTier:       r.risk_tier,
    status:         r.status,
    category:       r.category,
    primaryContact: r.primary_contact,
    certifications: r.certifications ?? [],
    hasDPA:         r.has_dpa,
    lastReviewedAt: r.last_reviewed_at,
    ticketIds:      [],
    notes:          r.notes,
  }
}

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>('SELECT * FROM vendors ORDER BY trade_name')
  res.json(rows.map(toVendor))
})

router.get('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM vendors WHERE id=$1', [req.params.id])
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(toVendor(row))
})

router.post('/', requireAuth, async (req, res) => {
  const v = req.body as Record<string, unknown>
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO vendors
       (legal_name,trade_name,jurisdiction,risk_score,risk_tier,status,category,
        primary_contact,certifications,has_dpa,last_reviewed_at,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      v.legalName, v.tradeName, v.jurisdiction,
      v.riskScore ?? 50, v.riskTier ?? 'medium', v.status ?? 'pending',
      v.category ?? '', v.primaryContact ?? '',
      Array.isArray(v.certifications) ? v.certifications : [],
      v.hasDPA ?? false,
      v.lastReviewedAt ?? new Date().toISOString(),
      v.notes ?? '',
    ],
  )
  res.status(201).json(toVendor(row!))
})

router.patch('/:id', requireAuth, async (req, res) => {
  const v = req.body as Record<string, unknown>
  await query(
    `UPDATE vendors SET
       legal_name=COALESCE($1,legal_name),
       trade_name=COALESCE($2,trade_name),
       jurisdiction=COALESCE($3,jurisdiction),
       risk_score=COALESCE($4,risk_score),
       risk_tier=COALESCE($5,risk_tier),
       status=COALESCE($6,status),
       category=COALESCE($7,category),
       primary_contact=COALESCE($8,primary_contact),
       certifications=COALESCE($9,certifications),
       has_dpa=COALESCE($10,has_dpa),
       notes=COALESCE($11,notes),
       updated_at=NOW()
     WHERE id=$12`,
    [
      v.legalName ?? null, v.tradeName ?? null, v.jurisdiction ?? null,
      v.riskScore ?? null, v.riskTier ?? null, v.status ?? null,
      v.category ?? null, v.primaryContact ?? null,
      Array.isArray(v.certifications) ? v.certifications : null,
      v.hasDPA ?? null, v.notes ?? null,
      req.params.id,
    ],
  )
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM vendors WHERE id=$1', [req.params.id])
  res.json(toVendor(row!))
})

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM vendors WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
