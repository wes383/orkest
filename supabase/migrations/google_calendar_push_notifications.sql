-- Google Calendar Push Notifications
-- Adds notification channel columns for real-time webhook sync

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS notification_channel_id text,
  ADD COLUMN IF NOT EXISTS notification_channel_token text,
  ADD COLUMN IF NOT EXISTS notification_channel_expires_at timestamptz;

-- Index for renewal cron to find channels expiring soon
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_channel_expires
  ON public.google_calendar_connections(notification_channel_expires_at)
  WHERE notification_channel_id IS NOT NULL;
