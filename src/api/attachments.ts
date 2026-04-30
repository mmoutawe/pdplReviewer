import { supabase, toAttachment } from '../lib/supabase'
import type { Attachment } from '../data/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env as Record<string, string | undefined>

const BUCKET = 'ticket-attachments'
const SIGNED_URL_TTL = 3600 // 1 hour

// ── Upload ────────────────────────────────────────────────

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export async function uploadAttachment(
  ticketId: string,
  file: File,
  category: Attachment['category'] = 'evidence',
  onProgress?: (p: UploadProgress) => void,
): Promise<Attachment> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Unique storage path: {ticketId}/{uuid}-{sanitized-filename}
  const uuid = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${ticketId}/${uuid}-${safeName}`

  // Simulate progress for the Supabase SDK (it doesn't expose XHR progress natively)
  onProgress?.({ loaded: 0, total: file.size, percent: 0 })

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) throw uploadError

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 })

  // Get a short-lived signed URL immediately
  const { data: urlData } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  const signedUrl = urlData?.signedUrl

  // Insert DB record
  const attachmentId = crypto.randomUUID()
  const now = new Date().toISOString()

  const { data: row, error: dbError } = await supabase
    .from('attachments')
    .insert({
      id: attachmentId,
      ticket_id: ticketId,
      filename: file.name,
      size_bytes: file.size,
      content_type: file.type || 'application/octet-stream',
      uploaded_by: user.id,
      uploaded_at: now,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      scan_status: 'pending',
      classification: 'internal',
      category,
    })
    .select()
    .single()

  if (dbError) {
    // Roll back storage upload on DB failure
    void supabase.storage.from(BUCKET).remove([storagePath])
    throw dbError
  }

  // Fire-and-forget: trigger AI extraction + summary on the Edge Function
  void (async () => {
    const { data: { session } } = await supabase!.auth.getSession()
    if (!session?.access_token) return
    const url = `${viteEnv.VITE_SUPABASE_URL}/functions/v1/process-attachment`
    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': viteEnv.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ attachmentId }),
    })
  })()

  return toAttachment(row, signedUrl)
}

// ── Fetch ─────────────────────────────────────────────────

export async function fetchAttachmentsForTicket(ticketId: string): Promise<Attachment[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: rows, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('uploaded_at', { ascending: true })

  if (error) throw error
  if (!rows?.length) return []

  // Batch-generate signed URLs for all attachments
  const urlRequests = rows.map((r) =>
    supabase!.storage.from(BUCKET).createSignedUrl(r.storage_path, SIGNED_URL_TTL)
  )
  const urlResults = await Promise.allSettled(urlRequests)

  return rows.map((r, i) => {
    const urlResult = urlResults[i]
    const signedUrl = urlResult.status === 'fulfilled'
      ? urlResult.value.data?.signedUrl
      : undefined
    return toAttachment(r, signedUrl)
  })
}

// ── Refresh signed URL for a single attachment ─────────────

export async function refreshSignedUrl(attachment: Attachment): Promise<string | undefined> {
  if (!supabase) return undefined
  const { data } = await supabase.storage
    .from(attachment.storageBucket)
    .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL)
  return data?.signedUrl
}

// ── Delete ────────────────────────────────────────────────

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from(attachment.storageBucket)
    .remove([attachment.storagePath])

  if (storageError) throw storageError

  // Delete DB record
  const { error: dbError } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachment.id)

  if (dbError) throw dbError
}
