-- Migration 005: Household members and reservation guest linking

-- Additional guests under one account (family members, travel companions)
create table if not exists public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.guests(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  id_number_encrypted text,
  id_type text check (id_type in ('passport', 'national_id')),
  country_of_residence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_profiles_account_id_idx
  on public.guest_profiles (account_id);

create trigger guest_profiles_updated_at
  before update on public.guest_profiles
  for each row execute function public.set_updated_at();

-- Links household members to specific reservations
create table if not exists public.reservation_guests (
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  guest_profile_id uuid not null references public.guest_profiles(id) on delete cascade,
  primary key (reservation_id, guest_profile_id),
  created_at timestamptz not null default now()
);

-- RLS: account owners can manage their household members
alter table public.guest_profiles enable row level security;

create policy "guest_profiles_owner"
  on public.guest_profiles
  for all
  using (auth.uid() = account_id);

-- RLS: guests can manage reservation_guests for their own reservations
alter table public.reservation_guests enable row level security;

create policy "reservation_guests_owner"
  on public.reservation_guests
  for all
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and r.guest_id = auth.uid()
    )
  );
