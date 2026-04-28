import { useState, useRef, useEffect } from 'react'
import type { Citation } from '../data/types'
import { ConfidenceBadge } from './primitives'
import { AI_CANNED } from '../lib/mockAi'
import { streamAI } from '../api/ai'
import { aiStreamStore, resetAIStream } from '../store'
import { useStore } from '../hooks/useStore'

// ─── Citation chip ────────────────────────────────────────────────────────────
export function CitationChip({ cite }: { cite: Citation }) {
  const cls = cite.source === 'pdpl' ? 'cite cite-pdpl' : 'cite cite-policy'
  return (
    <abbr className={cls} title={cite.excerpt}>
      {cite.ref}
    </abbr>
  )
}

// ─── AI streaming message ─────────────────────────────────────────────────────
interface StreamingProps { tokens: string[]; done: boolean; error: string | null }
export function AIStreamingMessage({ tokens, done, error }: StreamingProps) {
  if (error) return (
    <div style={{ color: 'var(--red-700)', fontSize: 13 }}>
      AI service unavailable. Please retry or complete the review manually.
    </div>
  )
  return (
    <div style={{ fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.75 }}>
      {tokens.map((t, i) => <span key={i} className="ai-token">{t}</span>)}
      {!done && <span className="ai-caret" aria-hidden="true" />}
    </div>
  )
}

// ─── AI Co-Pilot panel ────────────────────────────────────────────────────────
interface CopilotProps {
  title?: string
  cannedKey?: keyof typeof AI_CANNED
  prompt?: string
  citations?: Citation[]
  confidence?: number
  initialText?: string
  context?: string
  ticketId?: string
  feature?: 'copilot' | 'policy_chat' | 'document_chat' | 'request_builder' | 'pre_assessment' | 'evaluate_reply'
}

export function AICoPilotPanel({
  title = 'AI Co-Pilot',
  cannedKey,
  citations = [],
  confidence,
  initialText,
  context,
  ticketId,
  feature = 'copilot',
}: CopilotProps) {
  const { streaming, tokens, done, error } = useStore(aiStreamStore)
  const [started, setStarted] = useState(false)
  const [query, setQuery] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [tokens, chatHistory])

  async function triggerStream(fallbackText: string) {
    setStarted(true)
    resetAIStream()
    await streamAI({ feature, message: fallbackText, ticketId })
  }

  async function sendQuery() {
    if (!query.trim()) return
    const q = query.trim()
    setQuery('')
    setChatHistory((h) => [...h, { role: 'user', text: q }])
    resetAIStream()
    const responseText = await streamAI({ feature, message: q, ticketId })
    setChatHistory((h) => [...h, { role: 'ai', text: responseText }])
  }

  const isPolicyOrDocChat = feature === 'policy_chat' || feature === 'document_chat'

  return (
    <div className="ai-surface" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid #DDD6FE', background: 'var(--violet-50)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9l-3 1.5.5-3.5L3 4.5 6.5 4 8 1z"
            fill="var(--violet-700)" opacity=".8" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet-700)' }}>{title}</span>
        {confidence !== undefined && <ConfidenceBadge score={confidence} />}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--violet-600)', fontFamily: 'var(--font-mono)' }}>
          {streaming ? 'generating…' : done || started ? 'done' : 'ready'}
        </span>
      </div>

      {/* Context strip */}
      {context && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #DDD6FE', fontSize: 11.5, color: 'var(--ink-500)', background: 'var(--violet-50)' }}>
          <strong style={{ color: 'var(--violet-700)' }}>Context:</strong> {context}
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', padding: '14px 16px', minHeight: 0 }}>
        {/* Pre-loaded text */}
        {initialText && !started && (
          <div style={{ fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.75, marginBottom: 12 }}>
            {initialText}
          </div>
        )}

        {/* Chat history */}
        {chatHistory.map((m, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            {m.role === 'user' ? (
              <div style={{
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)', padding: '8px 12px',
                fontSize: 13, color: 'var(--ink-800)',
              }}>
                <strong style={{ color: 'var(--ink-500)', fontSize: 11, display: 'block', marginBottom: 4 }}>You</strong>
                {m.text}
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                <strong style={{ color: 'var(--violet-600)', fontSize: 11, display: 'block', marginBottom: 4 }}>AI</strong>
                <div style={{ fontSize: 13.5, color: 'var(--ink-800)', lineHeight: 1.75 }}>{m.text}</div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming output */}
        {streaming && <AIStreamingMessage tokens={tokens} done={done} error={error} />}

        {/* Auto-trigger button */}
        {!started && !initialText && !isPolicyOrDocChat && (
          <button className="btn btn-ai btn-sm"
            onClick={() => triggerStream(
              cannedKey ? (AI_CANNED[cannedKey] ?? 'Analyze this request for PDPL compliance.') : 'Analyze this request for PDPL compliance.'
            )}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1l1 2.5L9.5 4 7.5 6l.5 2.5L6 7.2 3.5 8.5 4 6 2 4l2.5-.5L6 1z" fill="white" />
            </svg>
            Generate AI assessment
          </button>
        )}
      </div>

      {/* Citations */}
      {citations.length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid #DDD6FE', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-400)', marginRight: 2 }}>Sources:</span>
          {citations.map((c) => <CitationChip key={c.id} cite={c} />)}
        </div>
      )}

      {/* Chat input */}
      {isPolicyOrDocChat && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #DDD6FE', display: 'flex', gap: 8 }}>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question…" style={{ flex: 1, height: 32, fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === 'Enter') sendQuery() }}
            aria-label="Ask the AI a question" />
          <button className="btn btn-ai btn-sm" onClick={sendQuery} disabled={!query.trim() || streaming}
            aria-label="Send">
            ↑
          </button>
        </div>
      )}
    </div>
  )
}
