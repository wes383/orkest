CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'habit', 'fact', 'pattern')),
  confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT,
  embedding VECTOR(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_user_memory TO authenticated;

DROP POLICY IF EXISTS "Users can read own memories" ON public.ai_user_memory;
CREATE POLICY "Users can read own memories"
  ON public.ai_user_memory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memories" ON public.ai_user_memory;
CREATE POLICY "Users can insert own memories"
  ON public.ai_user_memory
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memories" ON public.ai_user_memory;
CREATE POLICY "Users can update own memories"
  ON public.ai_user_memory
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memories" ON public.ai_user_memory;
CREATE POLICY "Users can delete own memories"
  ON public.ai_user_memory
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user_id ON public.ai_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_category ON public.ai_user_memory(user_id, category);

DROP TRIGGER IF EXISTS trigger_ai_user_memory_updated_at ON public.ai_user_memory;
CREATE TRIGGER trigger_ai_user_memory_updated_at
  BEFORE UPDATE ON public.ai_user_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
