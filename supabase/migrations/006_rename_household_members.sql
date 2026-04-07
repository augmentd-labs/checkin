-- Migration 006: Rename household_members → guest_profiles
-- "household member" implies family; guests are often solo travelers or colleagues

alter table public.household_members rename to guest_profiles;
alter table public.reservation_guests rename column household_member_id to guest_profile_id;
