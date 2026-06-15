-- Progress system: user-defined progress trackers with goals and bound tasks.

CREATE TABLE IF NOT EXISTS progresses (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description     text CHECK (description IS NULL OR char_length(description) <= 500),
  goal_value      numeric NOT NULL CHECK (goal_value > 0),
  goal_unit       text NOT NULL DEFAULT 'tasks' CHECK (char_length(goal_unit) <= 40),
  tracking_mode   text NOT NULL DEFAULT 'count' CHECK (tracking_mode IN ('count', 'percentage', 'manual')),
  manual_value    numeric NOT NULL DEFAULT 0 CHECK (manual_value >= 0),
  color           text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_date     date,
  sort_order      integer,
  ai_context      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progresses_user ON progresses(user_id);
CREATE INDEX IF NOT EXISTS idx_progresses_user_sort_order ON progresses(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_progresses_user_status ON progresses(user_id, status);

CREATE TABLE IF NOT EXISTS progress_tasks (
  id           text PRIMARY KEY,
  progress_id  text NOT NULL REFERENCES progresses(id) ON DELETE CASCADE,
  item_id      text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  weight       numeric NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  added_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (progress_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_tasks_progress ON progress_tasks(progress_id);
CREATE INDEX IF NOT EXISTS idx_progress_tasks_item ON progress_tasks(item_id);

ALTER TABLE progresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tasks ENABLE ROW LEVEL SECURITY;

-- progresses policies
DROP POLICY IF EXISTS "progresses_select_own" ON progresses;
CREATE POLICY "progresses_select_own" ON progresses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_insert_own" ON progresses;
CREATE POLICY "progresses_insert_own" ON progresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_update_own" ON progresses;
CREATE POLICY "progresses_update_own" ON progresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_delete_own" ON progresses;
CREATE POLICY "progresses_delete_own" ON progresses
  FOR DELETE USING (auth.uid() = user_id);

-- progress_tasks policies (enforce user ownership via the parent row)
DROP POLICY IF EXISTS "progress_tasks_select_own" ON progress_tasks;
CREATE POLICY "progress_tasks_select_own" ON progress_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_insert_own" ON progress_tasks;
CREATE POLICY "progress_tasks_insert_own" ON progress_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_update_own" ON progress_tasks;
CREATE POLICY "progress_tasks_update_own" ON progress_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_delete_own" ON progress_tasks;
CREATE POLICY "progress_tasks_delete_own" ON progress_tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM items i WHERE i.id = progress_tasks.item_id AND i.user_id = auth.uid())
  );
