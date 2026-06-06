-- Supabase Cron for Google Calendar sync
-- Requires: pg_cron and pg_net extensions enabled in Supabase Dashboard → Database → Extensions

-- Settings table for cron configuration
CREATE TABLE IF NOT EXISTS public.cron_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default values (update these after migration)
INSERT INTO public.cron_settings (key, value) VALUES
  ('site_url', 'http://localhost:3000'),
  ('cron_secret', '')
ON CONFLICT (key) DO NOTHING;

-- Helper: read setting
CREATE OR REPLACE FUNCTION public.get_cron_setting(setting_key text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT value FROM public.cron_settings WHERE key = setting_key;
$$;

-- Function: renew expiring Google Calendar notification channels
CREATE OR REPLACE FUNCTION public.cron_renew_google_channels()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  site_url text;
  cron_secret text;
BEGIN
  site_url := public.get_cron_setting('site_url');
  cron_secret := public.get_cron_setting('cron_secret');

  IF site_url IS NULL OR site_url = '' THEN
    RAISE WARNING 'site_url is not configured, skipping channel renewal';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := site_url || '/api/google-calendar/renew-channels/cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(cron_secret, ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Function: fallback sync for all Google Calendar connections
CREATE OR REPLACE FUNCTION public.cron_google_calendar_sync()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  site_url text;
  cron_secret text;
BEGIN
  site_url := public.get_cron_setting('site_url');
  cron_secret := public.get_cron_setting('cron_secret');

  IF site_url IS NULL OR site_url = '' THEN
    RAISE WARNING 'site_url is not configured, skipping sync';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := site_url || '/api/google-calendar/sync/cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || COALESCE(cron_secret, ''),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule: renew channels every 6 hours
SELECT cron.schedule(
  'google-renew-channels',
  '0 */6 * * *',
  $$SELECT public.cron_renew_google_channels()$$
);

-- Schedule: fallback sync every 6 hours (offset by 30 min)
SELECT cron.schedule(
  'google-calendar-sync',
  '30 */6 * * *',
  $$SELECT public.cron_google_calendar_sync()$$
);
