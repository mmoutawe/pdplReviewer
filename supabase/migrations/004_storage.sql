-- ============================================================
-- PDPL Reviewer — Storage
-- Migration: 004_storage
-- ============================================================

-- ── Create ticket-attachments bucket (private) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  26214400,   -- 25 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'text/csv',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- ── Storage RLS policies ───────────────────────────────────

-- Authenticated users can upload to any ticket path they have access to.
-- The DB-level RLS on the attachments table enforces ticket ownership; storage
-- just requires the user to be authenticated.
create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ticket-attachments');

-- Users can read any attachment (ticket-level access is enforced via signed URLs
-- and the attachments table RLS — anyone who can query the DB row can get a URL).
create policy "Authenticated users can read attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'ticket-attachments');

-- Users can only delete objects they own (uploaded_by = auth.uid()).
create policy "Users can delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and owner = auth.uid()
  );

-- Admins and data management can delete any attachment.
create policy "Admins can delete any attachment"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'data_management')
    )
  );

-- ── Attachments table RLS ──────────────────────────────────
-- (Supplements 002_rls.sql — storage-specific guards)

-- Requesters can only see attachments on their own tickets
create policy "Requesters see own ticket attachments" on public.attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.tickets
      where tickets.id = attachments.ticket_id
      and (
        tickets.requester_id = auth.uid()
        or exists (
          select 1 from public.users
          where id = auth.uid()
          and role in ('data_management', 'legal', 'security', 'admin')
        )
      )
    )
  );

-- Only authenticated users can insert attachments on tickets they can access
create policy "Users can insert attachments on accessible tickets" on public.attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.tickets
      where id = attachments.ticket_id
      and (
        requester_id = auth.uid()
        or exists (
          select 1 from public.users
          where id = auth.uid()
          and role in ('data_management', 'legal', 'security', 'admin')
        )
      )
    )
  );

-- Users can delete their own uploads; admins can delete any
create policy "Users can delete own attachments" on public.attachments
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'data_management')
    )
  );
