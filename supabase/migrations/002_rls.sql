-- Migration 002: Row Level Security policies

-- Enable RLS on all tables
alter table public.properties enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_log enable row level security;
alter table public.compliance_exports enable row level security;

-- Helper function: check if the current user is an admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  )
$$;

-- ============================================================
-- Properties: readable by all authenticated users, writable by admins only
-- ============================================================
create policy "Properties are viewable by authenticated users"
  on public.properties
  for select
  to authenticated
  using (true);

create policy "Properties are manageable by admins"
  on public.properties
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Guests: users can read/write their own record; admins can access all
-- ============================================================
create policy "Guests can view their own record"
  on public.guests
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "Guests can insert their own record"
  on public.guests
  for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

create policy "Guests can update their own record"
  on public.guests
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "Admins can delete guest records"
  on public.guests
  for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Reservations: guests see their own; admins see all
-- ============================================================
create policy "Guests can view their own reservations"
  on public.reservations
  for select
  to authenticated
  using (guest_id = auth.uid() or public.is_admin());

create policy "Admins can insert reservations"
  on public.reservations
  for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins or guests can update reservations"
  on public.reservations
  for update
  to authenticated
  using (guest_id = auth.uid() or public.is_admin())
  with check (guest_id = auth.uid() or public.is_admin());

create policy "Admins can delete reservations"
  on public.reservations
  for delete
  to authenticated
  using (public.is_admin());

-- Service role bypass: API routes using service role key bypass RLS automatically.
-- The upsert for platform sync (booking.com, airbnb) uses the admin client (service role).

-- ============================================================
-- Audit log: admins can read; service role writes (bypasses RLS)
-- ============================================================
create policy "Admins can view audit log"
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policies for audit_log — only service role (admin client) writes to it

-- ============================================================
-- Compliance exports: admins only
-- ============================================================
create policy "Admins can manage compliance exports"
  on public.compliance_exports
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
