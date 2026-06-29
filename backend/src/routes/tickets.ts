import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function toTicket(t: Record<string, unknown>, slots: Record<string, unknown>[], thread: Record<string, unknown>[], attachments: Record<string, unknown>[]) {
  return {
    id:           t.ticket_number,
    type:         t.type,
    state:        t.state,
    title:        t.title,
    description:  t.description,
    requesterId:  t.requester_id,
    vendorId:     t.vendor_id ?? undefined,
    projectId:    t.project_id ?? undefined,
    externalRecipientEmail: t.external_recipient_email ?? undefined,
    tags:         t.tags ?? [],
    payload:      t.payload ?? {},
    dataDeclaration: t.data_declaration ?? {},
    sla: {
      ackHours:      t.sla_ack_hours,
      decisionHours: t.sla_decision_hours,
      startedAt:     t.sla_started_at,
      ackBy:         t.sla_ack_by ?? undefined,
      ackedAt:       t.sla_acked_at ?? undefined,
      decisionDueAt: t.sla_decision_due_at,
      breached:      t.sla_breached,
    },
    reviews: slots.map((s) => ({
      role:       s.role,
      reviewerId: s.reviewer_id ?? null,
      verdict:    s.verdict,
      decidedAt:  s.decided_at ?? undefined,
      notes:      s.notes ?? undefined,
      aiCopilotGenerationId: s.ai_copilot_generation_id ?? undefined,
    })),
    returnThread: thread.map((e) => ({
      id:            e.id,
      by:            e.by_user_id,
      byRole:        e.by_role,
      message:       e.message,
      createdAt:     e.created_at,
      attachmentIds: e.attachment_ids ?? [],
      aiScore:       e.ai_score ?? undefined,
      resolvedAt:    e.resolved_at ?? undefined,
      resolvedBy:    e.resolved_by ?? undefined,
    })),
    attachments: attachments.map((a) => ({
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
    })),
    preAssessmentGenerationId: t.pre_assessment_generation_id ?? undefined,
    parentTicketId:            t.parent_ticket_id ?? undefined,
    submittedAt:               t.submitted_at ?? undefined,
    decidedAt:                 t.decided_at ?? undefined,
    createdAt:                 t.created_at,
    updatedAt:                 t.updated_at,
  }
}

async function loadTicketWithRelated(ticketRow: Record<string, unknown>) {
  const [slots, thread, attachments] = await Promise.all([
    query('SELECT * FROM review_slots WHERE ticket_id=$1', [ticketRow.id]),
    query('SELECT * FROM thread_entries WHERE ticket_id=$1 ORDER BY created_at ASC', [ticketRow.id]),
    query('SELECT * FROM attachments WHERE ticket_number=$1 ORDER BY uploaded_at ASC', [ticketRow.ticket_number]),
  ])
  return toTicket(ticketRow, slots, thread, attachments)
}

router.get('/', requireAuth, async (req, res) => {
  const { state, requesterId, projectId, vendorId } = req.query as Record<string, string | string[]>

  const conditions: string[] = []
  const params: unknown[] = []

  if (state) {
    const states = Array.isArray(state) ? state : state.split(',')
    conditions.push(`state = ANY($${params.length + 1}::text[])`)
    params.push(states)
  }
  if (requesterId) { conditions.push(`requester_id=$${params.length + 1}`); params.push(requesterId) }
  if (projectId)   { conditions.push(`project_id=$${params.length + 1}`);   params.push(projectId) }
  if (vendorId)    { conditions.push(`vendor_id=$${params.length + 1}`);     params.push(vendorId) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(`SELECT * FROM tickets ${where} ORDER BY created_at DESC`, params)

  const tickets = await Promise.all(rows.map(loadTicketWithRelated))
  res.json(tickets)
})

router.get('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1',
    [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Ticket not found' }); return }
  res.json(await loadTicketWithRelated(row))
})

router.post('/', requireAuth, async (req, res) => {
  const { type, title, description, payload, dataDeclaration, vendorId, projectId, tags, requesterId } =
    req.body as Record<string, unknown>

  const year   = new Date().getFullYear()
  const count  = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::int AS c FROM tickets WHERE ticket_number LIKE $1`,
    [`PDPL-${year}-%`],
  )
  const seq    = String((Number(count?.c ?? 0) + 1)).padStart(4, '0')
  const number = `PDPL-${year}-${seq}`
  const now    = new Date().toISOString()
  const due    = new Date(Date.now() + 72 * 3600_000).toISOString()

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO tickets
       (ticket_number,type,state,title,description,requester_id,vendor_id,project_id,tags,
        payload,data_declaration,sla_started_at,sla_decision_due_at)
     VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      number, type, title, description,
      requesterId ?? req.auth!.userId,
      vendorId ?? null, projectId ?? null,
      Array.isArray(tags) ? tags : [],
      payload ?? {}, dataDeclaration ?? {},
      now, due,
    ],
  )
  res.status(201).json(await loadTicketWithRelated(row!))
})

router.patch('/:id', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  const { title, description, payload, dataDeclaration, tags, preAssessmentGenerationId } =
    req.body as Record<string, unknown>

  await query(
    `UPDATE tickets SET
       title=COALESCE($1,title),
       description=COALESCE($2,description),
       payload=COALESCE($3,payload),
       data_declaration=COALESCE($4,data_declaration),
       tags=COALESCE($5,tags),
       pre_assessment_generation_id=COALESCE($6,pre_assessment_generation_id),
       updated_at=NOW()
     WHERE id=$7`,
    [title, description, payload ?? null, dataDeclaration ?? null,
     Array.isArray(tags) ? tags : null, preAssessmentGenerationId ?? null, row.id],
  )
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id=$1', [row.id])
  res.json(await loadTicketWithRelated(updated!))
})

router.post('/:id/submit', requireAuth, async (req, res) => {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  await query(
    `UPDATE tickets SET state='submitted', submitted_at=NOW(), updated_at=NOW() WHERE id=$1`,
    [row.id],
  )
  await query(
    `INSERT INTO review_slots (ticket_id,role,verdict) VALUES ($1,'data_management','pending')
     ON CONFLICT (ticket_id,role) DO NOTHING`,
    [row.id],
  )
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id=$1', [row.id])
  res.json(await loadTicketWithRelated(updated!))
})

router.post('/:id/transition', requireAuth, async (req, res) => {
  const { newState } = req.body as { newState: string }
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  await query(
    `UPDATE tickets SET state=$1, updated_at=NOW() WHERE id=$2`,
    [newState, row.id],
  )

  if (newState === 'in_legal_review') {
    await query(
      `INSERT INTO review_slots (ticket_id,role,verdict) VALUES ($1,'legal','pending')
       ON CONFLICT (ticket_id,role) DO NOTHING`,
      [row.id],
    )
  }
  if (newState === 'in_security_review') {
    await query(
      `INSERT INTO review_slots (ticket_id,role,verdict) VALUES ($1,'security','pending')
       ON CONFLICT (ticket_id,role) DO NOTHING`,
      [row.id],
    )
  }
  if (newState === 'approved' || newState === 'rejected') {
    await query(`UPDATE tickets SET decided_at=NOW() WHERE id=$1`, [row.id])
  }

  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id=$1', [row.id])
  res.json(await loadTicketWithRelated(updated!))
})

router.post('/:id/review', requireAuth, async (req, res) => {
  const { role, verdict, notes, reviewerId } = req.body as Record<string, string>
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  await query(
    `INSERT INTO review_slots (ticket_id,role,reviewer_id,verdict,notes,decided_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (ticket_id,role) DO UPDATE SET
       reviewer_id=EXCLUDED.reviewer_id,
       verdict=EXCLUDED.verdict,
       notes=EXCLUDED.notes,
       decided_at=EXCLUDED.decided_at`,
    [row.id, role, reviewerId ?? req.auth!.userId, verdict, notes ?? null],
  )
  await query(`UPDATE tickets SET updated_at=NOW() WHERE id=$1`, [row.id])
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id=$1', [row.id])
  res.json(await loadTicketWithRelated(updated!))
})

router.post('/:id/thread', requireAuth, async (req, res) => {
  const { message, attachmentIds, userId, userRole } = req.body as Record<string, unknown>
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM tickets WHERE ticket_number=$1', [req.params.id],
  )
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  await query(
    `INSERT INTO thread_entries (ticket_id,by_user_id,by_role,message,attachment_ids)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      row.id,
      userId ?? req.auth!.userId,
      userRole ?? req.auth!.role,
      message,
      Array.isArray(attachmentIds) ? attachmentIds : [],
    ],
  )
  await query(`UPDATE tickets SET updated_at=NOW() WHERE id=$1`, [row.id])
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM tickets WHERE id=$1', [row.id])
  res.json(await loadTicketWithRelated(updated!))
})

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM tickets WHERE ticket_number=$1', [req.params.id])
  res.status(204).end()
})

export default router
