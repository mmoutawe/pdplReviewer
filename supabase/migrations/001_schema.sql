-- ============================================================
-- PDPL Reviewer — Database Schema
-- Migration: 001_schema
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";          -- pgvector for policy embeddings

-- ── Enums ─────────────────────────────────────────────────
create type user_role as enum (
  'requester', 'data_management', 'legal', 'security', 'admin', 'external_recipient'
);

create type request_type as enum (
  'vendor_onboarding', 'external_document_sharing', 'data_sharing_external',
  'internal_data_access', 'cross_border_transfer'
);

create type ticket_state as enum (
  'draft', 'submitted', 'in_data_management', 'returned_to_requester',
  'in_legal_review', 'in_security_review', 'final_decision',
  'approved', 'rejected', 'archived'
);

create type review_verdict as enum ('pending', 'approve', 'return', 'reject', 'escalate');

create type scan_status as enum ('pending', 'clean', 'flagged');

create type classification_level as enum (
  'unclassified', 'public', 'internal', 'confidential', 'restricted'
);

create type attachment_category as enum (
  'contract', 'dpa', 'soc2', 'iso27001', 'evidence', 'screenshot', 'other'
);

create type audit_target_type as enum (
  'ticket', 'user', 'policy', 'attachment', 'role', 'system'
);

create type notif_category as enum ('ticket', 'review', 'mention', 'system', 'security');

create type policy_category as enum ('pdpl', 'internal', 'sama', 'iso27001', 'cma');

create type policy_status as enum ('active', 'draft', 'retired');

create type vendor_status as enum ('active', 'pending', 'sunset', 'terminated');

create type risk_tier as enum ('low', 'medium', 'high', 'critical');

create type project_status as enum ('active', 'on_hold', 'closed');

create type external_link_status as enum ('pending', 'redeemed', 'expired', 'revoked');

create type ai_feature as enum (
  'request_builder', 'pre_submission_assessment', 'reviewer_copilot',
  'document_chat', 'policy_chatbot', 'evaluate_reply'
);

create type encryption_state as enum ('none', 'transit', 'rest', 'both');

create type legal_basis as enum (
  'consent', 'contract', 'legitimate_interest', 'legal_obligation', 'public_interest'
);

-- ── Users ─────────────────────────────────────────────────
-- Mirrors auth.users; populated by a trigger on auth.users insert
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null unique,
  role          user_role not null default 'requester',
  department    text not null default '',
  job_title     text not null default '',
  initials      text not null default '',
  avatar_color  text not null default '#6366f1',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Policies ──────────────────────────────────────────────
create table public.policies (
  id               text primary key,           -- 'pol-data-001'
  code             text not null unique,        -- 'POL-DATA-001'
  title            text not null,
  category         policy_category not null,
  version          text not null default '1.0',
  effective_date   date not null,
  owner_dept       text not null,
  status           policy_status not null default 'draft',
  summary          text not null default '',
  body             text not null default '',
  embeddings_built boolean not null default false,
  citation_count   integer not null default 0,
  embedding        vector(1536),               -- text-embedding-3-small dimensions
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Vendors ───────────────────────────────────────────────
create table public.vendors (
  id               text primary key,
  legal_name       text not null,
  trade_name       text not null,
  jurisdiction     text not null,
  risk_score       smallint not null default 0 check (risk_score between 0 and 100),
  risk_tier        risk_tier not null default 'low',
  status           vendor_status not null default 'pending',
  category         text not null default '',
  primary_contact  text not null default '',
  certifications   text[] not null default '{}',
  has_dpa          boolean not null default false,
  last_reviewed_at timestamptz,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Projects ──────────────────────────────────────────────
create table public.projects (
  id                   text primary key,
  code                 text not null unique,
  name                 text not null,
  business_unit        text not null,
  owner_id             uuid references public.users(id),
  status               project_status not null default 'active',
  data_inventory_count integer not null default 0,
  description          text not null default '',
  started_at           timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Tickets ───────────────────────────────────────────────
create table public.tickets (
  id                          text primary key,   -- 'PDPL-2026-0042'
  type                        request_type not null,
  state                       ticket_state not null default 'draft',
  title                       text not null,
  description                 text not null default '',
  requester_id                uuid not null references public.users(id),
  vendor_id                   text references public.vendors(id),
  project_id                  text references public.projects(id),
  external_recipient_email    text,
  tags                        text[] not null default '{}',

  -- Type-specific structured payload (discriminated union stored as jsonb)
  payload                     jsonb not null default '{}',

  -- Data declaration questionnaire
  data_declaration            jsonb not null default '{}',

  -- SLA tracking
  sla_ack_hours               integer not null default 24,
  sla_decision_hours          integer not null default 72,
  sla_started_at              timestamptz,
  sla_ack_by                  text,
  sla_acked_at                timestamptz,
  sla_decision_due_at         timestamptz,
  sla_breached                boolean not null default false,

  -- AI assessment link
  pre_assessment_generation_id text,

  -- Split ticket links
  parent_ticket_id            text references public.tickets(id),

  -- Timestamps
  submitted_at                timestamptz,
  decided_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index tickets_state_idx          on public.tickets(state);
create index tickets_requester_idx      on public.tickets(requester_id);
create index tickets_project_idx        on public.tickets(project_id);
create index tickets_vendor_idx         on public.tickets(vendor_id);
create index tickets_state_created_idx  on public.tickets(state, created_at desc);
create index tickets_sla_due_idx        on public.tickets(sla_decision_due_at) where sla_breached = false;

-- ── Review Slots ──────────────────────────────────────────
create table public.review_slots (
  id                        uuid primary key default uuid_generate_v4(),
  ticket_id                 text not null references public.tickets(id) on delete cascade,
  role                      user_role not null check (role in ('data_management', 'legal', 'security')),
  reviewer_id               uuid references public.users(id),
  verdict                   review_verdict not null default 'pending',
  decided_at                timestamptz,
  notes                     text,
  ai_copilot_generation_id  text,
  created_at                timestamptz not null default now(),
  unique (ticket_id, role)
);

create index review_slots_ticket_idx on public.review_slots(ticket_id);

-- ── Return Thread Entries ─────────────────────────────────
create table public.return_thread_entries (
  id              uuid primary key default uuid_generate_v4(),
  ticket_id       text not null references public.tickets(id) on delete cascade,
  by_user_id      uuid not null references public.users(id),
  by_role         user_role not null,
  message         text not null,
  attachment_ids  text[] not null default '{}',
  ai_score        jsonb,              -- { score: number; reasoning: string }
  resolved_at     timestamptz,
  resolved_by     uuid references public.users(id),
  created_at      timestamptz not null default now()
);

create index return_thread_ticket_idx on public.return_thread_entries(ticket_id, created_at);

-- ── Attachments ───────────────────────────────────────────
create table public.attachments (
  id                  text primary key,
  ticket_id           text not null references public.tickets(id) on delete cascade,
  filename            text not null,
  size_bytes          bigint not null default 0,
  content_type        text not null default 'application/octet-stream',
  uploaded_by         uuid not null references public.users(id),
  uploaded_at         timestamptz not null default now(),
  storage_bucket      text not null,
  storage_path        text not null default '',
  signed_url_expiry   timestamptz,
  scan_status         scan_status not null default 'pending',
  classification      classification_level not null default 'unclassified',
  category            attachment_category not null default 'other',
  extracted_summary   text
);

create index attachments_ticket_idx on public.attachments(ticket_id);

-- ── AI Generations ────────────────────────────────────────
create table public.ai_generations (
  id              text primary key,
  feature         ai_feature not null,
  model_hint      text not null default '',
  ticket_id       text references public.tickets(id) on delete set null,
  prompt_digest   text not null,
  output          text not null default '',
  citations       jsonb not null default '[]',
  confidence      numeric(4,3) not null default 0 check (confidence between 0 and 1),
  flagged         boolean not null default false,
  created_by      uuid not null references public.users(id),
  duration_ms     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index ai_gen_ticket_idx on public.ai_generations(ticket_id);

-- ── Pre-Submission Assessments ────────────────────────────
create table public.pre_submission_assessments (
  id              uuid primary key default uuid_generate_v4(),
  ticket_id       text not null references public.tickets(id) on delete cascade,
  generation_id   text references public.ai_generations(id),
  overall_risk    risk_tier not null,
  pdpl_alignment  text not null check (pdpl_alignment in ('aligned', 'gaps', 'misaligned')),
  findings        jsonb not null default '[]',
  summary         text not null default '',
  citations       jsonb not null default '[]',
  confidence      numeric(4,3) not null default 0,
  generated_at    timestamptz not null default now()
);

-- ── Audit Events (append-only) ────────────────────────────
create table public.audit_events (
  id              text primary key,
  ts              timestamptz not null default now(),
  actor_id        uuid not null references public.users(id),
  actor_role      user_role not null,
  action          text not null,
  target_type     audit_target_type not null,
  target_id       text not null,
  before_snapshot jsonb,
  after_snapshot  jsonb,
  ip_hash         text,
  session_id      text,
  reason          text,
  immutable_hash  text not null,
  prev_hash       text
) partition by range (ts);

-- Create initial monthly partition
create table public.audit_events_2026_04
  partition of public.audit_events
  for values from ('2026-04-01') to ('2026-05-01');

create table public.audit_events_2026_05
  partition of public.audit_events
  for values from ('2026-05-01') to ('2026-06-01');

create index audit_target_idx    on public.audit_events(target_id, ts desc);
create index audit_actor_idx     on public.audit_events(actor_id, ts desc);
create index audit_action_idx    on public.audit_events(action, ts desc);

-- Prevent UPDATE and DELETE on audit_events (immutability trigger)
create or replace function audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events is append-only — UPDATE and DELETE are not permitted';
end;
$$;

create trigger audit_no_update before update on public.audit_events
  for each row execute function audit_immutable();

create trigger audit_no_delete before delete on public.audit_events
  for each row execute function audit_immutable();

-- ── Notifications ─────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  ts            timestamptz not null default now(),
  read          boolean not null default false,
  category      notif_category not null,
  title         text not null,
  body          text not null default '',
  link          text,
  action_label  text,
  ticket_id     text references public.tickets(id) on delete set null
);

create index notif_user_unread_idx on public.notifications(user_id, read, ts desc);

-- ── External Links ────────────────────────────────────────
create table public.external_links (
  id                      uuid primary key default uuid_generate_v4(),
  token_hash              text not null unique,   -- SHA-256 of the plaintext token
  ticket_id               text not null references public.tickets(id) on delete cascade,
  recipient_email         text not null,
  permissions             text[] not null default '{}',
  issued_by               uuid not null references public.users(id),
  issued_at               timestamptz not null default now(),
  expires_at              timestamptz not null,
  redeemed_at             timestamptz,
  redeemed_from_ip_hash   text,
  status                  external_link_status not null default 'pending'
);

create index ext_links_ticket_idx on public.external_links(ticket_id);

-- ── Ticket ID sequence helper ──────────────────────────────
create sequence if not exists ticket_seq start 1000;

create or replace function next_ticket_id()
returns text language plpgsql as $$
declare
  yr text := to_char(now(), 'YYYY');
  seq int := nextval('ticket_seq');
begin
  return 'PDPL-' || yr || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- ── Updated-at trigger ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tickets_updated_at    before update on public.tickets    for each row execute function set_updated_at();
create trigger users_updated_at      before update on public.users      for each row execute function set_updated_at();
create trigger vendors_updated_at    before update on public.vendors    for each row execute function set_updated_at();
create trigger projects_updated_at   before update on public.projects   for each row execute function set_updated_at();
create trigger policies_updated_at   before update on public.policies   for each row execute function set_updated_at();
