import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toUser(r: Record<string, unknown>) {
  return {
    id:          r.id,
    fullName:    r.full_name,
    email:       r.email,
    role:        r.role,
    department:  r.department,
    jobTitle:    r.job_title,
    initials:    r.initials,
    avatarColor: r.avatar_color,
    mustChangePw: r.must_change_pw,
  }
}

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>('SELECT * FROM users ORDER BY full_name')
  res.json(rows.map(toUser))
})

router.get('/:id', requireAuth, async (req, res) => {
  const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id=$1', [req.params.id])
  if (!user) { res.status(404).json({ error: 'Not found' }); return }
  res.json(toUser(user))
})

router.post('/', requireAuth, async (req, res) => {
  const { fullName, email, password, role, department, jobTitle } = req.body as Record<string, string>
  if (!fullName || !email || !password) {
    res.status(400).json({ error: 'fullName, email, and password are required' })
    return
  }
  const hash    = await bcrypt.hash(password, 12)
  const initials = fullName.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const colors  = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899']
  const color   = colors[Math.floor(Math.random() * colors.length)]

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO users (full_name,email,password_hash,role,department,job_title,initials,avatar_color)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [fullName, email, hash, role ?? 'requester', department ?? '', jobTitle ?? '', initials, color],
  )
  res.status(201).json(toUser(row!))
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { fullName, role, department, jobTitle, avatarColor } = req.body as Record<string, string>
  await query(
    `UPDATE users SET
       full_name=COALESCE($1,full_name),
       role=COALESCE($2,role),
       department=COALESCE($3,department),
       job_title=COALESCE($4,job_title),
       avatar_color=COALESCE($5,avatar_color),
       updated_at=NOW()
     WHERE id=$6`,
    [fullName, role, department, jobTitle, avatarColor, req.params.id],
  )
  const user = await queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id=$1', [req.params.id])
  res.json(toUser(user!))
})

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM users WHERE id=$1', [req.params.id])
  res.status(204).end()
})

export default router
