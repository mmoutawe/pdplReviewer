import express from 'express'
import cors from 'cors'
import path from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { pool } from './db.js'

import authRoutes            from './routes/auth.js'
import usersRoutes           from './routes/users.js'
import ticketsRoutes         from './routes/tickets.js'
import aiRoutes              from './routes/ai.js'
import linksRoutes           from './routes/links.js'
import attachmentsRoutes     from './routes/attachments.js'
import notificationsRoutes   from './routes/notifications.js'
import vendorsRoutes         from './routes/vendors.js'
import projectsRoutes        from './routes/projects.js'
import policiesRoutes        from './routes/policies.js'
import auditRoutes           from './routes/audit.js'
import settingsRoutes        from './routes/settings.js'
import templatesRoutes       from './routes/templates.js'
import documentsRoutes       from './routes/documents.js'
import notifPrefsRoutes      from './routes/notif-preferences.js'
import adminRoutes           from './routes/admin.js'

const app  = express()
const PORT = Number(process.env.PORT ?? 3000)

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Routes ─────────────────────────────────────────────────────────────────────

app.use('/api/auth',             authRoutes)
app.use('/api/users',            usersRoutes)
app.use('/api/tickets',          ticketsRoutes)
app.use('/api/ai',               aiRoutes)
app.use('/api/links',            linksRoutes)
app.use('/api/attachments',      attachmentsRoutes)
app.use('/api/notifications',    notificationsRoutes)
app.use('/api/vendors',          vendorsRoutes)
app.use('/api/projects',         projectsRoutes)
app.use('/api/policies',         policiesRoutes)
app.use('/api/audit-events',     auditRoutes)
app.use('/api/settings',         settingsRoutes)
app.use('/api/templates',        templatesRoutes)
app.use('/api/documents',        documentsRoutes)
app.use('/api/notif-preferences',notifPrefsRoutes)
app.use('/api/admin',            adminRoutes)

// ── Health ─────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── DB bootstrap ───────────────────────────────────────────────────────────────

async function runSchema() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(sql)
  console.log('Schema applied.')
}

// ── Start ──────────────────────────────────────────────────────────────────────

async function main() {
  await runSchema()
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDPL Reviewer API listening on port ${PORT}`)
  })
}

main().catch((err) => {
  console.error('Startup error:', err)
  process.exit(1)
})
