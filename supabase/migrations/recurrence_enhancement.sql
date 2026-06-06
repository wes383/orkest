-- Recurrence Enhancement Migration
-- Adds support for BYSETPOS (nth weekday of month) and COUNT (repeat N times)

-- Step 1: Ensure 'after_count' is accepted by recurrence_end_type column.
-- The column may be: (a) a standalone ENUM, (b) text with a CHECK constraint, or (c) plain text.
-- We handle all three cases.

DO $$
DECLARE
  enum_exists boolean;
  check_def text;
BEGIN
  -- Check if recurrence_end_type is a standalone PostgreSQL ENUM type
  SELECT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'recurrence_end_type' AND n.nspname = 'public'
  ) INTO enum_exists;

  IF enum_exists THEN
    -- Case A: It's an ENUM type — add the new value if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE t.typname = 'recurrence_end_type' AND n.nspname = 'public' AND e.enumlabel = 'after_count'
    ) THEN
      ALTER TYPE public.recurrence_end_type ADD VALUE IF NOT EXISTS 'after_count';
    END IF;
  ELSE
    -- Case B/C: It's a text column (possibly with a CHECK constraint)
    -- Drop any existing CHECK constraint that limits recurrence_end_type values
    SELECT pg_get_constraintdef(c.oid) INTO check_def
    FROM pg_constraint c
    JOIN pg_class r ON c.conrelid = r.oid
    JOIN pg_namespace n ON r.relnamespace = n.oid
    WHERE r.relname = 'items' AND n.nspname = 'public'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%recurrence_end_type%';

    IF check_def IS NOT NULL THEN
      -- Find and drop the existing CHECK constraint
      DECLARE
        constraint_name text;
      BEGIN
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_namespace n ON r.relnamespace = n.oid
        WHERE r.relname = 'items' AND n.nspname = 'public'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%recurrence_end_type%';

        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE public.items DROP CONSTRAINT %I', constraint_name);
        END IF;
      END;
    END IF;

    -- Add a new CHECK constraint that includes 'after_count'
    ALTER TABLE public.items
      ADD CONSTRAINT items_recurrence_end_type_check
      CHECK (recurrence_end_type IN ('never', 'on_date', 'after_count'));
  END IF;
END $$;

-- Step 2: Add new columns to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS recurrence_count integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_bysetpos integer DEFAULT NULL;
