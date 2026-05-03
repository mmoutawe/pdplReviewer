import { useState, useRef, useEffect } from 'react'
import type { Ticket } from '../data/types'
import { streamReviewerAssist, type AssistMessage, ROLE_INITIAL_MESSAGES } from '../api/aiReviewerAssist'

const PANEL_TITLES: Record<string, string> = {
  data_management: 'Data Management Assist',
  legal:           'Legal Assist',
  security:        'Security Assist',
  admin:           'Admin Assist',
  requester:       'Requester Assist',
}

function getReplierRole(userRole: string): string {
  return userRole === 'requester' ? 'data_management' : 'requester'
}

function buildTicketContext(ticket: Ticket): string {
  return JSON.stringify({
    type:            ticket.type,
    title:           ticket.title,
    description:     ticket.description,
    state:           ticket.state,
    payload:         ticket.payload,
    dataDeclaration: ticket.dataDeclaration,
    returnThread:    ticket.returnThread.slice(-5),
    reviews:         ticket.reviews,
    tags:            ticket.tags,
  }, null, 2)
}

interface MessageBubbleProps {
  msg: { role: 'user' | 'assistant'; content: string }
  onCopy: (text: string) => void
}

function MessageBubble({ msg, onCopy }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
    onCopy(msg.content)
  }

  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={{
          maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 2px 12px',
          background: 'var(--brand-700)', color: '#fff', fontSize: 13, lineHeight: 1.5,
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        padding: '10px 12px', borderRadius: '12px 12px 12px 2px',
        background: 'var(--violet-50)', border: '1px solid #DDD6FE',
        fontSize: 13, lineHeight: 1.65, color: 'var(--ink-800)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
      <button
        onClick={handleCopy}
        style={{
          marginTop: 4, padding: '2px 8px', fontSize: 11.5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: copied ? '#166534' : 'var(--ink-400)',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

interface Props {
  ticket: Ticket
  userRole: string
}

export function ReviewerAssistPanel({ ticket, userRole }: Props) {
  const initialMsg = ROLE_INITIAL_MESSAGES[userRole] ?? ROLE_INITIAL_MESSAGES.data_management
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: initialMsg },
  ])
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  async function send() {
    if (!input.trim() || streaming) return
    const text = input.trim()
    setInput('')
    setError(null)
    const userMsg: AssistMessage = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setStreaming(true)
    setStreamText('')

    try {
      const context     = buildTicketContext(ticket)
      const replierRole = getReplierRole(userRole)
      // Send history excluding the initial UI-only greeting
      const apiHistory  = nextMessages.slice(1) as AssistMessage[]
      let full = ''
      for await (const token of streamReviewerAssist(userRole, replierRole, context, apiHistory)) {
        full += token
        setStreamText(full)
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: full }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response.')
    } finally {
      setStreaming(false)
      setStreamText('')
    }
  }

  return (
    <div className="ai-surface" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid #DDD6FE', background: 'var(--violet-50)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1l1.5 3 3.5.5-2.5 2.5.5 3.5L8 9l-3 1.5.5-3.5L3 4.5 6.5 4 8 1z" fill="var(--violet-700)" opacity=".8" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--violet-700)' }}>
          {PANEL_TITLES[userRole] ?? 'Reviewer Assist'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--violet-500)', fontFamily: 'var(--font-mono)' }}>
          {streaming ? 'generating…' : 'ready'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 4px', minHeight: 0 }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} onCopy={() => {}} />
        ))}

        {/* Streaming response */}
        {streaming && streamText && (
          <div style={{
            padding: '10px 12px', borderRadius: '12px 12px 12px 2px',
            background: 'var(--violet-50)', border: '1px solid #DDD6FE',
            fontSize: 13, lineHeight: 1.65, color: 'var(--ink-800)',
            whiteSpace: 'pre-wrap', marginBottom: 12,
          }}>
            {streamText}
            <span style={{
              display: 'inline-block', width: 2, height: '1em',
              background: 'var(--violet-700)', verticalAlign: 'text-bottom',
              marginLeft: 1, animation: 'blink 1s step-end infinite',
            }} aria-hidden="true" />
          </div>
        )}

        {streaming && !streamText && (
          <div style={{ fontSize: 13, color: 'var(--ink-400)', marginBottom: 10 }}>···</div>
        )}

        {error && (
          <div role="alert" style={{
            fontSize: 12.5, color: 'var(--red-700)', background: 'var(--red-50)',
            border: '1px solid #FECACA', borderRadius: 'var(--r-sm)',
            padding: '8px 10px', marginBottom: 10,
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #DDD6FE',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder="Ask for help drafting a response…"
          style={{ flex: 1, height: 32, fontSize: 13 }}
          disabled={streaming}
          aria-label="Ask the reviewer assist AI"
        />
        <button
          className="btn btn-ai btn-sm"
          onClick={() => void send()}
          disabled={!input.trim() || streaming}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
