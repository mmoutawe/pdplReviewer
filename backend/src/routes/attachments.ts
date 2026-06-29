import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb)  => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
})
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

const router = Router()

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) { res.status(400).json({ error: 'No file uploaded' }); return }

  const { ticketId, category, uploadedBy } = req.body as Record<string, string>

  // Generate AI summary if OpenAI is configured (non-blocking)
  let extractedSummary: string | null = null
  // (summary generation deferred — keep it simple for now)

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO attachments
       (ticket_number,filename,size_bytes,content_type,uploaded_by,storage_path,
        scan_status,classification,category,extracted_summary)
     VALUES ($1,$2,$3,$4,$5,$6,'pending','internal',$7,$8) RETURNING *`,
    [
      ticketId,
      file.originalname,
      file.size,
      file.mimetype || 'application/octet-stream',
      uploadedBy ?? req.auth!.userId,
      file.filename,
      category ?? 'other',
      extractedSummary,
    ],
  )

  const a = row!
  res.status(201).json({
    id:               a.id,
    ticketId:         a.ticket_number,
    filename:         a.filename,
    sizeBytes:        a.size_bytes,
    contentType:      a.content_type,
    uploadedBy:       a.uploaded_by,
    uploadedAt:       a.uploaded_at,
    storageBucket:    'local',
    storagePath:      a.storage_path,
    signedUrl:        `/api/attachments/${a.id}/download`,
    scanStatus:       a.scan_status,
    classification:   a.classification,
    category:         a.category,
    extractedSummary: a.extracted_summary ?? undefined,
  })
})

router.get('/', requireAuth, async (req, res) => {
  const { ticketId } = req.query as { ticketId?: string }
  if (!ticketId) { res.status(400).json({ error: 'ticketId is required' }); return }

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM attachments WHERE ticket_number=$1 ORDER BY uploaded_at ASC',
    [ticketId],
  )
  res.json(rows.map((a) => ({
    id:               a.id,
    ticketId:         a.ticket_number,
    filename:         a.filename,
    sizeBytes:        a.size_bytes,
    contentType:      a.content_type,
    uploadedBy:       a.uploaded_by,
    uploadedAt:       a.uploaded_at,
    storageBucket:    'local',
    storagePath:      a.storage_path,
    signedUrl:        `/api/attachments/${a.id}/download`,
    scanStatus:       a.scan_status,
    classification:   a.classification,
    category:         a.category,
    extractedSummary: a.extracted_summary ?? undefined,
  })))
})

router.get('/:id/download', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM attachments WHERE id=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  const filePath = path.join(UPLOAD_DIR, row.storage_path as string)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk' })
    return
  }
  res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`)
  res.setHeader('Content-Type', row.content_type as string)
  res.sendFile(filePath)
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { extractedSummary, scanStatus, classification } = req.body as Record<string, string>
  await query(
    `UPDATE attachments SET
       extracted_summary=COALESCE($1,extracted_summary),
       scan_status=COALESCE($2,scan_status),
       classification=COALESCE($3,classification)
     WHERE id=$4`,
    [extractedSummary ?? null, scanStatus ?? null, classification ?? null, req.params.id],
  )
  res.status(204).end()
})

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT storage_path FROM attachments WHERE id=$1', [req.params.id],
  )
  if (row) {
    const filePath = path.join(UPLOAD_DIR, row.storage_path as string)
    fs.unlink(filePath, () => {})
    await query('DELETE FROM attachments WHERE id=$1', [req.params.id])
  }
  res.status(204).end()
})

export default router
