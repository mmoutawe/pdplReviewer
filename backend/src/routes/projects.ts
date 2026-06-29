import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toProject(r: Record<string, unknown>) {
  return {
    id:                 r.id,
    code:               r.code,
    name:               r.name,
    businessUnit:       r.business_unit,
    ownerId:            r.owner_id,
    vendorId:           r.vendor_id ?? undefined,
    status:             r.status,
    dataInventoryCount: r.data_inventory_count,
    ticketIds:          [],
    description:        r.description,
    startedAt:          r.started_at,
  }
}

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>('SELECT * FROM projects ORDER BY name')
  res.json(rows.map(toProject))
})

router.get('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id=$1', [req.params.id])
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(toProject(row))
})

router.post('/', requireAuth, async (req, res) => {
  const p = req.body as Record<string, unknown>

  const year  = new Date().getFullYear()
  let code = p.code as string | undefined
  if (!code) {
    const count = await queryOne<{ c: string }>(`SELECT COUNT(*)::int AS c FROM projects WHERE code LIKE $1`, [`PRJ-${year}-%`])
    code = `PRJ-${year}-${String(Number(count?.c ?? 0) + 1).padStart(4, '0')}`
  }

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO projects (code,name,business_unit,owner_id,vendor_id,status,data_inventory_count,description,started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      code, p.name, p.businessUnit ?? '', p.ownerId ?? req.auth!.userId,
      p.vendorId ?? null, p.status ?? 'active',
      p.dataInventoryCount ?? 0, p.description ?? '', p.startedAt ?? '',
    ],
  )
  res.status(201).json(toProject(row!))
})

router.patch('/:id', requireAuth, async (req, res) => {
  const p = req.body as Record<string, unknown>
  await query(
    `UPDATE projects SET
       name=COALESCE($1,name),
       business_unit=COALESCE($2,business_unit),
       owner_id=COALESCE($3,owner_id),
       vendor_id=COALESCE($4,vendor_id),
       status=COALESCE($5,status),
       data_inventory_count=COALESCE($6,data_inventory_count),
       description=COALESCE($7,description),
       started_at=COALESCE($8,started_at),
       updated_at=NOW()
     WHERE id=$9`,
    [p.name ?? null, p.businessUnit ?? null, p.ownerId ?? null,
     p.vendorId ?? null, p.status ?? null, p.dataInventoryCount ?? null,
     p.description ?? null, p.startedAt ?? null, req.params.id],
  )
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id=$1', [req.params.id])
  res.json(toProject(row!))
})

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM projects WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
