CREATE TABLE IF NOT EXISTS public.daily_digest_email (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_hour SMALLINT NOT NULL DEFAULT 8 CHECK (send_hour >= 0 AND send_hour <= 23),
  timezone_offset SMALLINT NOT NULL DEFAULT 0,
  last_sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_digest_email ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_digest_email TO authenticated;

DROP POLICY IF EXISTS "Users can read own digest email settings" ON public.daily_digest_email;
CREATE POLICY "Users can read own digest email settings"
  ON public.daily_digest_email
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own digest email settings" ON public.daily_digest_email;
CREATE POLICY "Users can insert own digest email settings"
  ON public.daily_digest_email
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own digest email settings" ON public.daily_digest_email;
CREATE POLICY "Users can update own digest email settings"
  ON public.daily_digest_email
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own digest email settings" ON public.daily_digest_email;
CREATE POLICY "Users can delete own digest email settings"
  ON public.daily_digest_email
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_daily_digest_email_updated_at ON public.daily_digest_email;
CREATE TRIGGER trigger_daily_digest_email_updated_at
  BEFORE UPDATE ON public.daily_digest_email
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
