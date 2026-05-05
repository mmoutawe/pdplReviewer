import { useState, useRef, useEffect } from 'react'
import { authStore } from '../store'
import { useStore } from '../hooks/useStore'
import { POLICIES } from '../data/seed'
import {
  streamPolicyChat,
  retrievePolicySections,
  POLICY_CHAT_INITIAL_MESSAGES,
  type PolicyChatMessage,
} from '../api/aiPolicyChat'

export default function PolicyChatbot() {
  const { user, isSignedIn } = useStore(authStore)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PolicyChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const role = isSignedIn ? user.role : 'requester'

  // Seed initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: POLICY_CHAT_INITIAL_MESSAGES[role] ?? POLICY_CHAT_INITIAL_MESSAGES.requester }])
    }
  // Reset greeting on role change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open, messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: PolicyChatMessage = { role: 'user', content: text }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setStreaming(true)

    // Retrieve relevant policy sections
    const policySections = retrievePolicySections(
      text,
      POLICIES.map((p) => ({ code: p.code, title: p.title, summary: p.summary, body: p.body, status: p.status })),
    )

    let assistantContent = ''
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const gen = streamPolicyChat(role, newHistory, policySections)
      for await (const token of gen) {
        assistantContent += token
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
          return updated
        })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach AI service.'
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `⚠ ${errMsg}` }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
  }

  if (!isSignedIn) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close policy chatbot' : 'Open policy chatbot'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: open ? 'var(--ink-700)' : 'var(--brand-700)',
          color: '#fff', cursor: 'pointer', boxShadow: 'var(--shadow-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background var(--t-med), transform var(--t-fast)',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5l-10 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 6h14M4 10h10M4 14h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="17" cy="15" r="4" fill="var(--violet-600)"/>
            <path d="M15.5 15h3M17 13.5v3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 199,
          width: 380, height: 520, maxHeight: 'calc(100vh - 120px)',
          background: 'var(--surface-0)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--line)',
            background: 'var(--brand-700)', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="14" height="10" rx="2" stroke="white" strokeWidth="1.5"/>
              <path d="M5 16l2-4h4l2 4" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M5.5 7h7M5.5 9.5h4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>PDPL Policy Assistant</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Role-aware · Grounded on policy library</div>
            </div>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: POLICY_CHAT_INITIAL_MESSAGES[role] }])}
              aria-label="Clear chat"
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 11 }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'var(--brand-700)' : 'var(--surface-2)',
                  color: m.role === 'user' ? '#fff' : 'var(--ink-800)',
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ opacity: 0.5 }}>…</span>
                    : null
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              className="input"
              style={{ flex: 1, fontSize: 13 }}
              placeholder="Ask about PDPL compliance…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={streaming}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              style={{ flexShrink: 0, padding: '0 12px' }}
            >
              {streaming ? '…' : '→'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
