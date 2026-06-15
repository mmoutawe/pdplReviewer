import type { HttpResponseInit } from '@azure/functions'

const origin = process.env.ALLOWED_ORIGIN ?? '*'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function handlePreflight(): HttpResponseInit {
  return { status: 204, headers: corsHeaders }
}

export function jsonOk(body: unknown): HttpResponseInit {
  return {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export function jsonError(status: number, message: string, detail?: unknown): HttpResponseInit {
  return {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message, ...(detail ? { detail } : {}) }),
  }
}
