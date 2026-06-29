import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(path.join(UPLOAD_DIR, 'templates'), { recursive: true }); cb(null, path.join(UPLOAD_DIR, 'templates')) },
  filename:    (_req, file, cb)  => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

function toTemplate(r: Record<string, unknown>) {
  return {
    id:          r.id,
    title:       r.title,
    description: r.description ?? null,
    file_path:   r.storage_path,
    file_type:   r.file_type,
    category:    r.category,
    is_active:   r.is_active,
    uploaded_by: r.uploaded_by ?? null,
    created_at:  r.created_at,
    updated_at:  r.updated_at,
  }
}

router.get('/', requireAuth, async (_req, res) => {
  const rows = await query<Record<string, unknown>>('SELECT * FROM reviewer_templates ORDER BY created_at DESC')
  res.json(rows.map(toTemplate))
})

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return }

  const { title, description, category } = req.body as Record<string, string>
  const ext = path.extname(file.originalname).slice(1) || 'bin'

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO reviewer_templates (title,description,storage_path,file_type,category,is_active,uploaded_by)
     VALUES ($1,$2,$3,$4,$5,TRUE,$6) RETURNING *`,
    [title, description ?? null, `templates/${file.filename}`, ext, category ?? 'other', req.auth!.userId],
  )
  res.status(201).json(toTemplate(row!))
})

router.get('/:id/download', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM reviewer_templates WHERE id=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  const filePath = path.join(UPLOAD_DIR, row.storage_path as string)
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File missing' }); return }
  res.setHeader('Content-Disposition', `attachment; filename="${row.title}.${row.file_type}"`)
  res.sendFile(filePath)
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { isActive } = req.body as { isActive?: boolean }
  await query('UPDATE reviewer_templates SET is_active=$1, updated_at=NOW() WHERE id=$2', [isActive, req.params.id])
  res.status(204).end()
})

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT storage_path FROM reviewer_templates WHERE id=$1', [req.params.id])
  if (row) {
    fs.unlink(path.join(UPLOAD_DIR, row.storage_path as string), () => {})
    await query('DELETE FROM reviewer_templates WHERE id=$1', [req.params.id])
  }
  res.status(204).end()
})

export default router
