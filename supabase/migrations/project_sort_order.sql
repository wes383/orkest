-- Add sort_order column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_projects_user_sort_order ON projects(user_id, sort_order);
