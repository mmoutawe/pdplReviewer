import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toPolicy(r: Record<string, unknown>) {
  return {
    id:              r.id,
    code:            r.code,
    title:           r.title,
    category:        r.category,
    version:         r.version,
    effectiveDate:   r.effective_date,
    ownerDept:       r.owner_dept,
    status:          r.status,
    summary:         r.summary,
    body:            r.body,
    embeddingsBuilt: r.embeddings_built,
    citationCount:   r.citation_count,
  }
}

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>('SELECT * FROM policies ORDER BY code')
  res.json(rows.map(toPolicy))
})

router.get('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM policies WHERE id=$1', [req.params.id])
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  res.json(toPolicy(row))
})

router.post('/', requireAuth, async (req, res) => {
  const p = req.body as Record<string, unknown>
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO policies (code,title,category,version,effective_date,owner_dept,status,summary,body)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [p.code, p.title, p.category ?? 'internal', p.version ?? '1.0',
     p.effectiveDate ?? '', p.ownerDept ?? '', p.status ?? 'active',
     p.summary ?? '', p.body ?? ''],
  )
  res.status(201).json(toPolicy(row!))
})

router.patch('/:id', requireAuth, async (req, res) => {
  const p = req.body as Record<string, unknown>
  await query(
    `UPDATE policies SET
       title=COALESCE($1,title),
       category=COALESCE($2,category),
       version=COALESCE($3,version),
       status=COALESCE($4,status),
       summary=COALESCE($5,summary),
       body=COALESCE($6,body),
       updated_at=NOW()
     WHERE id=$7`,
    [p.title ?? null, p.category ?? null, p.version ?? null,
     p.status ?? null, p.summary ?? null, p.body ?? null, req.params.id],
  )
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM policies WHERE id=$1', [req.params.id])
  res.json(toPolicy(row!))
})

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM policies WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
