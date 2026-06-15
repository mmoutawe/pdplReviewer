/**
 * AI streaming proxy — Edge Function
 *
 * Handles all 6 AI surfaces:
 *   pre_assessment  — typed pre-submission risk assessment
 *   copilot         — role-aware reviewer co-pilot
 *   document_chat   — Q&A grounded on extracted attachment text
 *   policy_chat     — answers from policy library via pgvector similarity
 *   request_builder — converts freeform description into structured request
 *   evaluate_reply  — scores requester response to reviewer return comments
 *
 * POST /functions/v1/ai-stream
 * Body: { feature, ticketId?, policyId?, message, context? }
 * Response: text/event-stream (SSE)
 *
 * Security:
 *   - Requires valid Supabase JWT (Authorization: Bearer <token>)
 *   - Caller's role is read from the users table and injected into every prompt
 *   - All invocations are written to ai_generations for audit
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.20.1'
import { corsHeaders } from '../_shared/cors.ts'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

type Feature =
  | 'pre_assessment'
  | 'copilot'
  | 'document_chat'
  | 'policy_chat'
  | 'request_builder'
  | 'evaluate_reply'

interface RequestBody {
  feature: Feature
  ticketId?: string
  policyId?: string
  message: string
  context?: Record<string, unknown>
}

// ── System prompts per feature ────────────────────────────

function systemPrompt(feature: Feature, role: string): string {
  const base = `You are an AI assistant embedded in PDPL Reviewer, an enterprise privacy compliance platform for Saudi FinTech organizations operating under the Personal Data Protection Law (Royal Decree M/19, 2021). You assist ${role} users.

Always:
- Be precise, cite specific PDPL Articles when relevant
- Flag data residency concerns (Saudi Arabia requires local storage of sensitive personal data)
- Note cross-border transfer restrictions under PDPL Article 29
- Use compliance-appropriate language
- Respond in the same language as the user's message (Arabic or English)`

  switch (feature) {
    case 'pre_assessment':
      return `${base}

You are a pre-submission AI assessor. Given a ticket's type, data declaration, and payload, produce a structured risk assessment:
1. Compliance risk level (Low / Medium / High / Critical)
2. Key PDPL obligations triggered (cite Articles)
3. Data residency requirements
4. Cross-border transfer analysis
5. Legal basis adequacy
6. Missing documentation checklist
7. Recommended mitigations

Be specific. Output in structured Markdown with clear sections.`

    case 'copilot':
      return `${base}

You are a reviewer co-pilot for a ${role}. Given a ticket's full context, help the reviewer by:
1. Summarizing the request and its risk profile
2. Highlighting compliance gaps specific to your reviewer role
3. Suggesting a decision rationale (approve / return / reject / escalate)
4. Drafting a return comment if needed
5. Citing relevant PDPL Articles and internal policies

Be direct and actionable. The reviewer will act on your advice.`

    case 'document_chat':
      return `${base}

You are a document intelligence assistant. Answer questions about uploaded documents grounded strictly in the provided document text.
- Never invent facts not present in the document
- Quote directly when possible
- Flag if the question cannot be answered from the document text alone`

    case 'policy_chat':
      return `${base}

You are a PDPL policy knowledge assistant. Answer questions using the provided policy excerpts as your primary source.
- Always cite the policy name, section, and article number
- If a question spans multiple policies, synthesize across them
- Flag gaps where no policy addresses the question
- Do not give legal advice; frame answers as policy guidance`

    case 'request_builder':
      return `${base}

You are an AI intake assistant helping a requester build a structured privacy request. Given a freeform description, extract and structure:
1. Request type (vendor_onboarding / external_document_sharing / data_sharing / internal_data_access / cross_border_transfer)
2. Title (concise, specific)
3. Description (formal, complete)
4. Data categories involved
5. Purpose of processing
6. Legal basis
7. Data subjects affected
8. Cross-border elements
9. Vendor/partner name (if applicable)

Output as JSON matching the platform's request schema. Ask clarifying questions if critical information is missing.`

    case 'evaluate_reply':
      return `${base}

You are a reply evaluator. Given the reviewer's return comment and the requester's response, score the response on:
1. Completeness (0-100): Does it address all return points?
2. Clarity (0-100): Is the response clear and unambiguous?
3. Evidence quality (0-100): Are supporting documents adequate?
4. PDPL alignment (0-100): Does the response demonstrate compliance awareness?

Overall score: weighted average. Provide brief reasoning for each dimension. Flag any red flags.
Output as JSON: { completeness, clarity, evidence, pdpl_alignment, overall, reasoning, flags }`

    default:
      return base
  }
}

// ── Grounding context fetchers ────────────────────────────

async function fetchTicketContext(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
): Promise<string> {
  const [
    { data: ticket },
    { data: slots },
    { data: thread },
    { data: attachments },
  ] = await Promise.all([
    supabase.from('tickets').select('*').eq('id', ticketId).single(),
    supabase.from('review_slots').select('*').eq('ticket_id', ticketId),
    supabase.from('return_thread_entries').select('*').eq('ticket_id', ticketId).order('created_at'),
    supabase.from('attachments').select('id,filename,classification,extracted_summary').eq('ticket_id', ticketId),
  ])

  if (!ticket) return ''

  return `
TICKET CONTEXT:
ID: ${ticket.id}
Type: ${ticket.type}
State: ${ticket.state}
Title: ${ticket.title}
Description: ${ticket.description}
Tags: ${(ticket.tags ?? []).join(', ')}

DATA DECLARATION:
${JSON.stringify(ticket.data_declaration, null, 2)}

PAYLOAD:
${JSON.stringify(ticket.payload, null, 2)}

SLA: Ack by ${ticket.sla_ack_by ?? 'N/A'} | Decision due ${ticket.sla_decision_due_at ?? 'N/A'} | Breached: ${ticket.sla_breached}

REVIEW SLOTS:
${(slots ?? []).map((s) => `  ${s.role}: ${s.verdict}${s.notes ? ` — ${s.notes}` : ''}`).join('\n')}

RETURN THREAD (${(thread ?? []).length} entries):
${(thread ?? []).slice(-5).map((e) => `  [${e.by_role}] ${e.message}`).join('\n')}

ATTACHMENTS:
${(attachments ?? []).map((a) => `  ${a.filename} (${a.classification}): ${a.extracted_summary ?? 'No summary'}`).join('\n')}
`.trim()
}

async function fetchPolicyContext(
  supabase: ReturnType<typeof createClient>,
  message: string,
  limit = 4,
): Promise<string> {
  // Simple keyword search fallback (pgvector similarity search requires embeddings pipeline)
  const { data: policies } = await supabase
    .from('policies')
    .select('code,title,category,summary,body')
    .eq('status', 'active')
    .textSearch('body', message.split(' ').slice(0, 5).join(' | '), { type: 'plain' })
    .limit(limit)

  if (!policies?.length) {
    // Fallback: return most recent active policies
    const { data: fallback } = await supabase
      .from('policies')
      .select('code,title,category,summary')
      .eq('status', 'active')
      .order('effective_date', { ascending: false })
      .limit(limit)
    return (fallback ?? []).map((p) => `[${p.code}] ${p.title} (${p.category})\n${p.summary}`).join('\n\n')
  }

  return policies.map((p) =>
    `[${p.code}] ${p.title} (${p.category})\n${p.summary}\n\n${p.body.slice(0, 600)}…`
  ).join('\n\n---\n\n')
}

// ── Main handler ──────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  // Verify caller identity
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const callerRole = profile?.role ?? 'requester'

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { feature, ticketId, message, context } = body

  // Build grounding context
  let groundingContext = ''
  if (ticketId && ['pre_assessment', 'copilot', 'document_chat', 'evaluate_reply'].includes(feature)) {
    groundingContext = await fetchTicketContext(supabase, ticketId)
  }
  if (feature === 'policy_chat') {
    groundingContext = await fetchPolicyContext(supabase, message)
  }

  const userMessage = groundingContext
    ? `${groundingContext}\n\n---\n\nUSER MESSAGE:\n${message}`
    : message

  // Record generation start for audit
  const generationId = crypto.randomUUID()
  void supabase.from('ai_generations').insert({
    id: generationId,
    feature,
    ticket_id: ticketId ?? null,
    prompt_hash: btoa(userMessage.slice(0, 200)),
    model: 'claude-sonnet-4-6',
    caller_id: user.id,
    caller_role: callerRole,
    context_snapshot: context ?? null,
    created_at: new Date().toISOString(),
  })

  // Stream from Anthropic
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt(feature, callerRole),
    messages: [{ role: 'user', content: userMessage }],
  })

  // SSE response
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let fullText = ''
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const token = event.delta.text
          fullText += token
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, generationId })}\n\n`))
      controller.close()

      // Store completed output
      void supabase.from('ai_generations').update({
        output_text: fullText,
        completed_at: new Date().toISOString(),
      }).eq('id', generationId)
    },
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})
