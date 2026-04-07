# Guest Check-in

Self-hosted online check-in platform for short-term rental operators. Automates guest registration, identity verification, access code provisioning, and compliance exports across multiple properties.

---

## What it does

1. **Booking.com syncs reservations** into the app via webhook or periodic sync.
2. **Booking.com's built-in automated messages** deliver a static link (`/welcome`) to guests before arrival — no messaging API required.
3. **Guest opens `/welcome`**, enters their booking number + last name + phone, creates an account, and completes a registration wizard (personal details, ID document, travel companions).
4. **Check-ins are auto-accepted or queued for admin review** depending on per-property rules (always auto, always review, or condition-based: guest's city/country/EU status).
5. **3 hours before check-in**, door PINs and parking codes are auto-provisioned and emailed to the guest.
6. **Day of arrival**, invoices are generated via your accounting API and sent to the guest.
7. **Admins** can review pending check-ins, manage guests, run compliance exports (city tax, police registration), and monitor pending outbound messages.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (PostgreSQL, Row-Level Security, pg_cron) |
| Hosting | Vercel (recommended) |
| Email | Resend |
| SMS | Twilio (access code fallback) |
| Smart locks | Nuki (primary), Lockin / Loki (stubs — plug in when decided) |
| Parking | Custom GSM relay (stub — see `lib/parking/client.ts`) |
| Encryption | AES-256-GCM (ID numbers at rest) |
| Accounting | Generic REST API (`ACCOUNTING_API_URL`) |

---

## Requirements

### External services you must have

| Service | Purpose | Notes |
|---|---|---|
| **Supabase project** (EU region) | Database, auth, cron | Requires `pg_cron` and `pg_net` extensions enabled |
| **Resend account** | All guest emails | Verify your sending domain |
| **Nuki API token** | Door lock provisioning | One token covers all Nuki devices |
| **Booking.com extranet access** | Reservation sync + automated messages | Standard property manager account |

### Optional / deferred

| Service | Purpose | When you need it |
|---|---|---|
| Twilio | SMS fallback for access codes | If guests don't have email at check-in time |
| Accounting API | Invoice generation | Day of arrival |
| Booking.com Connectivity API | Programmatic messaging | Only if you outgrow the automated-message approach |
| Lockin / Loki | Alternative smart lock | When hardware decision is made |
| Parking relay | Gate access codes | After hardware installation |

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd checkin
npm install
```

### 2. Environment variables

Copy the example file and fill in each value:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only, never expose to client) |
| `BOOKING_COM_USERNAME` | Yes | Booking.com XML API username |
| `BOOKING_COM_PASSWORD` | Yes | Booking.com XML API password |
| `BOOKING_COM_HOTEL_IDS` | Yes | Comma-separated hotel IDs, e.g. `12345,67890` |
| `BOOKING_COM_MESSAGING_API_KEY` | No | Set when Connectivity API messaging is enabled via partner |
| `NUKI_API_TOKEN` | Yes | Nuki Web API token |
| `NUKI_WEBHOOK_SECRET` | No | HMAC secret for Nuki webhook verification |
| `RESEND_API_KEY` | Yes | Resend API key |
| `RESEND_FROM_EMAIL` | Yes | Verified sender address, e.g. `checkin@yourdomain.com` |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_FROM_NUMBER` | No | Twilio sending number |
| `ENCRYPTION_KEY` | Yes | 32-byte AES key, base64-encoded. Generate with: `openssl rand -base64 32` |
| `ACCOUNTING_API_URL` | No | Base URL of your accounting/invoicing API |
| `ACCOUNTING_API_KEY` | No | Bearer token for the accounting API |
| `ADMIN_EMAIL` | Yes | Shown to guests in rejection emails and error pages |
| `CRON_SECRET` | Yes | Shared secret between Supabase cron and app. Generate with: `openssl rand -hex 32` |
| `NEXT_PUBLIC_PROPERTY_NAME` | Yes | Shown in UI headers, e.g. `Atlas Apartments` |

### 3. Supabase setup

#### Enable required extensions

In your Supabase project → SQL Editor:

```sql
create extension if not exists "pg_cron";
create extension if not exists "pg_net";
```

#### Run migrations in order

```bash
# Using Supabase CLI
supabase db push

# Or apply manually in SQL Editor in numeric order:
# supabase/migrations/001_core_tables.sql
# supabase/migrations/002_rls.sql
# supabase/migrations/003_cron.sql
# supabase/migrations/004_billing_company_id.sql
# supabase/migrations/005_guest_profiles.sql
# supabase/migrations/006_rename_household_members.sql
# supabase/migrations/007_admin_seed.sql
# supabase/migrations/008_checkin_flow.sql
```

#### Configure cron app settings

Migration 008 schedules cron jobs using `current_setting('app.base_url')` and `current_setting('app.cron_secret')`. Set these in Supabase → SQL Editor:

```sql
alter database postgres set app.base_url = 'https://your-app.vercel.app';
alter database postgres set app.cron_secret = 'your-cron-secret-here';
```

These must match `CRON_SECRET` in your environment.

#### Create the first admin user

1. Register an account normally at `/register`.
2. In Supabase → Authentication → Users, find the user and run in SQL Editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
where email = 'your@email.com';
```

### 4. Add properties

Properties are not yet manageable in the UI. Insert them directly in Supabase → Table Editor or SQL Editor:

```sql
insert into public.properties (name, address, city, nuki_device_id, parking_enabled, checkin_review_mode)
values
  ('Flat 1A', 'Obchodná 12', 'Bratislava', 'NUKI_DEVICE_ID', false, 'auto'),
  ('Flat 2B', 'Laurinská 5',  'Bratislava', 'NUKI_DEVICE_ID', true,  'conditions');
```

Set `checkin_review_conditions` for properties with mode `conditions`:

```sql
update public.properties
set checkin_review_conditions = '{"cities": ["Bratislava"], "non_eu": true}'::jsonb
where name = 'Flat 2B';
```

### 5. Booking.com automated messages

Set up one automated message template to send the onboarding link to every guest. In the Booking.com extranet:

> **Property → Messaging → Automated messages → New message**
> - Trigger: **X days before arrival** (recommended: 2 days)
> - Message body (example):
>
> *Hi [guest_name], your check-in at [property_name] is coming up. Please complete your online check-in in advance to receive your door access codes and all stay information: https://checkin.yourdomain.com/welcome — it takes under 2 minutes.*

This single template replaces all messaging API requirements.

### 6. Run locally

```bash
npm run dev
```

The app runs at `http://localhost:3000`. Guest onboarding is at `/welcome`.

---

## Deployment (Vercel)

```bash
vercel deploy
```

Set all environment variables in Vercel → Project → Settings → Environment Variables.

Cron jobs run from Supabase's pg_cron scheduler and call your deployed app URLs. No Vercel cron configuration is needed.

---

## Gotchas and limitations

### Booking.com phone numbers are unreliable

The XML API provides a phone number on confirmed reservations, but it may be:
- A relay/masked number (in some markets)
- Missing entirely (field not present in payload)
- Incorrect (guest entered a wrong number at booking time)

The verify step handles this with adaptive logic: if we have the number it's used for soft verification; if we don't, the guest's entered number is collected as-is. Phone mismatch does **not** block the guest — the name + booking number pair is the primary security gate.

### Booking.com messaging API requires a certified channel manager

Sending messages programmatically via the Booking.com Connectivity API requires becoming a certified connectivity partner, which is a months-long process designed for PMS vendors — not practical for independent operators. The current approach (static URL in automated message templates) achieves the same result for free with zero API integration.

If you later connect via a channel manager, implement `lib/messaging/booking-com.ts` — the rest of the system doesn't change.

### Lock providers: only Nuki is implemented

The lock abstraction (`lib/locks/index.ts`) supports `nuki`, `lockin`, and `loki` — but only Nuki has a working implementation. Lockin and Loki throw `LockProviderNotImplementedError`. Set `lock_provider = 'nuki'` on all properties until the other SDKs are implemented.

### Parking integration is a stub

`lib/parking/client.ts` returns a hardcoded string and logs a warning. The actual integration depends on the hardware relay model you install. Wire up the HTTP or Twilio SMS call inside that function when the hardware is in place.

### Accounting API contract is not defined

`/api/cron/generate-invoices` calls `ACCOUNTING_API_URL/invoices` with a JSON payload and expects `{ id, pdf? }` back. Adapt the request/response shape in that route to match whatever your accountant's API actually provides.

### Airbnb integration is partial

The Airbnb webhook receiver (`/api/webhooks/airbnb`) and sync endpoint exist but have not been tested against the live Airbnb API. The check-in onboarding flow at `/welcome` works for any platform — guests just need their reservation ID (which on Airbnb is the confirmation code).

### ID numbers are encrypted at rest, but recoverable

AES-256-GCM is used with a single application-level key (`ENCRYPTION_KEY`). This protects against database leaks but does not protect against a compromised server. Rotate the key and re-encrypt if the server is compromised. The key lives only in environment variables — never commit it.

### GDPR / compliance exports

Compliance exports (city tax, police registration) produce CSV files served in-browser. No files are stored on disk or in object storage — they are generated on demand. Guest data anonymisation runs on a Supabase cron schedule defined in `003_cron.sql`; adjust the retention period there.

### Multi-property RLS

Row-Level Security is enforced at the database level. Guests see only their own reservations. Admins (role set in `auth.users.raw_app_meta_data`) see everything. There is no per-property admin scoping — all admins see all properties. If you need property-level admin roles, extend the RLS policies in `002_rls.sql`.

### No email verification on account creation

Guests create accounts during the check-in wizard without email verification. Supabase email confirmation is intentionally not required — adding friction at that step causes drop-off. The booking number + last name verification before account creation is the identity gate.

To enable email confirmation anyway: Supabase → Authentication → Email → Enable email confirmations. You will also need to handle the confirmation callback redirect (`/auth/callback`).
