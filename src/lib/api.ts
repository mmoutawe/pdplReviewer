// REST client for the Node.js backend.
// All calls go to /api (proxied by Vite in dev, nginx in production).

const API_BASE = '/api'

let _token: string | null = localStorage.getItem('auth_token')

export function setAuthToken(token: string | null): void {
  _token = token
  if (token) localStorage.setItem('auth_token', token)
  else localStorage.removeItem('auth_token')
}

export function getAuthToken(): string | null {
  return _token
}

// Always true in on-prem — no demo-mode gate needed
export const isBackendConfigured = true

async function apiFetch(path: string, opts: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers }

  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })

  if (res.status === 401) {
    setAuthToken(null)
    if (!path.startsWith('/auth')) window.location.href = '/sign-in'
    throw new Error('Unauthorized')
  }
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  return res.json() as Promise<T>
}

export async function apiPost<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body:   body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function apiPatch<T = void>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) })
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export async function apiDelete(path: string): Promise<void> {
  await apiFetch(path, { method: 'DELETE' })
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: form })
  return res.json() as Promise<T>
}

// Proxy an OpenAI-compatible request through the backend
export async function apiComplete(body: {
  messages: unknown[]
  tools?: unknown[]
  tool_choice?: unknown
  response_format?: unknown
  max_tokens?: number
}): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>('/ai/complete', body)
}

// Stream an OpenAI-compatible request through the backend SSE endpoint
export async function* apiStreamMessages(
  messages: unknown[],
  maxTokens = 2048,
): AsyncGenerator<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${API_BASE}/ai/stream-raw`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ messages, max_tokens: maxTokens }),
  })

  if (res.status === 401) {
    setAuthToken(null)
    window.location.href = '/sign-in'
    return
  }
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${body}`)
  }

  const reader  = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json) continue
      try {
        const data = JSON.parse(json) as { token?: string; done?: boolean; error?: string }
        if (data.error) throw new Error(data.error)
        if (data.done)  return
        if (data.token) yield data.token
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
}

export function startPolling(fn: () => Promise<void>, intervalMs = 15_000): () => void {
  void fn()
  const id = setInterval(() => void fn(), intervalMs)
  return () => clearInterval(id)
}
