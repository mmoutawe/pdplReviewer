/**
 * Seed script — creates the initial admin user.
 * Usage:  npm run seed
 * Or:     tsx src/seed.ts
 *
 * Set env vars or pass as command-line args:
 *   ADMIN_EMAIL    (default: admin@pdplreviewer.local)
 *   ADMIN_PASSWORD (default: Admin@1234  — change immediately after first login)
 *   ADMIN_NAME     (default: System Administrator)
 */

import bcrypt from 'bcryptjs'
import { pool, query, queryOne } from './db.js'

const email    = process.env.ADMIN_EMAIL    ?? 'admin@pdplreviewer.local'
const password = process.env.ADMIN_PASSWORD ?? 'Admin@1234'
const fullName = process.env.ADMIN_NAME     ?? 'System Administrator'

async function seed() {
  const existing = await queryOne('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email])
  if (existing) {
    console.log(`Admin user already exists: ${email}`)
    await pool.end()
    return
  }

  const hash = await bcrypt.hash(password, 12)
  await query(
    `INSERT INTO users (full_name,email,password_hash,role,initials,avatar_color,department,job_title)
     VALUES ($1,$2,$3,'admin','SA','#6366f1','IT / Compliance','System Administrator')`,
    [fullName, email, hash],
  )

  console.log(`\nAdmin user created:`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`\nChange the password after first login!\n`)
  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
