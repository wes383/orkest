CREATE TABLE public.daily_movie_translations (
  movie_date DATE NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  genres TEXT NOT NULL,
  directors TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  imdb_id TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (movie_date, locale)
);

ALTER TABLE public.daily_movie_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily movie translations"
  ON public.daily_movie_translations FOR SELECT
  USING (true);

CREATE INDEX idx_daily_movie_date
  ON public.daily_movie_translations(movie_date);
