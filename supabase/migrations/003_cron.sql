-- Migration 003: Supabase pg_cron jobs (requires pg_cron extension)
-- These complement the Vercel cron jobs as a fallback / secondary mechanism.
-- Vercel crons call the HTTP endpoints; these pg_cron jobs can run database-level
-- cleanup tasks that don't require HTTP.

-- Enable pg_cron (must be done by Supabase support or via dashboard)
-- create extension if not exists pg_cron;

-- ============================================================
-- GDPR anonymization: anonymize guests who requested deletion
-- or whose last stay was more than 2 years ago and have no
-- active/upcoming reservations.
-- ============================================================

create or replace function public.anonymize_old_guests()
returns void language plpgsql security definer as $$
declare
  cutoff_date date := current_date - interval '2 years';
  guest_record record;
begin
  for guest_record in
    select g.id
    from public.guests g
    where g.anonymized_at is null
      and not exists (
        select 1
        from public.reservations r
        where r.guest_id = g.id
          and r.check_out >= cutoff_date
          and r.status != 'cancelled'
      )
      and exists (
        select 1
        from public.reservations r
        where r.guest_id = g.id
      )
  loop
    update public.guests
    set
      first_name = null,
      last_name = null,
      email = null,
      phone = null,
      id_number_encrypted = null,
      id_type = null,
      address_street = null,
      address_city = null,
      address_postal_code = null,
      address_country = null,
      country_of_residence = null,
      billing_name = null,
      billing_address = null,
      billing_vat_number = null,
      booking_com_account_id = null,
      airbnb_account_id = null,
      gdpr_consent = false,
      anonymized_at = now(),
      updated_at = now()
    where id = guest_record.id;

    insert into public.audit_log (action, resource_type, resource_id)
    values ('gdpr_anonymize', 'guest', guest_record.id);
  end loop;
end;
$$;

-- ============================================================
-- Cleanup old audit log entries (retain for 3 years)
-- ============================================================
create or replace function public.cleanup_old_audit_log()
returns void language plpgsql security definer as $$
begin
  delete from public.audit_log
  where created_at < now() - interval '3 years';
end;
$$;

-- ============================================================
-- Schedule the jobs (uncomment after pg_cron is enabled)
-- ============================================================

-- Run GDPR anonymization daily at 02:00 UTC
-- select cron.schedule(
--   'gdpr-anonymize-guests',
--   '0 2 * * *',
--   $$ select public.anonymize_old_guests(); $$
-- );

-- Run audit log cleanup weekly on Sundays at 03:00 UTC
-- select cron.schedule(
--   'cleanup-audit-log',
--   '0 3 * * 0',
--   $$ select public.cleanup_old_audit_log(); $$
-- );
