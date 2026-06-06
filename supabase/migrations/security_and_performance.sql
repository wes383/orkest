-- Security & Performance Migration
-- Fixes: atomic AI usage increment, atomic account deletion, cron_settings RLS, items index

-- ============================================================================
-- 1. Atomic AI usage increment (fixes TOCTOU race condition)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id UUID,
  p_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_ai_usage (user_id, usage_date, usage_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET usage_count = public.user_ai_usage.usage_count + 1;
END;
$$;

-- ============================================================================
-- 2. Atomic user data cascade deletion (runs in a single transaction)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_data_cascade(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete in dependency order (children before parents)
  DELETE FROM public.ai_messages WHERE user_id = p_user_id;
  DELETE FROM public.ai_conversations WHERE user_id = p_user_id;
  DELETE FROM public.ai_user_memory WHERE user_id = p_user_id;
  DELETE FROM public.user_ai_usage WHERE user_id = p_user_id;
  DELETE FROM public.user_ai_limits WHERE user_id = p_user_id;
  DELETE FROM public.focus_sessions WHERE user_id = p_user_id;
  DELETE FROM public.daily_digest_email WHERE user_id = p_user_id;
  DELETE FROM public.daily_digests WHERE user_id = p_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.user_settings WHERE user_id = p_user_id;
  DELETE FROM public.google_calendar_connections WHERE user_id = p_user_id;
  DELETE FROM public.items WHERE user_id = p_user_id;
  DELETE FROM public.projects WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- 3. Enable RLS on cron_settings table
-- ============================================================================

ALTER TABLE public.cron_settings ENABLE ROW LEVEL SECURITY;

-- Only service_role can access cron_settings (cron functions use SECURITY DEFINER)
-- No policies needed for regular users; service_role bypasses RLS automatically.

-- ============================================================================
-- 4. Composite index on items for common user queries
-- ============================================================================

-- Most queries filter by user_id + deleted_at IS NULL (active items)
CREATE INDEX IF NOT EXISTS idx_items_user_active
  ON public.items(user_id)
  WHERE deleted_at IS NULL;

-- Index for queries filtering by user_id with specific status
CREATE INDEX IF NOT EXISTS idx_items_user_status
  ON public.items(user_id, status)
  WHERE deleted_at IS NULL;

-- Index for date-based queries (today page, calendar view)
CREATE INDEX IF NOT EXISTS idx_items_user_start_date
  ON public.items(user_id, start_date)
  WHERE deleted_at IS NULL AND start_date IS NOT NULL;
