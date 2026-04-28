-- ============================================================
-- PDPL Reviewer — Row-Level Security Policies
-- Migration: 002_rls
-- All authorization is enforced here — client-side role checks
-- are UX convenience only.
-- ============================================================

-- Enable RLS on all tables
alter table public.users                    enable row level security;
alter table public.tickets                  enable row level security;
alter table public.review_slots             enable row level security;
alter table public.return_thread_entries    enable row level security;
alter table public.attachments              enable row level security;
alter table public.ai_generations           enable row level security;
alter table public.pre_submission_assessments enable row level security;
alter table public.audit_events             enable row level security;
alter table public.notifications            enable row level security;
alter table public.policies                 enable row level security;
alter table public.vendors                  enable row level security;
alter table public.projects                 enable row level security;
alter table public.external_links           enable row level security;

-- ── Helper: get calling user's role ───────────────────────
create or replace function auth_role()
returns user_role language sql stable security definer as $$
  select role from public.users where id = auth.uid()
$$;

-- ── USERS ──────────────────────────────────────────────────
-- Any authenticated user can read profiles (for avatar/name display)
create policy "users: authenticated can read"
  on public.users for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile (non-role fields only)
create policy "users: own profile update"
  on public.users for update
  using (id = auth.uid())
  with check (role = (select role from public.users where id = auth.uid()));

-- Only admin can change roles
create policy "users: admin full access"
  on public.users for all
  using (auth_role() = 'admin');

-- ── TICKETS ────────────────────────────────────────────────
-- Requesters: own tickets only
create policy "tickets: requester owns"
  on public.tickets for all
  using (
    auth_role() = 'requester' and requester_id = auth.uid()
  );

-- Data management: all tickets in their queue states + submitted
create policy "tickets: data_management queue"
  on public.tickets for select
  using (
    auth_role() = 'data_management'
    and state in ('submitted', 'in_data_management', 'returned_to_requester',
                  'approved', 'rejected', 'archived')
  );

create policy "tickets: data_management update"
  on public.tickets for update
  using (
    auth_role() = 'data_management'
    and state in ('submitted', 'in_data_management', 'returned_to_requester')
  );

-- Legal: tickets in legal review
create policy "tickets: legal select"
  on public.tickets for select
  using (
    auth_role() = 'legal'
    and state in ('in_legal_review', 'approved', 'rejected', 'archived')
  );

create policy "tickets: legal update"
  on public.tickets for update
  using (auth_role() = 'legal' and state = 'in_legal_review');

-- Security: tickets in security review
create policy "tickets: security select"
  on public.tickets for select
  using (
    auth_role() = 'security'
    and state in ('in_security_review', 'approved', 'rejected', 'archived')
  );

create policy "tickets: security update"
  on public.tickets for update
  using (auth_role() = 'security' and state = 'in_security_review');

-- Admin: unrestricted
create policy "tickets: admin full access"
  on public.tickets for all
  using (auth_role() = 'admin');

-- ── REVIEW SLOTS ───────────────────────────────────────────
-- Each reviewer can see + update slots for their own role
create policy "review_slots: reviewer access"
  on public.review_slots for all
  using (
    auth_role() in ('data_management', 'legal', 'security', 'admin')
    and (
      auth_role() = 'admin'
      or role::text = auth_role()::text
    )
  );

-- Requesters can read their ticket's review slots
create policy "review_slots: requester read"
  on public.review_slots for select
  using (
    auth_role() = 'requester'
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
  );

-- ── RETURN THREAD ENTRIES ──────────────────────────────────
create policy "return_thread: ticket participants"
  on public.return_thread_entries for all
  using (
    auth_role() = 'admin'
    or by_user_id = auth.uid()
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
    or auth_role() in ('data_management', 'legal', 'security')
  );

-- ── ATTACHMENTS ────────────────────────────────────────────
-- Only allow reading attachments if the user has access to the parent ticket
create policy "attachments: ticket access required"
  on public.attachments for select
  using (
    auth_role() = 'admin'
    or uploaded_by = auth.uid()
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id
      and (
        t.requester_id = auth.uid()
        or auth_role() in ('data_management', 'legal', 'security')
      )
    )
  );

create policy "attachments: insert by ticket participants"
  on public.attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
      and (t.requester_id = auth.uid() or auth_role() in ('data_management', 'legal', 'security', 'admin'))
    )
  );

-- ── AI GENERATIONS ──────────────────────────────────────────
create policy "ai_gen: reviewers and admin"
  on public.ai_generations for select
  using (
    auth_role() in ('data_management', 'legal', 'security', 'admin')
    or created_by = auth.uid()
  );

create policy "ai_gen: insert by authenticated"
  on public.ai_generations for insert
  with check (created_by = auth.uid());

-- ── PRE-SUBMISSION ASSESSMENTS ─────────────────────────────
create policy "pre_assessment: ticket access"
  on public.pre_submission_assessments for select
  using (
    auth_role() = 'admin'
    or auth_role() in ('data_management', 'legal', 'security')
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.requester_id = auth.uid()
    )
  );

-- ── AUDIT EVENTS ───────────────────────────────────────────
-- INSERT: any authenticated user (system writes on their behalf)
create policy "audit: insert by authenticated"
  on public.audit_events for insert
  with check (actor_id = auth.uid());

-- SELECT: admin and data_management see all; others see events for their own tickets
create policy "audit: admin and dm read all"
  on public.audit_events for select
  using (auth_role() in ('admin', 'data_management'));

create policy "audit: others see own ticket events"
  on public.audit_events for select
  using (
    auth_role() not in ('admin', 'data_management')
    and (
      actor_id = auth.uid()
      or (
        target_type = 'ticket'
        and exists (
          select 1 from public.tickets t
          where t.id = target_id and t.requester_id = auth.uid()
        )
      )
    )
  );

-- ── NOTIFICATIONS ──────────────────────────────────────────
create policy "notif: own only"
  on public.notifications for all
  using (user_id = auth.uid());

-- ── POLICIES (library) ─────────────────────────────────────
-- All authenticated users can read; only admin can write
create policy "policies: all can read"
  on public.policies for select
  using (auth.role() = 'authenticated');

create policy "policies: admin write"
  on public.policies for all
  using (auth_role() = 'admin');

-- ── VENDORS ────────────────────────────────────────────────
create policy "vendors: authenticated read"
  on public.vendors for select
  using (auth.role() = 'authenticated');

create policy "vendors: admin and dm write"
  on public.vendors for all
  using (auth_role() in ('admin', 'data_management'));

-- ── PROJECTS ───────────────────────────────────────────────
create policy "projects: authenticated read"
  on public.projects for select
  using (auth.role() = 'authenticated');

create policy "projects: admin write"
  on public.projects for all
  using (auth_role() = 'admin');

-- ── EXTERNAL LINKS ─────────────────────────────────────────
-- No direct browser access — all external link operations go through
-- Edge Functions that use the service role key.
-- Authenticated internal users (admin/dm) can read links for their tickets.
create policy "ext_links: issuer and admin"
  on public.external_links for select
  using (
    auth_role() = 'admin'
    or issued_by = auth.uid()
  );
