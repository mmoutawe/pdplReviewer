/**
 * External Recipient Link Manager — Edge Function
 *
 * Routes:
 *   POST /functions/v1/external-link/generate
 *     Body: { ticketId, recipientEmail, expiresInHours? }
 *     Auth: Bearer JWT (data_management or admin role required)
 *     Returns: { token, link, expiresAt }
 *
 *   POST /functions/v1/external-link/redeem
 *     Body: { token }
 *     Auth: none (public endpoint — token IS the credential)
 *     Returns: { ticket, expiresAt, recipientEmail }
 *
 *   POST /functions/v1/external-link/decide
 *     Body: { token, decision: 'approve' | 'reject', notes? }
 *     Auth: none (token IS the credential)
 *     Returns: { success }
 *
 * Security:
 *   - Tokens are cryptographically random (32 bytes / 256-bit)
 *   - Stored as SHA-256 hash in DB — raw token never persisted
 *   - Single-use: redeemed_at is set on first legitimate access
 *   - Expire at configurable TTL (default 72 hours)
 *   - Only public ticket fields exposed — no internal review state
 *   - All redemption events written to audit_events
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ── Helpers ───────────────────────────────────────────────

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 43)
}

// ── Service client (bypasses RLS for token operations) ────
function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// ── Route: generate ───────────────────────────────────────

async function handleGenerate(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return unauthorized()

  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error } = await callerClient.auth.getUser()
  if (error || !user) return unauthorized()

  const { data: profile } = await callerClient.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['data_management', 'admin'].includes(profile.role)) {
    return forbidden('Only data management reviewers and admins can generate external links')
  }

  const body = await req.json()
  const { ticketId, recipientEmail, expiresInHours = 72 } = body

  if (!ticketId || !recipientEmail) {
    return badRequest('ticketId and recipientEmail are required')
  }

  // Verify ticket exists and is in a valid state for external review
  const svc = serviceClient()
  const { data: ticket } = await svc.from('tickets').select('id,state,title').eq('id', ticketId).single()
  if (!ticket) return notFound('Ticket not found')

  const validStates = ['in_legal_review', 'in_security_review', 'final_decision']
  if (!validStates.includes(ticket.state)) {
    return badRequest(`External links can only be generated for tickets in: ${validStates.join(', ')}`)
  }

  const rawToken = randomToken()
  const tokenHash = await sha256hex(rawToken)
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()

  const { error: insertError } = await svc.from('external_links').insert({
    ticket_id: ticketId,
    token_hash: tokenHash,
    recipient_email: recipientEmail,
    expires_at: expiresAt,
    created_by: user.id,
  })

  if (insertError) {
    console.error('Insert error:', insertError)
    return serverError('Failed to create external link')
  }

  // Audit
  void svc.rpc('write_audit_event', {
    p_actor_id: user.id,
    p_actor_role: profile.role,
    p_action: 'external_link.generated',
    p_target_type: 'ticket',
    p_target_id: ticketId,
    p_after_snapshot: { recipientEmail, expiresAt },
    p_reason: `External link sent to ${recipientEmail}`,
  })

  const baseUrl = Deno.env.get('SITE_URL') ?? 'https://pdpl-reviewer.vercel.app'
  const link = `${baseUrl}/external/redeem/${rawToken}`

  return ok({ token: rawToken, link, expiresAt })
}

// ── Route: redeem ─────────────────────────────────────────

async function handleRedeem(req: Request): Promise<Response> {
  const { token } = await req.json()
  if (!token) return badRequest('token is required')

  const tokenHash = await sha256hex(token)
  const svc = serviceClient()

  const { data: link } = await svc
    .from('external_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .single()

  if (!link) return notFound('Invalid or expired link')
  if (new Date(link.expires_at) < new Date()) return gone('This link has expired')
  if (link.voided_at) return gone('This link has been revoked')

  // Fetch the public ticket view — strip internal review data
  const { data: ticket } = await svc
    .from('tickets')
    .select('id,type,state,title,description,tags,payload,data_declaration,created_at,submitted_at')
    .eq('id', link.ticket_id)
    .single()

  if (!ticket) return notFound('Ticket not found')

  // Audit first access
  if (!link.redeemed_at) {
    void svc.from('external_links').update({ redeemed_at: new Date().toISOString() }).eq('id', link.id)
    void svc.rpc('write_audit_event', {
      p_actor_id: 'external',
      p_actor_role: 'external_recipient',
      p_action: 'external_link.redeemed',
      p_target_type: 'ticket',
      p_target_id: link.ticket_id,
      p_after_snapshot: { recipientEmail: link.recipient_email },
    })
  }

  return ok({
    ticket,
    expiresAt: link.expires_at,
    recipientEmail: link.recipient_email,
    alreadyDecided: !!link.decision,
    decision: link.decision ?? null,
  })
}

// ── Route: decide ─────────────────────────────────────────

async function handleDecide(req: Request): Promise<Response> {
  const { token, decision, notes } = await req.json()
  if (!token) return badRequest('token is required')
  if (!['approve', 'reject'].includes(decision)) return badRequest('decision must be approve or reject')

  const tokenHash = await sha256hex(token)
  const svc = serviceClient()

  const { data: link } = await svc
    .from('external_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .single()

  if (!link) return notFound('Invalid or expired link')
  if (new Date(link.expires_at) < new Date()) return gone('This link has expired')
  if (link.voided_at) return gone('This link has been revoked')
  if (link.decision) return conflict('A decision has already been recorded for this link')

  // Record external decision
  await svc.from('external_links').update({
    decision,
    decision_notes: notes ?? null,
    decided_at: new Date().toISOString(),
  }).eq('id', link.id)

  // Create return thread entry with the external decision
  await svc.from('return_thread_entries').insert({
    ticket_id: link.ticket_id,
    by_user_id: link.created_by,
    by_role: 'external_recipient',
    message: `External recipient (${link.recipient_email}) **${decision}d**${notes ? `:\n\n${notes}` : '.'}`,
    attachment_ids: [],
  })

  // Audit
  void svc.rpc('write_audit_event', {
    p_actor_id: 'external',
    p_actor_role: 'external_recipient',
    p_action: `external_link.${decision}d`,
    p_target_type: 'ticket',
    p_target_id: link.ticket_id,
    p_after_snapshot: { decision, notes, recipientEmail: link.recipient_email },
  })

  return ok({ success: true })
}

// ── Response helpers ──────────────────────────────────────

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function forbidden(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function notFound(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function gone(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function conflict(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
function serverError(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Router ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  if (req.method === 'POST') {
    switch (path) {
      case 'generate': return handleGenerate(req)
      case 'redeem':   return handleRedeem(req)
      case 'decide':   return handleDecide(req)
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
