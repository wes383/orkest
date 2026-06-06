-- Add reminders column to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS reminders jsonb DEFAULT '[]'::jsonb;

-- Add index for querying items with reminders
CREATE INDEX IF NOT EXISTS idx_items_reminders ON public.items USING gin (reminders) WHERE reminders != '[]'::jsonb;
