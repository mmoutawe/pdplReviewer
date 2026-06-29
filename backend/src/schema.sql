-- PDPL Reviewer — PostgreSQL Schema
-- Run once: psql -U pdplr -d pdplr -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'requester',
  department      TEXT NOT NULL DEFAULT '',
  job_title       TEXT NOT NULL DEFAULT '',
  initials        TEXT NOT NULL DEFAULT '',
  avatar_color    TEXT NOT NULL DEFAULT '#6366f1',
  must_change_pw  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vendors ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name       TEXT NOT NULL,
  trade_name       TEXT NOT NULL DEFAULT '',
  jurisdiction     TEXT NOT NULL DEFAULT '',
  risk_score       INT  NOT NULL DEFAULT 50,
  risk_tier        TEXT NOT NULL DEFAULT 'medium',
  status           TEXT NOT NULL DEFAULT 'pending',
  category         TEXT NOT NULL DEFAULT '',
  primary_contact  TEXT NOT NULL DEFAULT '',
  certifications   TEXT[] NOT NULL DEFAULT '{}',
  has_dpa          BOOLEAN NOT NULL DEFAULT FALSE,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Projects ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT UNIQUE NOT NULL,
  name                 TEXT NOT NULL,
  business_unit        TEXT NOT NULL DEFAULT '',
  owner_id             UUID REFERENCES users(id),
  vendor_id            UUID REFERENCES vendors(id),
  status               TEXT NOT NULL DEFAULT 'active',
  data_inventory_count INT  NOT NULL DEFAULT 0,
  description          TEXT NOT NULL DEFAULT '',
  started_at           TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tickets ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number               TEXT UNIQUE NOT NULL,
  type                        TEXT NOT NULL,
  state                       TEXT NOT NULL DEFAULT 'draft',
  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  requester_id                UUID NOT NULL REFERENCES users(id),
  vendor_id                   UUID REFERENCES vendors(id),
  project_id                  UUID REFERENCES projects(id),
  external_recipient_email    TEXT,
  tags                        TEXT[] NOT NULL DEFAULT '{}',
  payload                     JSONB NOT NULL DEFAULT '{}',
  data_declaration            JSONB NOT NULL DEFAULT '{}',
  sla_ack_hours               INT  NOT NULL DEFAULT 24,
  sla_decision_hours          INT  NOT NULL DEFAULT 72,
  sla_started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_ack_by                  TEXT,
  sla_acked_at                TIMESTAMPTZ,
  sla_decision_due_at         TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
  sla_breached                BOOLEAN NOT NULL DEFAULT FALSE,
  pre_assessment_generation_id TEXT,
  parent_ticket_id            UUID REFERENCES tickets(id),
  submitted_at                TIMESTAMPTZ,
  decided_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Review Slots ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_slots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  role                     TEXT NOT NULL,
  reviewer_id              UUID REFERENCES users(id),
  verdict                  TEXT NOT NULL DEFAULT 'pending',
  decided_at               TIMESTAMPTZ,
  notes                    TEXT,
  ai_copilot_generation_id TEXT,
  UNIQUE(ticket_id, role)
);

-- ── Thread Entries ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS thread_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  by_user_id     UUID NOT NULL REFERENCES users(id),
  by_role        TEXT NOT NULL,
  message        TEXT NOT NULL,
  attachment_ids TEXT[] NOT NULL DEFAULT '{}',
  ai_score       JSONB,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Attachments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     TEXT NOT NULL,
  filename          TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  content_type      TEXT NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  storage_path      TEXT NOT NULL,
  scan_status       TEXT NOT NULL DEFAULT 'pending',
  classification    TEXT NOT NULL DEFAULT 'internal',
  category          TEXT NOT NULL DEFAULT 'other',
  extracted_summary TEXT
);

-- ── Audit Events ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id         UUID NOT NULL REFERENCES users(id),
  actor_role       TEXT NOT NULL,
  action           TEXT NOT NULL,
  target_type      TEXT NOT NULL,
  target_id        TEXT NOT NULL,
  before_snapshot  JSONB,
  after_snapshot   JSONB,
  ip_hash          TEXT,
  session_id       TEXT,
  reason           TEXT,
  immutable_hash   TEXT NOT NULL DEFAULT '',
  prev_hash        TEXT
);

-- ── Notifications ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  category     TEXT NOT NULL DEFAULT 'system',
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,
  action_label TEXT,
  ticket_id    TEXT
);

-- ── Policies ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  title            TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'internal',
  version          TEXT NOT NULL DEFAULT '1.0',
  effective_date   TEXT NOT NULL DEFAULT '',
  owner_dept       TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'active',
  summary          TEXT NOT NULL DEFAULT '',
  body             TEXT NOT NULL DEFAULT '',
  embeddings_built BOOLEAN NOT NULL DEFAULT FALSE,
  citation_count   INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Project Documents ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID REFERENCES projects(id),
  vendor_id          UUID REFERENCES vendors(id),
  parent_document_id UUID REFERENCES project_documents(id),
  title              TEXT NOT NULL,
  document_type      TEXT NOT NULL DEFAULT 'other',
  version            INT  NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'draft',
  storage_path       TEXT NOT NULL,
  file_type          TEXT NOT NULL DEFAULT '',
  file_size          BIGINT NOT NULL DEFAULT 0,
  description        TEXT,
  tags               TEXT[],
  effective_date     TEXT,
  expiry_date        TEXT,
  uploaded_by        UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Reviewer Templates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reviewer_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  storage_path TEXT NOT NULL,
  file_type    TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'other',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── App Settings ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT UNIQUE NOT NULL,
  value           JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── External Links ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS external_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT UNIQUE NOT NULL,
  ticket_number   TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  expires_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  revoked         BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  approved_at     TIMESTAMPTZ,
  label           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Notification Preferences ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notif_preferences (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  in_app    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, type)
);

-- ── Default app settings row ───────────────────────────────────────────────────

INSERT INTO app_settings (key, value) VALUES
  ('workflow', '{"requireDocumentValidation":true,"legalForCrossBorder":true,"securityForSensitive":true,"autoRouteLowRisk":false,"riskThreshold":3,"confidenceThreshold":95}'::jsonb)
ON CONFLICT (key) DO NOTHING;
