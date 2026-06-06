CREATE TABLE public.daily_quote_translations (
  quote_date DATE NOT NULL,
  locale TEXT NOT NULL,
  quote TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT[] NOT NULL DEFAULT '{}',
  source_id INTEGER NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quote_date, locale)
);

ALTER TABLE public.daily_quote_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily quote translations"
  ON public.daily_quote_translations FOR SELECT
  USING (true);

CREATE INDEX idx_daily_quote_translations_date
  ON public.daily_quote_translations(quote_date);
