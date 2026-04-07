-- Migration 004: Add billing_company_id (IČO) to guests
alter table public.guests
  add column if not exists billing_company_id text;
