CREATE TABLE public.daily_onthisday_translations (
  event_date DATE NOT NULL,
  locale TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_date, locale)
);

-- Allow anonymous reads (shared translation cache)
-- Writes only via server-side Admin Client (service_role_key)
ALTER TABLE public.daily_onthisday_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily onthisday translations"
  ON public.daily_onthisday_translations FOR SELECT
  USING (true);

CREATE INDEX idx_daily_onthisday_date
  ON public.daily_onthisday_translations(event_date);
