import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query, queryOne } from '../db.js'
import { requireAuth, JWT_SECRET } from '../middleware/auth.js'

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

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const user = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email],
  ).catch(() => null)

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const valid = await bcrypt.compare(password, user.password_hash as string)
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '8h' },
  )

  res.json({ token, user: toUser(user) })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE id = $1',
    [req.auth!.userId],
  )
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json(toUser(user))
})

router.post('/change-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body as { newPassword?: string }
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }
  const hash = await bcrypt.hash(newPassword, 12)
  await query('UPDATE users SET password_hash=$1, must_change_pw=FALSE, updated_at=NOW() WHERE id=$2', [
    hash, req.auth!.userId,
  ])
  res.status(204).end()
})

export default router
