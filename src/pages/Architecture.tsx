import { useEffect, useState } from 'react'

const NAV = [
  { id: 'product-vision', label: '1. Product Vision' },
  { id: 'system-architecture', label: '2. System Architecture' },
  { id: 'information-architecture', label: '3. Information Architecture' },
  { id: 'ux-flows', label: '4. UX Flows' },
  { id: 'screen-breakdown', label: '5. Screen Breakdown' },
  { id: 'database-schema', label: '6. Database Schema' },
  { id: 'security-model', label: '7. Security Model' },
  { id: 'ai-system', label: '8. AI System Design' },
  { id: 'notification-arch', label: '9. Notification Architecture' },
  { id: 'audit-arch', label: '10. Audit Architecture' },
  { id: 'backend-services', label: '11. Backend Services' },
  { id: 'frontend-arch', label: '12. Frontend Architecture' },
  { id: 'edge-cases', label: '13. Edge Cases' },
  { id: 'scalability', label: '14. Scalability Strategy' },
  { id: 'future-expansion', label: '15. Future Expansion' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 52, scrollMarginTop: 72 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', paddingBottom: 10, borderBottom: '2px solid var(--brand-700)', marginBottom: 20 }}>{title}</h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 10, paddingLeft: 10, borderLeft: '3px solid var(--brand-200)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.75, marginBottom: 10 }}>{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13.5, color: 'var(--ink-700)', lineHeight: 1.75, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: item }} />
      ))}
    </ul>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre style={{
      background: 'var(--ink-900)', color: 'var(--ink-100)', borderRadius: 'var(--radius)',
      padding: '14px 18px', overflowX: 'auto', fontSize: 12, lineHeight: 1.6,
      fontFamily: 'var(--font-mono)', marginBottom: 14,
    }}>
      {code}
    </pre>
  )
}

function InfoBox({ kind, children }: { kind: 'info' | 'warn' | 'danger'; children: React.ReactNode }) {
  const colors = {
    info: { bg: 'var(--brand-50)', border: 'var(--brand-200)', color: 'var(--brand-700)', icon: 'ℹ' },
    warn: { bg: 'var(--amber-50)', border: 'var(--amber-200)', color: 'var(--amber-700)', icon: '⚠' },
    danger: { bg: 'var(--red-50)', border: 'var(--red-200)', color: 'var(--red-700)', icon: '✕' },
  }[kind]
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: 13, color: colors.color, lineHeight: 1.6 }}>
      {colors.icon} {children}
    </div>
  )
}

export default function Architecture() {
  useEffect(() => { document.title = 'Architecture — PDPL Reviewer' }, [])
  const [activeSection, setActiveSection] = useState('product-vision')

  useEffect(() => {
    const handleScroll = () => {
      for (const { id } of [...NAV].reverse()) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 100) {
          setActiveSection(id)
          break
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>
      {/* TOC sidebar */}
      <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', borderRight: '1px solid var(--line)', padding: '20px 0' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-400)', padding: '0 16px', marginBottom: 10 }}>Contents</div>
        {NAV.map(({ id, label }) => (
          <a key={id} href={`#${id}`}
            onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            style={{
              display: 'block', padding: '5px 16px', fontSize: 12.5,
              color: activeSection === id ? 'var(--brand-700)' : 'var(--ink-500)',
              background: activeSection === id ? 'var(--brand-50)' : 'transparent',
              borderLeft: `3px solid ${activeSection === id ? 'var(--brand-700)' : 'transparent'}`,
              textDecoration: 'none', lineHeight: 1.5,
              transition: 'all var(--t-fast)',
            }}>
            {label}
          </a>
        ))}
      </aside>

      {/* Content */}
      <div style={{ flex: 1, padding: '32px 48px', maxWidth: 860, minWidth: 0 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brand-700)', marginBottom: 6 }}>Architecture Reference</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.2, marginBottom: 10 }}>PDPL Reviewer</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-500)', lineHeight: 1.65 }}>
            Enterprise architecture specification for the AI-powered privacy compliance platform serving Saudi FinTech organizations under PDPL.
          </p>
        </div>

        {/* ── 1. Product Vision ──────────────────────── */}
        <Section id="product-vision" title="1. Product Vision">
          <Para>
            PDPL Reviewer replaces fragmented email-and-spreadsheet compliance workflows with a centralized, auditable platform for intake, AI-assisted assessment, multi-disciplinary review, and archived decision-making under Saudi Arabia's Personal Data Protection Law (PDPL — نظام حماية البيانات الشخصية).
          </Para>
          <SubSection title="Problem statement">
            <Para>Saudi FinTech organizations processing personal data must comply with PDPL across five categories of data processing activities: vendor onboarding, external document sharing, data sharing with external parties, internal data access, and cross-border transfers. Without a dedicated platform, these reviews happen asynchronously via email, creating: version-control gaps, lost audit trails, SLA breaches, undocumented reviewer decisions, and regulator-auditable evidence that is scattered across inboxes.</Para>
          </SubSection>
          <SubSection title="Core value propositions">
            <Ul items={[
              '<strong>Centralized intake</strong> — structured 7-step wizard with typed payloads per request category, AI-assisted form completion, and autosaved drafts',
              '<strong>AI-assisted compliance</strong> — pre-submission PDPL gap analysis with Article citations, reviewer co-pilot, document Q&A, and policy chatbot',
              '<strong>Multi-disciplinary workflow</strong> — parallel legal + security review tracks with dependency resolution, SLA enforcement, and escalation logic',
              '<strong>Regulator-ready audit</strong> — append-only, hash-chained audit ledger recording every state transition, decision, and AI generation with before/after snapshots',
              '<strong>Secure external approvals</strong> — time-limited, single-use signed links for external recipient decisions without granting platform access',
            ]} />
          </SubSection>
          <SubSection title="Target persona summary">
            <Ul items={[
              '<strong>Requester</strong> — submits requests, responds to returns, tracks status',
              '<strong>Data Management Reviewer</strong> — first-line review, completeness check, AI assessment, approve/return/escalate/split',
              '<strong>Legal Reviewer</strong> — PDPL legal basis, contract validity, cross-border legality',
              '<strong>Security Reviewer</strong> — technical controls, encryption, data residency, access management',
              '<strong>Admin</strong> — user management, policy library, AI settings, audit access control, retention configuration',
              '<strong>External Recipient</strong> — time-limited approval/rejection via signed URL; zero platform login',
            ]} />
          </SubSection>
        </Section>

        {/* ── 2. System Architecture ──────────────────── */}
        <Section id="system-architecture" title="2. System Architecture">
          <SubSection title="Logical tiers">
            <CodeBlock code={`┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION TIER                      │
│  React 18 SPA · TypeScript · Vite · IBM Plex Sans        │
│  React Router v7 · CSS custom properties design tokens   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / REST / Realtime WS
┌────────────────────────▼────────────────────────────────┐
│                      API GATEWAY                          │
│  Edge functions (Supabase / Cloudflare Workers)          │
│  Auth middleware · RLS enforcement · Rate limiting        │
└──┬──────────────────┬────────────────────┬──────────────┘
   │                  │                    │
┌──▼──────┐    ┌──────▼──────┐    ┌───────▼──────┐
│ Postgres │    │  AI Gateway │    │  File Store  │
│ + RLS    │    │ Multi-model │    │  Signed URLs │
│ Supabase │    │ Streaming   │    │  Scan queue  │
└──────────┘    └─────────────┘    └──────────────┘`} />
          </SubSection>
          <SubSection title="Data flow — ticket lifecycle">
            <Para>Requester completes wizard → draft saved to Postgres (state: draft) → submission triggers pre-submission AI assessment → state transitions to submitted → cron assigns to data_management queue (state: in_data_management) → reviewer acts (approve/return/reject/escalate) → parallel legal + security review forks (in_legal_review + in_security_review) → both verdicts received → aggregation logic → final_decision → approved/rejected → archived after retention window.</Para>
          </SubSection>
          <SubSection title="Deployment target">
            <Para>Power Pages compatible SPA. Compiled output goes to <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>dist/</code> per <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>powerpages.config.json</code>. Backend hosted on Supabase with Edge Functions for AI orchestration and webhook fanout.</Para>
          </SubSection>
        </Section>

        {/* ── 3. Information Architecture ─────────────── */}
        <Section id="information-architecture" title="3. Information Architecture">
          <SubSection title="Navigation hierarchy by role">
            <CodeBlock code={`Requester
  /dashboard          My open tickets, SLA status, recent activity
  /requests           My ticket list with status filters
  /requests/new       7-step wizard
  /requests/:id       Ticket workspace (read: overview/evidence/ai/returns)
  /policies           Policy library (read-only)
  /notifications      Notification center

Data Management Reviewer
  /queue/data_management   Reviewer queue (submitted + in_data_management)
  /requests/:id             Full workspace (read+write all tabs)
  /vendors                  Vendor library
  /vendors/:id              Vendor profile
  /projects                 Project library
  /audit                    Audit ledger (read)

Legal Reviewer
  /queue/legal              Queue (in_legal_review)
  /requests/:id             Workspace (reviews tab writable)
  /policies, /vendors       Read access

Security Reviewer
  /queue/security           Queue (in_security_review)
  /requests/:id             Workspace (reviews tab writable)

Admin
  /admin                    User/policy/retention/AI/audit-access management
  /audit                    Full ledger
  All routes accessible

External Recipient (unauthenticated)
  /external/:token          Link redemption gate
  /external/approve/:token  Approval form`} />
          </SubSection>
          <SubSection title="Content taxonomy">
            <Ul items={[
              '<strong>Tickets</strong> — the primary entity; structured payloads, lifecycle state, SLA, review slots, audit trail',
              '<strong>Policies</strong> — internal PDPL-aligned policy documents with embeddings for chatbot grounding',
              '<strong>Vendors</strong> — third-party processor registry with risk scoring, DPA status, certifications',
              '<strong>Projects</strong> — business unit project containers grouping related tickets',
              '<strong>Attachments</strong> — scanned, classified, extracted-summary documents linked to tickets',
              '<strong>Audit events</strong> — immutable, hash-chained entries covering every critical action',
            ]} />
          </SubSection>
        </Section>

        {/* ── 4. UX Flows ─────────────────────────────── */}
        <Section id="ux-flows" title="4. UX Flows">
          <SubSection title="Requester wizard flow">
            <CodeBlock code={`Step 1: Type selection
  → 5 cards: Vendor Onboarding / External Sharing / Data Sharing /
    Internal Access / Cross-Border Transfer
  → Selection stores requestType, advances to Step 2

Step 2: Creation method
  → Manual: proceed to typed form
  → AI Request Builder: conversational intake → pre-populates Step 3 fields

Step 3: Typed initiation form (fields vary by request type)
  → title, description, vendor/recipient, jurisdiction, tags
  → File upload: EvidenceUploader (virus-scan queue, classification)
  → Autosave to sessionStorage every 30s

Step 4: Data declaration questionnaire
  → Data categories (financial / health / biometric / national ID / …)
  → Estimated subject count, retention period
  → Cross-border flag, consent obtained, DPA in place
  → AI side panel (policy_chat) available

Step 5: AI pre-submission assessment
  → Triggers AI assessment for request type
  → Findings displayed with severity / PDPL citation / remediation
  → Requester can acknowledge and continue or revise earlier steps
  → Confidence badge shown; low-confidence triggers disclaimer

Step 6: Submission confirmation snapshot
  → Read-only summary of all declared fields
  → "Once submitted this cannot be edited" warning
  → Submit button → optimistic state update → ticket created

Step 7: Returned-response handling
  → Reviewer returns ticket with comments and required changes
  → Requester sees CommentThread, adds reply + new attachments
  → AI Evaluate Reply panel scores the response
  → Resubmit → state transitions back to in_data_management`} />
          </SubSection>
          <SubSection title="Reviewer flow">
            <CodeBlock code={`Entry: ReviewerQueue (/queue/:role)
  → SLA-sorted list (breached first, then by due time)
  → KPI strip: in queue / SLA breached / at-risk < 24h

Ticket workspace tabs:
  Overview  — full payload, data declaration, reviewer status grid
  Evidence  — attachment list with scan status, extracted summaries
  AI        — assessment findings + Reviewer Co-Pilot chat
  Reviews   — verdict history, parallel review status
  Returns   — full return thread (read-only after resubmission)
  Audit     — filtered audit timeline for this ticket

Actions (role-gated):
  Approve   → state: approved / in_legal_review / in_security_review
  Return    → state: returned_to_requester (requires comment)
  Reject    → state: rejected (requires reason)
  Escalate  → admin notified, SLA extended
  Split     → creates sub-ticket (data_management only)`} />
          </SubSection>
        </Section>

        {/* ── 5. Screen Breakdown ──────────────────────── */}
        <Section id="screen-breakdown" title="5. Screen-by-Screen Breakdown">
          {[
            { route: '/sign-in', component: 'SignIn', desc: 'Demo persona picker. Lists all 10 non-external users with Avatar, role badge, department. No password in demo mode. Persists to sessionStorage.' },
            { route: '/dashboard', component: 'Dashboard', desc: 'Role-shaped KPI strip (open requests, SLA at risk, approved, rejected, unread alerts). 2-column grid: my open tickets list + SLA at-risk + recent audit activity. Unread notifications strip.' },
            { route: '/requests', component: 'RequestList', desc: 'EnterpriseTable with ID/title/status/SLA/date columns. FilterBar with state + type dropdowns. Requester sees only own tickets. Reviewers see all.' },
            { route: '/requests/new', component: 'Wizard (multi-step)', desc: '7-step wizard with Stepper indicator, sessionStorage autosave, per-step validation. AI side panel during steps 4–5. Post-submit success screen.' },
            { route: '/requests/:id', component: 'TicketWorkspace', desc: '6-tab workspace. Header with breadcrumb, ticket ID, status pill, SLA indicator, action buttons. Role-gated write operations.' },
            { route: '/requests/:id/respond', component: 'ReturnedResponse', desc: 'Return thread with CommentThread (reply-enabled). EvidenceUploader for new attachments. AI Evaluate Reply panel. Resubmit flow.' },
            { route: '/queue/:role', component: 'ReviewerQueue', desc: 'Role-filtered ticket queue. SLA urgency bars (red/amber/green). KPI strip. Sort by SLA or date. QueueRow with reviewer avatar.' },
            { route: '/policies', component: 'PolicyLibrary', desc: 'Card list with code tag, status pill, version, effective date, title, summary, owner + citation count. Search + category filter.' },
            { route: '/policies/:id', component: 'PolicyViewer', desc: 'Policy body + metadata dl. AICoPilotPanel (policy_chat) on the right side.' },
            { route: '/vendors', component: 'VendorLibrary', desc: 'Vendor cards with RiskMeter, risk tier pill, certifications tags, DPA status badge. Search filter.' },
            { route: '/vendors/:id', component: 'VendorProfile', desc: 'Risk profile card (RiskMeter, DPA, category, last reviewed). Certifications card. Notes. Linked tickets list.' },
            { route: '/projects', component: 'ProjectLibrary', desc: 'Project cards with status pill, description, business unit, ticket count, created date. Search + status filter.' },
            { route: '/projects/:id', component: 'ProjectProfile', desc: 'Project details, owner avatar card, request breakdown by state, full linked ticket list with StatusPill + SLAIndicator.' },
            { route: '/audit', component: 'AuditLedger', desc: 'Append-only timeline. Dot-spine layout with urgency colors. Hash display. Expandable before/after JSON diffs. Search + action filter.' },
            { route: '/notifications', component: 'NotificationCenter', desc: 'Full notification list for active user. Unread dot + background tint. Kind icon + label + message + actor avatar + timestamp. Mark-all-read.' },
            { route: '/admin', component: 'Admin', desc: 'Tabbed: Users & Roles / Policies / Retention / AI Settings / Audit Access. KPI strip. Role-grouped user list. Toggle switches for AI features. Retention schedule table.' },
            { route: '/external/:token', component: 'ExternalRedeem', desc: 'Unauthenticated gate. Validates token, checks expiry + redeemed status. Shows ticket summary and proceed button. Redirects to approval page.' },
            { route: '/external/approve/:token', component: 'ExternalApproval', desc: 'Approve / Reject decision UI. Data declaration summary. Comments field. Electronic signature (name). Submission confirmation with reference ID.' },
            { route: '/architecture', component: 'Architecture', desc: 'This document. Sticky TOC sidebar. 15-section scrollable architecture specification.' },
          ].map(({ route, component, desc }) => (
            <div key={route} style={{ marginBottom: 14, padding: '12px 16px', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--brand-200)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brand-700)', background: 'var(--brand-50)', padding: '2px 6px', borderRadius: 3 }}>{route}</code>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)' }}>{component}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </Section>

        {/* ── 6. Database Schema ──────────────────────── */}
        <Section id="database-schema" title="6. Database Schema">
          <SubSection title="Core tables">
            <CodeBlock code={`-- Users and auth
users (id, email, full_name, role, department, avatar_color, is_active, created_at)
sessions (id, user_id, created_at, expires_at, ip_address)

-- Tickets (the primary entity)
tickets (
  id, title, description, type, state, requester_id, project_id, vendor_id,
  submitted_at, created_at, updated_at,
  data_declaration JSONB,  -- categories[], subject_count, retention, flags
  payload JSONB,           -- type-specific fields (VendorOnboardingPayload, etc.)
  tags text[],
  sla_decision_due_at, sla_breached bool, sla_extended_reason
)
ticket_state_history (id, ticket_id, from_state, to_state, actor_id, occurred_at, reason)

-- Sub-tickets (splits)
sub_tickets (id, parent_ticket_id, child_ticket_id, split_reason, created_by, created_at)

-- Reviews
review_slots (id, ticket_id, role, reviewer_id, verdict, comment, decided_at)

-- Return threads
return_thread_entries (
  id, ticket_id, author_id, body, attachments text[],
  ai_score NUMERIC, ai_label text, created_at
)

-- Attachments
attachments (
  id, ticket_id, filename, size_bytes, mime_type,
  scan_status, classification, category, extracted_summary,
  signed_url_expires_at, uploaded_by, uploaded_at
)

-- AI
ai_generations (
  id, ticket_id, feature, model, prompt_hash,
  output text, citations JSONB, confidence_score NUMERIC,
  latency_ms int, created_at
)
pre_submission_assessments (
  id, ticket_id, risk_tier, findings JSONB, summary, created_at
)

-- Policies, vendors, projects
policies (id, code, title, version, status, category, summary, body,
          owner_dept, effective_date, citation_count, embeddings_built)
vendors (id, trade_name, legal_name, jurisdiction, status, risk_tier, risk_score,
         has_dpa, category, certifications text[], last_reviewed_at, notes)
projects (id, name, description, business_unit, status, owner_user_id, created_at)

-- Audit (append-only)
audit_events (
  id, ticket_id, actor_id, action, occurred_at,
  before JSONB, after JSONB, metadata JSONB, immutable_hash text
)

-- Notifications
notifications (
  id, recipient_id, actor_id, ticket_id, kind, message, read, created_at
)

-- External links
external_links (
  id, ticket_id, token, recipient_email, permissions text[],
  status, created_by, expires_at, redeemed_at, redeemed_ip
)`} />
          </SubSection>
          <SubSection title="Indexing strategy">
            <Ul items={[
              'tickets: INDEX ON (state, requester_id), (state, created_at), (project_id), (vendor_id)',
              'audit_events: INDEX ON (ticket_id, occurred_at DESC), (actor_id)',
              'notifications: INDEX ON (recipient_id, read, created_at DESC)',
              'review_slots: INDEX ON (ticket_id, role)',
              'external_links: UNIQUE INDEX ON (token)',
              'policies: GIN index on body for full-text search; vector column for embeddings',
            ]} />
          </SubSection>
          <SubSection title="Row-level security notes">
            <Ul items={[
              'Requesters: SELECT on own tickets only (requesterId = auth.uid())',
              'Reviewers: SELECT/UPDATE on tickets in their queue states',
              'Admin: unrestricted SELECT on all tables',
              'External recipients: no direct DB access — read via edge function, scoped to specific ticketId embedded in JWT',
              'audit_events: INSERT only (no UPDATE/DELETE for any role, including admin)',
            ]} />
          </SubSection>
        </Section>

        {/* ── 7. Security Model ───────────────────────── */}
        <Section id="security-model" title="7. Security Model">
          <SubSection title="Authentication and session management">
            <Para>JWT-based authentication issued by Supabase Auth. Sessions stored in httpOnly cookies (not localStorage). Access tokens expire in 1 hour; refresh tokens in 7 days. External recipient sessions are scoped to a single ticketId and expire when the link expires.</Para>
          </SubSection>
          <SubSection title="Role-based access control">
            <Para>Roles are stored on the users table and enforced at three layers: (1) React RequireAuth guard for client-side route protection; (2) Edge function middleware checks role claim in JWT before any mutation; (3) Postgres RLS policies enforce at the data layer — the only authoritative boundary.</Para>
            <InfoBox kind="danger">Client-side role checks are UX only. All authorization decisions must be enforced server-side and at the RLS layer. A compromised frontend cannot escalate privileges.</InfoBox>
          </SubSection>
          <SubSection title="Signed URLs and file access">
            <Para>Attachments are stored in private Supabase storage buckets. Signed URLs (15-min TTL) are generated server-side per request via an edge function that verifies the caller has access to the parent ticket. Direct bucket access is denied. Virus scan results are checked before a signed URL is issued.</Para>
          </SubSection>
          <SubSection title="External link security">
            <Ul items={[
              'Tokens are 32-char cryptographically random hex strings (CSPRNG)',
              'Tokens are hashed (SHA-256) before storage; plaintext never persisted',
              'Single-use: once redeemed, status = "redeemed", subsequent attempts rejected',
              'Expiry enforced at token-generation time (default: 72h)',
              'Permissions field scopes what the recipient can see (no internal data leaked)',
              'Recipient IP is logged on redemption for audit purposes',
              'External JWT claims: { sub: token_id, ticketId, permissions[], exp } — no internal user_id or role',
            ]} />
          </SubSection>
          <SubSection title="Input validation and injection prevention">
            <Ul items={[
              'All user inputs sanitized at edge function layer before DB write',
              'Parameterized queries only (Supabase JS client uses $1 bindings)',
              'Attachment filenames sanitized before storage; content-type validated',
              'AI prompts never include raw user input inline; user content is injected as context slot only',
              'dangerouslySetInnerHTML is never used with user-controlled content',
            ]} />
          </SubSection>
        </Section>

        {/* ── 8. AI System Design ─────────────────────── */}
        <Section id="ai-system" title="8. AI System Design">
          <SubSection title="AI surfaces and placement">
            {[
              { feature: 'AI Request Builder', placement: 'Step 2 of wizard — full-screen conversational UI', grounding: 'Request type schema', purpose: 'Converts freeform description into structured payload' },
              { feature: 'Pre-Submission Assessment', placement: 'Step 5 of wizard — findings panel below form', grounding: 'PDPL Articles + policy embeddings + request payload', purpose: 'Gap analysis with severity + citations before submission' },
              { feature: 'Reviewer Co-Pilot', placement: 'TicketWorkspace AI tab — persistent side panel', grounding: 'Ticket payload + prior reviews + vendor profile + PDPL Articles', purpose: 'Role-aware review guidance, checklist generation, risk flagging' },
              { feature: 'Document Chat', placement: 'Evidence tab — chat panel per attachment', grounding: 'Extracted attachment text (chunked, indexed)', purpose: 'Q&A grounded on specific document content' },
              { feature: 'Policy Chatbot', placement: 'PolicyViewer right side panel', grounding: 'Policy body + PDPL Articles', purpose: 'Answers policy questions with article-level citations' },
              { feature: 'Evaluate Reply', placement: 'ReturnedResponse page — right side panel', grounding: 'Original return comments + requester reply text', purpose: 'Scores completeness/quality of requester response (0–1 confidence)' },
            ].map(({ feature, placement, grounding, purpose }) => (
              <div key={feature} style={{ marginBottom: 14, padding: '12px 16px', background: 'var(--violet-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--violet-200)' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--violet-700)', marginBottom: 4 }}>{feature}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6 }}>
                  <strong>Placement:</strong> {placement}<br />
                  <strong>Grounding:</strong> {grounding}<br />
                  <strong>Purpose:</strong> {purpose}
                </div>
              </div>
            ))}
          </SubSection>
          <SubSection title="Streaming architecture">
            <Para>All AI responses stream token-by-token via Server-Sent Events (SSE). The edge function calls the AI gateway (model: claude-opus-4-7 or claude-sonnet-4-6 depending on feature), receives a stream, and forwards it to the browser. The aiStreamStore accumulates tokens; the AIStreamingMessage component renders each token with a fade-in animation and blinking caret.</Para>
          </SubSection>
          <SubSection title="Hallucination mitigation">
            <Ul items={[
              'All AI responses grounded on retrieved context (PDPL articles, policy text, ticket payload) — model instructed to cite only provided context',
              'Confidence scores &lt; 0.7 trigger an automated disclaimer: "This is an AI-generated suggestion. Verify with your legal team."',
              'Citations rendered as chips linking to the source article or policy — reviewer can verify inline',
              'Structured output for assessments (JSON schema enforced via tool-use) eliminates free-form hallucination in findings',
              'Fallback: if AI gateway errors, component shows "AI unavailable — please review manually" with no partial output displayed',
            ]} />
          </SubSection>
          <SubSection title="Prompt architecture">
            <CodeBlock code={`// Reviewer Co-Pilot system prompt structure
SYSTEM:
  You are a PDPL compliance reviewer assistant. Role: {role}.
  Today: {date}. Organization: Saudi FinTech.

CONTEXT BLOCK (RAG-retrieved):
  [PDPL Articles relevant to this request type]
  [Matched policy documents (top-k cosine similarity)]
  [Vendor profile if applicable]

TICKET PAYLOAD:
  [Structured ticket JSON — requester inputs]

PRIOR REVIEWS:
  [Previous reviewer comments for this ticket]

USER QUERY:
  {reviewer_question}

INSTRUCTIONS:
  Respond only from context provided. Cite article/policy for each claim.
  Output confidence: 0.0–1.0 at the end of your response.
  If context is insufficient, say so explicitly.`} />
          </SubSection>
        </Section>

        {/* ── 9. Notification Architecture ────────────── */}
        <Section id="notification-arch" title="9. Notification Architecture">
          <SubSection title="Notification kinds and triggers">
            <Ul items={[
              '<strong>ticket_submitted</strong> — requester submits; data_management reviewers notified',
              '<strong>state_change</strong> — any state transition; requester + assigned reviewers notified',
              '<strong>review_complete</strong> — a review slot verdict submitted; data_management lead notified',
              '<strong>sla_warning</strong> — cron runs every 15 min; fires when &lt; 24h to SLA deadline',
              '<strong>return_received</strong> — reviewer returns ticket; requester notified',
              '<strong>approval_granted / rejection_issued</strong> — final decision; requester + admin notified',
              '<strong>external_link_opened</strong> — external recipient redeems link; creating reviewer notified',
              '<strong>comment_added</strong> — return thread reply; counterparty notified',
              '<strong>assignment_changed</strong> — ticket re-assigned; new reviewer notified',
            ]} />
          </SubSection>
          <SubSection title="Delivery architecture">
            <Para>Notifications are inserted into the notifications table by edge functions (triggered by DB webhooks on ticket state transitions). Realtime delivery uses Supabase Realtime (Postgres LISTEN/NOTIFY wrapped in WebSocket). The NotificationBell component subscribes to the channel on mount. Fan-out to email uses a separate notification edge function that batches sends via a transactional email provider (Resend / SendGrid).</Para>
          </SubSection>
          <SubSection title="Retry and deduplication">
            <Ul items={[
              'Each notification has a composite unique key (recipient_id, ticket_id, kind, date_trunc(created_at, hour)) preventing duplicate sends within 1 hour',
              'Email delivery tracked in a separate email_log table with retry_count and last_error',
              'Dead-letter queue for emails that fail after 3 retries — admin notified',
            ]} />
          </SubSection>
        </Section>

        {/* ── 10. Audit Architecture ──────────────────── */}
        <Section id="audit-arch" title="10. Audit Architecture">
          <SubSection title="Immutability guarantee">
            <Para>The audit_events table has BEFORE UPDATE and BEFORE DELETE triggers that raise exceptions, making every row effectively append-only at the database layer. The application layer never issues UPDATE or DELETE on audit_events. Postgres replication can ship the WAL to a read replica for regulators.</Para>
          </SubSection>
          <SubSection title="Hash chaining">
            <Para>Each audit event stores an <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>immutable_hash</code> computed as:</Para>
            <CodeBlock code={`SHA256(
  prev_hash || id || ticket_id || actor_id || action ||
  occurred_at || JSON(before) || JSON(after)
)`} />
            <Para>Tampering with any field changes the hash, which breaks the chain from that point forward. The audit ledger UI displays the first 16 chars of each hash for visual verification.</Para>
          </SubSection>
          <SubSection title="What is recorded">
            <Ul items={[
              'Every ticket state transition (before/after state snapshot)',
              'Every reviewer decision (verdict, comment, timestamp)',
              'Every AI generation invocation (model, feature, prompt hash, confidence)',
              'Every attachment upload (filename, scan result, classifier output)',
              'Every return thread message',
              'External link creation and redemption (with IP)',
              'Admin actions (user role changes, policy updates, AI setting toggles)',
              'Every sign-in event',
            ]} />
          </SubSection>
          <SubSection title="Regulator export">
            <Para>Admin can export the full ledger as a CSV from the Admin panel. For regulator-facing exports, a signed PDF report can be generated via an edge function that combines the ticket payload, all audit events, and reviewer decisions into a structured evidence package.</Para>
          </SubSection>
        </Section>

        {/* ── 11. Backend Services ────────────────────── */}
        <Section id="backend-services" title="11. Backend Services">
          <SubSection title="Edge functions">
            {[
              { name: 'POST /tickets', desc: 'Create/update ticket draft, enforce state guards, fire audit event, send notifications' },
              { name: 'POST /tickets/:id/submit', desc: 'Transition draft → submitted, run pre-submission AI assessment, set SLA clock' },
              { name: 'POST /tickets/:id/decision', desc: 'Role-gated verdict: approve/return/reject. Enforces allowed transitions. Updates review_slots.' },
              { name: 'POST /ai/stream', desc: 'AI gateway proxy: receives feature + context, streams SSE tokens, logs generation to ai_generations' },
              { name: 'GET /attachments/:id/url', desc: 'Issues 15-min signed URL after verifying caller access' },
              { name: 'POST /external-links', desc: 'Creates single-use token, hashes + stores, sends email to recipient' },
              { name: 'POST /external-links/:token/redeem', desc: 'Validates token, checks expiry, issues scoped JWT, marks pending' },
              { name: 'CRON /sla-monitor', desc: 'Runs every 15min: finds tickets within 24h of SLA breach, fires sla_warning notifications' },
            ].map(({ name, desc }) => (
              <div key={name} style={{ marginBottom: 10, display: 'flex', gap: 12 }}>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--brand-700)', background: 'var(--brand-50)', padding: '3px 7px', borderRadius: 3, flexShrink: 0, alignSelf: 'flex-start', marginTop: 1 }}>{name}</code>
                <span style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6 }}>{desc}</span>
              </div>
            ))}
          </SubSection>
          <SubSection title="File processing pipeline">
            <CodeBlock code={`Upload → Storage bucket (pre-signed PUT URL)
         → Trigger: file_uploaded webhook
         → Edge function: virus scan (ClamAV or 3rd-party API)
         → If clean: classify (content-type, sensitivity)
         → Extract text (Tika / PDF.js for PDFs, docx parser for Word)
         → Chunk text → embed → store vectors in pgvector
         → Update attachment: scan_status, classification, extracted_summary
         → Notify uploader`} />
          </SubSection>
        </Section>

        {/* ── 12. Frontend Architecture ───────────────── */}
        <Section id="frontend-arch" title="12. Frontend Architecture">
          <SubSection title="State management">
            <Para>Lightweight reactive store factory (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>createStore&lt;T&gt;</code>) using publish/subscribe with a React hook (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>useStore</code>) that triggers re-renders via <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>useReducer</code>. Stores: authStore, ticketStore, notifStore, toastStore, aiStreamStore. No external state library required.</Para>
          </SubSection>
          <SubSection title="Component hierarchy">
            <CodeBlock code={`App
├── Layout (auth gate + ToastStack)
│   ├── Shell (TopBar + LeftRail)
│   │   └── <Outlet /> → pages
│   └── Passthrough (sign-in + external routes)
│
Components/
├── primitives.tsx   StatusPill, Avatar, KPI, SLAIndicator, EmptyState, …
├── overlays.tsx     Modal, Drawer, ConfirmDialog, Tabs, Tooltip, ToastStack
├── table.tsx        EnterpriseTable<T>, FilterBar
├── forms.tsx        FormField, Stepper, EvidenceUploader, RiskMeter
├── AICoPilotPanel   Streaming chat panel with citations
├── AuditTimeline    Timeline with hash display + diff viewer
├── CommentThread    Return thread with AI score block
├── NotificationBell Dropdown bell with unread counter
├── Shell            TopBar + LeftRail nav
└── Logo             SVG shield wordmark`} />
          </SubSection>
          <SubSection title="Design token system">
            <Para>All visual decisions are expressed as CSS custom properties on <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>:root</code> in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>theme.css</code>. No CSS-in-JS runtime. Tokens cover: ink scale (900–50), surface layers (0–3), brand (blue), status (emerald/amber/red), AI (violet), shadows, radii, motion timing. All components consume tokens — a single-file theme change updates the entire UI.</Para>
          </SubSection>
          <SubSection title="Route protection">
            <CodeBlock code={`RequireAuth wrapper:
  if (!isSignedIn) → redirect to /sign-in
  if role not in allowedRoles → redirect to /dashboard

Role-gated nav items:
  getNavItems(role) returns only items visible to that role
  Admin-only routes: /admin, /audit
  External routes: /external/* bypass Shell + RequireAuth entirely`} />
          </SubSection>
          <SubSection title="Performance">
            <Ul items={[
              'All page components are React.lazy() — code split per route, ~20KB average chunk',
              'PageSkeleton Suspense fallback renders in &lt;1ms (CSS only)',
              'Seed data is static module-level constants — zero network latency in demo',
              'AI streaming renders tokens progressively — perceived latency &lt; 200ms to first token',
              'Images not used in platform UI; Unsplash not needed for compliance tool aesthetic',
            ]} />
          </SubSection>
        </Section>

        {/* ── 13. Edge Cases ──────────────────────────── */}
        <Section id="edge-cases" title="13. Edge Cases">
          <Ul items={[
            '<strong>Concurrent review submissions</strong> — two reviewers submit verdict simultaneously. Resolution: DB transaction with SELECT FOR UPDATE on review_slot row; second writer sees updated state and receives conflict error. UI shows "Another reviewer just submitted — please refresh."',
            '<strong>SLA breach during active review</strong> — ticket in in_legal_review breaches SLA. System fires sla_warning notification, flags ticket.sla.breached = true. UI shows red urgency bar in queue. Admin may extend SLA with audit-logged reason.',
            '<strong>External link expiry during approval flow</strong> — user clicks approve after link expires. Edge function rejects scoped JWT (exp claim in past). UI shows "Your session has expired" with contact instructions.',
            '<strong>AI gateway timeout / 5xx</strong> — streaming response times out mid-token. aiStreamStore marks error = true. AIStreamingMessage renders "AI is temporarily unavailable. Please try again or proceed without AI assistance." Partial output is discarded.',
            '<strong>Attachment virus detected</strong> — scanner returns INFECTED. Attachment scan_status = "infected". File is quarantined (moved to isolated bucket, not deleted for audit). EvidenceUploader shows red "Threat detected — file quarantined" badge.',
            '<strong>Requester resubmits changed data</strong> — AI re-assessment runs automatically on resubmission if data_declaration changed. New assessment recorded as a separate ai_generation; old one retained in audit.',
            '<strong>Role reassignment mid-review</strong> — reviewer role changed by admin while they have an in-progress review. Current review_slot preserved. New assignments use updated role. Admin action logged in audit.',
            '<strong>Ticket split with dependent sub-tickets</strong> — parent ticket cannot reach final_decision until all sub-tickets are resolved. Data management reviewer sees sub-ticket dependency indicator in workspace.',
            '<strong>Duplicate submission</strong> — requester submits same request twice (e.g., double-click). Idempotency key (SHA256 of payload + requesterId + minute-window) prevents duplicate ticket creation. Second request returns 409 with original ticket ID.',
            '<strong>Policy version mismatch</strong> — policy updated while AI assessment was running. Assessment citations reference old version. Warning appended: "Policy v1.1 was updated after this assessment. Verify citations against current version."',
          ]} />
        </Section>

        {/* ── 14. Scalability Strategy ────────────────── */}
        <Section id="scalability" title="14. Scalability Strategy">
          <SubSection title="Data tier">
            <Ul items={[
              'Postgres read replicas for audit ledger and reporting queries',
              'Partitioned tickets table by created_at (monthly) after 100k rows',
              'pgvector for policy embeddings — horizontal sharding via Citus if &gt; 10M vectors',
              'Attachments in object storage (S3-compatible) with CDN-signed URLs',
              'audit_events partitioned by month, cold partitions moved to Glacier after 2 years',
            ]} />
          </SubSection>
          <SubSection title="Application tier">
            <Ul items={[
              'Stateless edge functions — horizontal scale-out with zero config (Supabase / Cloudflare Workers)',
              'AI gateway uses model routing: haiku for low-complexity tasks (evaluate reply), sonnet for assessment, opus for co-pilot',
              'SSE streams are connection-limited per IP — queue system for concurrent AI requests',
              'File processing pipeline is async — decoupled from request path via event queue (Postgres LISTEN/NOTIFY or Upstash Queue)',
            ]} />
          </SubSection>
          <SubSection title="Operational targets">
            <Ul items={[
              'P99 API response: &lt; 500ms for all non-AI endpoints',
              'P99 AI first-token: &lt; 2s',
              'Ticket list page: &lt; 1s with 10k tickets (paginated, indexed)',
              'Audit ledger: &lt; 2s for 1M events (partitioned + indexed)',
            ]} />
          </SubSection>
        </Section>

        {/* ── 15. Future Expansion ────────────────────── */}
        <Section id="future-expansion" title="15. Future Expansion">
          <SubSection title="Near-term (3–6 months)">
            <Ul items={[
              '<strong>DPIA module</strong> — Data Protection Impact Assessment wizard for high-risk processing activities (PDPL Art.24); reuses wizard + AI assessment infrastructure',
              '<strong>Consent management</strong> — Track consent records per data subject; integrate with external CRM APIs for consent withdrawal processing',
              '<strong>Breach incident response</strong> — Dedicated incident ticket type with 72h SDAIA reporting SLA (PDPL Art.33); escalation to DPA authority with structured notification export',
              '<strong>Mobile responsive layout</strong> — Reviewer queue and ticket workspace optimized for tablet/mobile; critical for on-call security reviewers',
            ]} />
          </SubSection>
          <SubSection title="Medium-term (6–12 months)">
            <Ul items={[
              '<strong>Multi-org / multi-PDPL-entity tenancy</strong> — Tenant isolation at RLS level; shared policy library with tenant overrides; cross-entity vendor registry',
              '<strong>AI-generated PDPL compliance report</strong> — Monthly board-ready compliance summary auto-generated from audit ledger + decision statistics + SLA trends',
              '<strong>Vendor portal</strong> — Vendors fill out DPA questionnaires and upload certifications directly; reduces data management overhead',
              '<strong>API integration hub</strong> — Native connectors for SAP, Salesforce, Oracle — auto-generate vendor onboarding tickets when new data processors are provisioned',
              '<strong>SDAIA regulatory submission module</strong> — Pre-filled regulatory notification forms for cross-border transfer approval (PDPL Art.29); direct submission via SDAIA API when available',
            ]} />
          </SubSection>
          <SubSection title="Long-term (12+ months)">
            <Ul items={[
              '<strong>Federated PDPL compliance network</strong> — Secure multi-party review where partner organizations can participate in joint reviews without sharing raw data',
              '<strong>AI policy generation</strong> — Draft new internal policies from PDPL requirements; human-in-the-loop approval before publishing',
              '<strong>Predictive SLA risk</strong> — ML model trained on historical ticket data predicts which tickets will breach SLA 48h in advance; auto-escalates',
              '<strong>GCC regulatory expansion</strong> — Support UAE Federal Data Protection Law, Bahrain PDPL, Kuwait Data Privacy Law — multi-jurisdiction compliance from a single platform',
            ]} />
          </SubSection>
          <InfoBox kind="info">
            The current SPA architecture is deliberately decoupled from the backend — all backend surfaces (AI, database, file storage, notifications) are accessed via edge functions. This makes the frontend portable across Supabase, AWS Amplify, Azure Static Web Apps, or any hosting provider without UI changes.
          </InfoBox>
        </Section>
      </div>
    </div>
  )
}
