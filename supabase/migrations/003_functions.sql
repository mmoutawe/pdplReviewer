-- ============================================================
-- PDPL Reviewer — Helper Functions & Triggers
-- Migration: 003_functions
-- ============================================================

-- ── New-user profile trigger ──────────────────────────────
-- When a user signs up via Supabase Auth, create their profile row
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, role, department, job_title, initials, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'requester'),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'job_title', ''),
    coalesce(new.raw_user_meta_data->>'initials',
      upper(left(split_part(new.email, '@', 1), 1)) ||
      upper(left(split_part(split_part(new.email, '@', 1), '.', 2), 1))),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#6366f1')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Audit event writer ────────────────────────────────────
-- Used by Edge Functions to write audit events with hash chaining
create or replace function write_audit_event(
  p_id          text,
  p_actor_id    uuid,
  p_actor_role  user_role,
  p_action      text,
  p_target_type audit_target_type,
  p_target_id   text,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_ip_hash     text default null,
  p_session_id  text default null,
  p_reason      text default null
)
returns text language plpgsql security definer as $$
declare
  prev_hash   text;
  new_hash    text;
  event_row   text;
begin
  -- Get the most recent hash for chain continuity
  select immutable_hash into prev_hash
  from public.audit_events
  order by ts desc
  limit 1;

  -- Compute new hash: SHA-256 of (prev_hash || id || actor || action || target || ts)
  new_hash := encode(
    digest(
      coalesce(prev_hash, '') ||
      p_id || p_actor_id::text || p_action || p_target_id ||
      extract(epoch from now())::text ||
      coalesce(p_before::text, '') ||
      coalesce(p_after::text, ''),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_events (
    id, ts, actor_id, actor_role, action,
    target_type, target_id,
    before_snapshot, after_snapshot,
    ip_hash, session_id, reason,
    immutable_hash, prev_hash
  ) values (
    p_id, now(), p_actor_id, p_actor_role, p_action,
    p_target_type, p_target_id,
    p_before, p_after,
    p_ip_hash, p_session_id, p_reason,
    new_hash, prev_hash
  );

  return new_hash;
end;
$$;

-- ── SLA breach cron function ──────────────────────────────
-- Called by pg_cron every 15 minutes (or Supabase Edge Function cron)
create or replace function check_sla_breaches()
returns void language plpgsql security definer as $$
declare
  r record;
begin
  -- Mark breached tickets
  update public.tickets
  set sla_breached = true
  where sla_decision_due_at < now()
    and sla_breached = false
    and state not in ('approved', 'rejected', 'archived', 'draft');

  -- Insert sla_warning notifications for tickets < 24h from breach
  for r in
    select t.id, t.requester_id, t.sla_decision_due_at
    from public.tickets t
    where t.sla_decision_due_at between now() and now() + interval '24 hours'
      and t.sla_breached = false
      and t.state not in ('approved', 'rejected', 'archived', 'draft')
      and not exists (
        select 1 from public.notifications n
        where n.ticket_id = t.id
          and n.category = 'system'
          and n.title ilike 'SLA warning%'
          and n.ts > now() - interval '1 hour'
      )
  loop
    -- Notify data_management users
    insert into public.notifications (user_id, category, title, body, ticket_id)
    select u.id, 'system',
      'SLA warning: ' || r.id,
      'Decision due at ' || to_char(r.sla_decision_due_at, 'YYYY-MM-DD HH24:MI') || ' UTC — less than 24 hours remaining.',
      r.id
    from public.users u
    where u.role = 'data_management';
  end loop;
end;
$$;

-- ── Ticket state transition guard ─────────────────────────
-- Validates that state transitions follow the allowed lifecycle graph
create or replace function validate_ticket_transition()
returns trigger language plpgsql as $$
declare
  allowed text[] := case new.state
    when 'submitted'              then array['draft']
    when 'in_data_management'     then array['submitted', 'returned_to_requester']
    when 'returned_to_requester'  then array['in_data_management']
    when 'in_legal_review'        then array['in_data_management']
    when 'in_security_review'     then array['in_legal_review', 'in_data_management']
    when 'final_decision'         then array['in_security_review', 'in_legal_review']
    when 'approved'               then array['final_decision', 'in_data_management', 'in_legal_review', 'in_security_review']
    when 'rejected'               then array['in_data_management', 'in_legal_review', 'in_security_review', 'submitted']
    when 'archived'               then array['approved', 'rejected']
    else null
  end;
begin
  if old.state = new.state then return new; end if;

  if allowed is null or old.state::text != all(allowed) then
    raise exception 'Invalid ticket state transition: % → %', old.state, new.state;
  end if;

  -- Stamp submitted_at / decided_at automatically
  if new.state = 'submitted' and old.state = 'draft' then
    new.submitted_at := coalesce(new.submitted_at, now());
    new.sla_started_at := now();
    new.sla_decision_due_at := now() + (new.sla_decision_hours || ' hours')::interval;
  end if;

  if new.state in ('approved', 'rejected') then
    new.decided_at := coalesce(new.decided_at, now());
    new.sla_breached := (now() > new.sla_decision_due_at);
  end if;

  return new;
end;
$$;

create trigger tickets_state_guard
  before update of state on public.tickets
  for each row execute function validate_ticket_transition();
