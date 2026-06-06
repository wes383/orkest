-- AI Daily Limit: Trial Expiration Support
-- Execute this in Supabase Dashboard > SQL Editor
-- Updates the sync_ai_limits_from_subscription trigger to set daily_limit to 0 when trial expires

CREATE OR REPLACE FUNCTION public.sync_ai_limits_from_subscription()
RETURNS TRIGGER AS $$
DECLARE
  signup_date TIMESTAMPTZ;
  trial_end TIMESTAMPTZ;
  now_ts TIMESTAMPTZ;
  is_trial_active BOOLEAN;
BEGIN
  -- Pro subscription: always 200
  IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
    INSERT INTO public.user_ai_limits (user_id, daily_limit)
    VALUES (NEW.user_id, 200)
    ON CONFLICT (user_id) DO UPDATE SET daily_limit = 200;
    RETURN NEW;
  END IF;

  -- No active subscription: check 7-day trial window
  SELECT created_at INTO signup_date
  FROM auth.users
  WHERE id = NEW.user_id;

  IF signup_date IS NOT NULL THEN
    trial_end := signup_date + INTERVAL '7 days';
    now_ts := now();
    is_trial_active := now_ts < trial_end;

    IF is_trial_active THEN
      -- Trial still active: 50 messages/day
      INSERT INTO public.user_ai_limits (user_id, daily_limit)
      VALUES (NEW.user_id, 50)
      ON CONFLICT (user_id) DO UPDATE SET daily_limit = 50;
    ELSE
      -- Trial expired: 0 messages/day
      INSERT INTO public.user_ai_limits (user_id, daily_limit)
      VALUES (NEW.user_id, 0)
      ON CONFLICT (user_id) DO UPDATE SET daily_limit = 0;
    END IF;
  ELSE
    -- Fallback: no user record found, set to 0
    INSERT INTO public.user_ai_limits (user_id, daily_limit)
    VALUES (NEW.user_id, 0)
    ON CONFLICT (user_id) DO UPDATE SET daily_limit = 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create a trigger on auth.users to set initial AI limit on signup
-- This ensures new users get 50/day immediately upon registration
CREATE OR REPLACE FUNCTION public.set_ai_limit_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- New user gets 50/day (trial period)
  INSERT INTO public.user_ai_limits (user_id, daily_limit)
  VALUES (NEW.id, 50)
  ON CONFLICT (user_id) DO UPDATE SET daily_limit = 50;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_ai_limit_on_signup ON auth.users;
CREATE TRIGGER trigger_set_ai_limit_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_limit_on_signup();

-- Cron job: Check trial expiration and update AI limits daily
-- Runs every day at 2:00 AM UTC
-- Updates users whose trial has expired but still have daily_limit > 0
CREATE OR REPLACE FUNCTION public.expire_expired_trials()
RETURNS void AS $$
BEGIN
  UPDATE public.user_ai_limits
  SET daily_limit = 0
  WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.user_subscriptions s ON u.id = s.user_id
    WHERE (s.status IS NULL OR s.status NOT IN ('active', 'trialing'))
      AND u.created_at < now() - INTERVAL '7 days'
  )
  AND daily_limit > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'expire-trials',
  '0 2 * * *',
  $$SELECT public.expire_expired_trials();$$
);
