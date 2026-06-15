/**
 * email-notify — Edge Function
 *
 * Called by a Supabase Database Webhook on INSERT to the notifications table.
 * Looks up the recipient's email address, constructs an HTML email, and
 * sends it via Resend (https://resend.com).
 *
 * Webhook setup (run once in Supabase dashboard or via SQL):
 *   Dashboard → Database → Webhooks → Create
 *     Table: notifications, Event: INSERT
 *     URL: {SUPABASE_URL}/functions/v1/email-notify
 *     HTTP Method: POST
 *     Headers: Authorization: Bearer {SERVICE_ROLE_KEY}
 *
 * Required secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY   — Resend.com API key (starts with re_)
 *   EMAIL_FROM       — verified sender address, e.g. "PDPL Reviewer <noreply@yourcompany.com>"
 *   APP_URL          — public base URL, e.g. "https://pdpl.yourcompany.com"
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'

type NotificationKind =
  | 'ticket_submitted'
  | 'ticket_returned'
  | 'ticket_approved'
  | 'ticket_rejected'
  | 'review_requested'
  | 'comment_added'
  | 'sla_warning'
  | 'external_link_decided'

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    user_id: string
    kind: NotificationKind
    title: string
    body: string
    ticket_id: string | null
    read: boolean
    created_at: string
  }
}

function subjectFor(kind: NotificationKind, title: string): string {
  const prefixes: Record<NotificationKind, string> = {
    ticket_submitted:      '[PDPL Reviewer] New request submitted',
    ticket_returned:       '[PDPL Reviewer] Request returned for revision',
    ticket_approved:       '[PDPL Reviewer] Request approved',
    ticket_rejected:       '[PDPL Reviewer] Request rejected',
    review_requested:      '[PDPL Reviewer] Review requested',
    comment_added:         '[PDPL Reviewer] New comment on request',
    sla_warning:           '[PDPL Reviewer] SLA warning',
    external_link_decided: '[PDPL Reviewer] External approval decision received',
  }
  return prefixes[kind] ?? `[PDPL Reviewer] ${title}`
}

function htmlBody(notification: WebhookPayload['record'], appUrl: string): string {
  const actionUrl = notification.ticket_id
    ? `${appUrl}/requests/${notification.ticket_id}`
    : appUrl

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${notification.title}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'IBM Plex Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr><td style="background:#1E40AF;padding:20px 28px;">
          <span style="font-size:16px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">PDPL Reviewer</span>
          <span style="font-size:11px;color:#93C5FD;margin-left:10px;">Privacy Compliance Platform</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px;">
          <h1 style="font-size:17px;font-weight:600;color:#0F172A;margin:0 0 10px;">${notification.title}</h1>
          <p style="font-size:14px;color:#475569;line-height:1.65;margin:0 0 24px;">${notification.body}</p>

          ${notification.ticket_id ? `
          <a href="${actionUrl}"
             style="display:inline-block;padding:10px 20px;background:#1E40AF;color:#FFFFFF;text-decoration:none;
                    border-radius:6px;font-size:13.5px;font-weight:600;">
            View request
          </a>` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 28px;border-top:1px solid #F1F5F9;">
          <p style="font-size:11px;color:#94A3B8;margin:0;line-height:1.5;">
            This notification was sent from PDPL Reviewer. It is for the named recipient only.<br/>
            Saudi Personal Data Protection Law (Royal Decree M/19, 2021).
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Validate webhook shared secret (set in Supabase Dashboard → Webhooks → Authorization header)
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  if (webhookSecret) {
    const auth = req.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${webhookSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'PDPL Reviewer <noreply@pdpl-reviewer.app>'
  const appUrl    = Deno.env.get('APP_URL') ?? 'https://pdpl-reviewer.app'

  if (!resendKey) {
    console.warn('email-notify: RESEND_API_KEY not set — skipping')
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  const notification = payload.record

  // Resolve recipient email via service role
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: recipient } = await admin
    .from('users')
    .select('email, full_name')
    .eq('id', notification.user_id)
    .single()

  if (!recipient?.email) {
    console.warn(`email-notify: no email for user ${notification.user_id}`)
    return new Response(JSON.stringify({ skipped: true }), { status: 200 })
  }

  const subject = subjectFor(notification.kind, notification.title)
  const html    = htmlBody(notification, appUrl)

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to:   [recipient.email],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('email-notify: Resend error', res.status, text)
    return new Response(JSON.stringify({ error: text }), { status: 502 })
  }

  const result = await res.json()
  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
