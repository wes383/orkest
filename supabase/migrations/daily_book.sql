CREATE TABLE public.daily_book_translations (
  book_date DATE NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER NOT NULL,
  language TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_date, locale)
);

-- Allow anonymous reads (shared translation cache)
-- Writes only via server-side Admin Client (service_role_key)
ALTER TABLE public.daily_book_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily book translations"
  ON public.daily_book_translations FOR SELECT
  USING (true);

CREATE INDEX idx_daily_book_date
  ON public.daily_book_translations(book_date);
