import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(path.join(UPLOAD_DIR, 'documents'), { recursive: true }); cb(null, path.join(UPLOAD_DIR, 'documents')) },
  filename:    (_req, file, cb)  => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

function toDoc(r: Record<string, unknown>) {
  return {
    id:                 r.id,
    project_id:         r.project_id ?? null,
    vendor_id:          r.vendor_id ?? null,
    parent_document_id: r.parent_document_id ?? null,
    title:              r.title,
    document_type:      r.document_type,
    version:            r.version,
    status:             r.status,
    file_path:          r.storage_path,
    file_type:          r.file_type,
    file_size:          r.file_size,
    description:        r.description ?? null,
    tags:               r.tags ?? null,
    effective_date:     r.effective_date ?? null,
    expiry_date:        r.expiry_date ?? null,
    uploaded_by:        r.uploaded_by ?? null,
    created_at:         r.created_at,
    updated_at:         r.updated_at,
  }
}

router.get('/', requireAuth, async (req, res) => {
  const { projectId, vendorId } = req.query as Record<string, string>
  const conditions: string[] = []
  const params: unknown[]    = []
  if (projectId) { conditions.push(`project_id=$${params.length + 1}`); params.push(projectId) }
  if (vendorId)  { conditions.push(`vendor_id=$${params.length + 1}`);  params.push(vendorId) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(`SELECT * FROM project_documents ${where} ORDER BY created_at DESC`, params)
  res.json(rows.map(toDoc))
})

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return }

  const { title, document_type, description, project_id, vendor_id } = req.body as Record<string, string>

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_documents
       (title,document_type,description,project_id,vendor_id,storage_path,file_type,file_size,uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      title, document_type ?? 'other', description ?? null,
      project_id ?? null, vendor_id ?? null,
      `documents/${file.filename}`,
      path.extname(file.originalname).slice(1) || 'bin',
      file.size, req.auth!.userId,
    ],
  )
  res.status(201).json(toDoc(row!))
})

router.get('/:id/download', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM project_documents WHERE id=$1', [req.params.id])
  if (!row) { res.status(404).json({ error: 'Not found' }); return }
  const filePath = path.join(UPLOAD_DIR, row.storage_path as string)
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File missing' }); return }
  res.setHeader('Content-Disposition', `attachment; filename="${(row.storage_path as string).split('/').pop()}"`)
  res.sendFile(filePath)
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body as { status?: string }
  await query('UPDATE project_documents SET status=COALESCE($1,status), updated_at=NOW() WHERE id=$2', [status ?? null, req.params.id])
  res.status(204).end()
})

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>('SELECT storage_path FROM project_documents WHERE id=$1', [req.params.id])
  if (row) {
    fs.unlink(path.join(UPLOAD_DIR, row.storage_path as string), () => {})
    await query('DELETE FROM project_documents WHERE id=$1', [req.params.id])
  }
  res.status(204).end()
})

export default router
