-- Migration: convert tasks.category from enum to TEXT and drop enum
-- Date: 2025-09-23

BEGIN;

-- 1. Remove dependent indexes if they rely specifically on enum (keep name reuse safe)
DROP INDEX IF EXISTS idx_tasks_category;

-- 2. Alter column type from enum to TEXT (using USING cast)
ALTER TABLE public.tasks
  ALTER COLUMN category DROP DEFAULT,
  ALTER COLUMN category TYPE TEXT USING category::text,
  ALTER COLUMN category SET DEFAULT 'uncategorized';

-- 3. Update braindump_task_stats materialized view dependency if it references enum-specific logic
DROP MATERIALIZED VIEW IF EXISTS public.braindump_task_stats;
CREATE MATERIALIZED VIEW public.braindump_task_stats AS
SELECT 
  b.id AS braindump_id,
  b.created_at AS braindump_created_at,
  count(t.id) AS total_tasks,
  count(*) FILTER (WHERE t.status = 'completed') AS completed_tasks,
  count(*) FILTER (WHERE t.category = 'quick_win') AS quick_wins,
  count(*) FILTER (WHERE t.priority >= 4) AS high_priority
FROM public.braindumps b
LEFT JOIN public.tasks t ON t.braindump_id = b.id
GROUP BY b.id, b.created_at;

-- 4. Recreate index on category (now TEXT)
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);

-- 5. Drop enum type (will fail if still in use anywhere)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_category') THEN
    DROP TYPE task_category;
  END IF;
END $$;

COMMIT;
