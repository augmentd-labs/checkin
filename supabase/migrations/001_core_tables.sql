-- Migration 001: Core tables

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Properties table
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  nuki_device_id text,
  lockin_device_id text,
  parking_enabled boolean not null default false,
  parking_gate_id text,
  created_at timestamptz not null default now()
);

-- Guests table
create table if not exists public.guests (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  id_number_encrypted text,
  id_type text check (id_type in ('passport', 'national_id')),
  address_street text,
  address_city text,
  address_postal_code text,
  address_country text,
  country_of_residence text,
  billing_name text,
  billing_address text,
  billing_vat_number text,
  booking_com_account_id text,
  airbnb_account_id text,
  gdpr_consent boolean not null default false,
  gdpr_consent_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reservations table
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  platform text not null check (platform in ('booking_com', 'airbnb', 'direct')),
  platform_reservation_id text not null,
  platform_pin text,
  check_in date not null,
  check_out date not null,
  status text not null default 'confirmed' check (
    status in ('confirmed', 'cancelled', 'modified', 'checked_in', 'checked_out')
  ),
  adults integer not null default 1,
  children integer not null default 0,
  total_price numeric(10, 2),
  currency text not null default 'EUR',
  city_tax_amount numeric(10, 2),
  lock_access_code text,
  lock_access_sent_at timestamptz,
  parking_access_code text,
  invoice_id text,
  invoice_sent_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_reservation_id)
);

-- Index for guest lookups
create index if not exists reservations_guest_id_idx on public.reservations (guest_id);
create index if not exists reservations_property_id_idx on public.reservations (property_id);
create index if not exists reservations_check_in_idx on public.reservations (check_in);
create index if not exists reservations_platform_reservation_id_idx on public.reservations (platform, platform_reservation_id);

-- Audit log table
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- Compliance exports table
create table if not exists public.compliance_exports (
  id uuid primary key default gen_random_uuid(),
  exported_by uuid references auth.users(id) on delete set null,
  export_type text not null check (export_type in ('city_tax', 'police', 'custom')),
  date_from date,
  date_to date,
  property_ids uuid[],
  row_count integer,
  file_path text,
  created_at timestamptz not null default now()
);

-- Updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
create trigger guests_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

create trigger reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();
