CREATE TABLE public.daily_digests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  motivational_message TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, digest_date)
);

ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily digest"
  ON public.daily_digests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily digest"
  ON public.daily_digests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily digest"
  ON public.daily_digests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_daily_digests_date
  ON public.daily_digests(digest_date);
