-- AI Daily Chat Limit: Database Migration
-- Execute this in Supabase Dashboard > SQL Editor

-- 用户 AI 对话限额配置表
CREATE TABLE public.user_ai_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户 AI 对话每日使用量表
CREATE TABLE public.user_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- 索引：按日期清理和后台统计
CREATE INDEX idx_user_ai_usage_date
  ON public.user_ai_usage(usage_date);

-- 启用 RLS
ALTER TABLE public.user_ai_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能读取自己的限额（写入由服务端 service role 完成）
CREATE POLICY "Users can read own AI limits"
  ON public.user_ai_limits FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能读取自己的用量
CREATE POLICY "Users can read own AI usage"
  ON public.user_ai_usage FOR SELECT
  USING (auth.uid() = user_id);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_ai_limits_updated_at
  BEFORE UPDATE ON public.user_ai_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_old_ai_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_ai_usage WHERE usage_date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'cleanup-ai-usage',
  '0 3 * * *',
  $$SELECT public.cleanup_old_ai_usage();$$
);
