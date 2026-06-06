-- User Subscriptions Table: Database Migration
-- Execute this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT UNIQUE,
  status TEXT, -- 'active', 'trialing', 'past_due', 'paused', 'canceled'
  price_id TEXT,
  customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own subscription data
DROP POLICY IF EXISTS "Users can read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- PostgreSQL trigger to sync daily AI limits automatically
CREATE OR REPLACE FUNCTION public.sync_ai_limits_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' OR NEW.status = 'trialing' THEN
    INSERT INTO public.user_ai_limits (user_id, daily_limit)
    VALUES (NEW.user_id, 200)
    ON CONFLICT (user_id) DO UPDATE SET daily_limit = 200;
  ELSE
    INSERT INTO public.user_ai_limits (user_id, daily_limit)
    VALUES (NEW.user_id, 50)
    ON CONFLICT (user_id) DO UPDATE SET daily_limit = 50;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_user_subscriptions_sync_ai_limits ON public.user_subscriptions;
CREATE TRIGGER trigger_user_subscriptions_sync_ai_limits
  AFTER INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ai_limits_from_subscription();

-- Automatic update for updated_at
DROP TRIGGER IF EXISTS trigger_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trigger_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
