import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

function generateTempPassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower  = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const rand   = (s: string) => s[Math.floor(Math.random() * s.length)]
  return rand(upper) + rand(upper) + rand(lower) + rand(lower) + rand(digits) + rand(digits) + '!7'
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Create an external recipient account
router.post('/create-account', requireAuth, requireRole('admin', 'data_management'), async (req, res) => {
  const { email, fullName, label } = req.body as { email?: string; fullName?: string; label?: string }
  if (!email || !fullName) {
    res.status(400).json({ error: 'email and fullName are required' })
    return
  }

  const existing = await queryOne('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email])
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists' })
    return
  }

  const tempPassword = generateTempPassword()
  const hash         = await bcrypt.hash(tempPassword, 12)
  const colors       = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899']
  const color        = colors[Math.floor(Math.random() * colors.length)]

  await query(
    `INSERT INTO users (full_name,email,password_hash,role,initials,avatar_color,must_change_pw)
     VALUES ($1,$2,$3,'external_recipient',$4,$5,TRUE)`,
    [fullName, email, hash, initials(fullName), color],
  )

  if (label) {
    await query(
      `INSERT INTO notif_preferences (user_id, type, in_app)
       SELECT id, 'external_invitation', TRUE FROM users WHERE LOWER(email)=LOWER($1)
       ON CONFLICT DO NOTHING`,
      [email],
    ).catch(() => {})
  }

  const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')
  res.json({ tempPassword, portalUrl: appUrl })
})

export default router
