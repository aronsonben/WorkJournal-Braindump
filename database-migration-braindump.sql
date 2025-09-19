-- Braindump Mode Migration
-- Create braindumps table and extend tasks

BEGIN;

-- Enum for task categories (broad initial set; can be extended)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_category') THEN
    CREATE TYPE task_category AS ENUM ('uncategorized','quick_win','deep_work','admin','communication','planning','learning','bug','feature','ops');
  END IF;
END $$;

-- Braindumps table: stores each raw braindump session
CREATE TABLE IF NOT EXISTS public.braindumps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  task_count INTEGER DEFAULT 0,
  finalized_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for braindumps
CREATE INDEX IF NOT EXISTS idx_braindumps_user_id ON public.braindumps(user_id);
CREATE INDEX IF NOT EXISTS idx_braindumps_created_at ON public.braindumps(created_at DESC);

-- Extend tasks table: add braindump linkage, category, original line reference, priority refinement
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS braindump_id UUID REFERENCES public.braindumps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category task_category DEFAULT 'uncategorized',
  ADD COLUMN IF NOT EXISTS original_line TEXT,
  ADD COLUMN IF NOT EXISTS merged_from JSONB, -- array of task ids / lines combined
  ADD COLUMN IF NOT EXISTS similarity_group UUID, -- group id for duplicates cluster
  ADD COLUMN IF NOT EXISTS priority_explanation TEXT;

-- Indexes for new task fields
CREATE INDEX IF NOT EXISTS idx_tasks_braindump_id ON public.tasks(braindump_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_similarity_group ON public.tasks(similarity_group);

-- (Optional) Materialized view for recent braindump task stats
CREATE MATERIALIZED VIEW IF NOT EXISTS public.braindump_task_stats AS
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

-- Grant basic selects (adjust RLS policies separately)
GRANT SELECT ON public.braindump_task_stats TO anon, authenticated; -- if needed

COMMIT;

-- RLS policies (example; adapt to your auth pattern)
-- Enable RLS
ALTER TABLE public.braindumps ENABLE ROW LEVEL SECURITY;

-- Policy: users access only their braindumps
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their braindumps'
  ) THEN
    CREATE POLICY "Users can manage their braindumps" ON public.braindumps
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Extend existing tasks policies similarly to ensure linkage does not leak data.
