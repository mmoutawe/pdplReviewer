/**
 * process-attachment — Edge Function
 *
 * Triggered fire-and-forget from the browser after a successful attachment upload.
 * Downloads the file from Supabase Storage, extracts text where possible, calls
 * Claude Haiku for a concise compliance-focused summary, and updates the
 * attachments row with extracted_summary + scan_status = 'clean'.
 *
 * POST /functions/v1/process-attachment
 * Body: { attachmentId: string }
 * Auth: anon key is sufficient — the function uses the service role internally.
 *       The caller's JWT is still validated to prevent anonymous abuse.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.20.1'

const MAX_TEXT_BYTES = 12_000   // ~3k tokens — enough for a summary prompt
const BUCKET = 'ticket-attachments'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 })

  // Validate caller JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify the caller's JWT with the anon client
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  // Use service role client for storage + DB writes
  const admin = createClient(supabaseUrl, serviceKey)

  let attachmentId: string
  try {
    const body = await req.json()
    attachmentId = body.attachmentId
    if (!attachmentId) throw new Error('missing attachmentId')
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Fetch attachment record
  const { data: att, error: attError } = await admin
    .from('attachments')
    .select('id, filename, content_type, size_bytes, storage_path, ticket_id')
    .eq('id', attachmentId)
    .single()

  if (attError || !att) return new Response('Not found', { status: 404 })

  try {
    // Download file from storage
    const { data: fileData, error: dlError } = await admin.storage
      .from(BUCKET)
      .download(att.storage_path as string)

    if (dlError || !fileData) throw dlError ?? new Error('download failed')

    // Extract text — best-effort
    let extractedText = ''
    const ct = (att.content_type as string) ?? ''

    if (ct.startsWith('text/') || ct === 'application/json') {
      const bytes = await fileData.arrayBuffer()
      extractedText = new TextDecoder().decode(bytes.slice(0, MAX_TEXT_BYTES))
    }
    // PDF / Office docs: skip binary extraction, summarise from metadata only

    // Build summary prompt
    const textSection = extractedText
      ? `\n\nFile content (first ${MAX_TEXT_BYTES} bytes):\n\`\`\`\n${extractedText}\n\`\`\``
      : '\n\n(Binary file — no text extracted. Base summary on filename and type.)'

    const prompt = `You are a compliance document analyst for a Saudi FinTech organization operating under PDPL (Personal Data Protection Law). Analyse the following uploaded attachment and produce a concise summary (3–5 sentences) covering:
1. Document purpose
2. Any personal data categories referenced
3. Any compliance risks or PDPL-relevant observations
4. Recommended classification (public / internal / confidential / restricted)

Filename: ${att.filename}
Content-Type: ${ct}
File size: ${Number(att.size_bytes).toLocaleString()} bytes
${textSection}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = (message.content[0] as { type: string; text: string }).text ?? ''

    // Update attachment record
    await admin
      .from('attachments')
      .update({ extracted_summary: summary, scan_status: 'clean' })
      .eq('id', attachmentId)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('process-attachment error:', err)

    // Mark as failed so the UI can surface the error
    await admin
      .from('attachments')
      .update({ scan_status: 'failed' })
      .eq('id', attachmentId)

    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
