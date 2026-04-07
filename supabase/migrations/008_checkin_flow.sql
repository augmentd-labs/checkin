-- Migration 008: Check-in flow automation

-- ─── reservations: check-in lifecycle timestamps + platform phone ─────────────

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS platform_guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS checkin_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Extend status check to include check-in states
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_status_check;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check CHECK (
    status IN ('confirmed', 'cancelled', 'modified', 'checkin_submitted', 'checked_in', 'checked_out')
  );

-- Indexes for fast cron queries
CREATE INDEX IF NOT EXISTS reservations_check_in_status_idx ON public.reservations (check_in, status);
CREATE INDEX IF NOT EXISTS reservations_platform_res_id_idx ON public.reservations (platform_reservation_id);

-- ─── properties: review mode + access/wifi config ────────────────────────────

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS checkin_review_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (checkin_review_mode IN ('auto', 'always_review', 'conditions')),
  ADD COLUMN IF NOT EXISTS checkin_review_conditions JSONB NOT NULL DEFAULT '{}',
  -- shape: { "cities": ["Bratislava"], "countries": ["SK"], "non_eu": true }
  ADD COLUMN IF NOT EXISTS lock_provider TEXT NOT NULL DEFAULT 'nuki'
    CHECK (lock_provider IN ('nuki', 'lockin', 'loki')),
  ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
  ADD COLUMN IF NOT EXISTS wifi_password TEXT,
  ADD COLUMN IF NOT EXISTS house_rules_url TEXT;

-- ─── pending_messages: outbound queue (kept for future programmatic messaging) ─

CREATE TABLE IF NOT EXISTS public.pending_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_reservation_id TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_messages_unsent_idx
  ON public.pending_messages (sent_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to pending_messages"
  ON public.pending_messages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── Cron: provision access codes every 15 min ───────────────────────────────

SELECT cron.schedule(
  'provision-access-codes',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.base_url') || '/api/cron/provision-access-codes',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- ─── Cron: generate invoices daily at 10:00 ──────────────────────────────────

SELECT cron.schedule(
  'generate-invoices',
  '0 10 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.base_url') || '/api/cron/generate-invoices',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);
