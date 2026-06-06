-- Google Calendar Sync
-- Adds google_calendar_connections table and Google sync columns to items

-- Table to store user's Google Calendar OAuth connections
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_user_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_name text,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_user_id, calendar_id)
);

-- RLS policies for google_calendar_connections
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Google Calendar connections"
  ON public.google_calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google Calendar connections"
  ON public.google_calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google Calendar connections"
  ON public.google_calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google Calendar connections"
  ON public.google_calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Add Google sync columns to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS last_google_sync_at timestamptz;

-- Index for faster lookups by google_event_id
CREATE INDEX IF NOT EXISTS idx_items_google_event_id
  ON public.items(google_event_id)
  WHERE google_event_id IS NOT NULL;

-- Index for sync queries
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_user_sync
  ON public.google_calendar_connections(user_id, sync_enabled)
  WHERE sync_enabled = true;
