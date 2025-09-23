import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Entry {
  id: string
  content: string
  word_count: number
  created_at: string
  tags?: string[]
  status?: 'in_progress' | 'completed' | 'blocked' | 'cancelled'
  workflow_stage?: 'documented' | 'planning' | 'in_progress' | 'review' | 'completed'
  blocked_reason?: string
  completion_percentage?: number
}

export interface Task {
  id: string
  content: string
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  completed_at?: string
  user_id: string
  entry_id: string
  source: 'way_ahead' | 'manual' | 'ai_suggested'
  priority: number
  metadata?: Record<string, unknown>
}

// Braindump Mode Additions
export interface Braindump {
  id: string
  user_id: string
  raw_text: string
  created_at: string
  finalized_at?: string | null
  task_count: number
  metadata?: Record<string, unknown>
}

export interface BraindumpTask extends Task {
  braindump_id?: string | null
  original_line?: string | null
  normalized?: string | null
  category?: string | null
  priority_group?: number | null // 1 (Must Do) .. 4 (Want To Do)
  ai_suggested_priority?: number | null
  action?: 'keep' | 'merge' | 'drop' | 'clarify'
  rationale?: string | null
  time_estimate_minutes?: number | null
  energy_level?: 'low' | 'medium' | 'high' | null
  quick_win?: boolean | null
  blocking?: boolean | null
  dependencies?: string[] | null
  shininess_rank?: number | null
  urgency_rank?: number | null
  longevity?: number | null
  base_priority_rank?: number | null
  score?: number | null
  overall_rank?: number | null
  scoring_explanation?: string | null
  similarity_group?: string | null
  merged_from?: any
}

export interface TaskCategory {
  id: string
  user_id: string
  name: string
  usage_count: number
  created_at: string
}

export interface CategorizedTaskSuggestion {
  line: string
  normalized: string
  suggested_category?: string
  suggested_priority?: number // 1 (low) - 5 (high)
  action: 'keep' | 'merge' | 'clarify' | 'drop'
  rationale?: string // brief reason (<=120 chars)
  subtasks: string[]
  time_estimate_minutes: number | null
  energy_level: 'low' | 'medium' | 'high'
  quick_win: boolean
  blocking: boolean
  dependencies: string[] // normalized forms or index refs
}

export interface BraindumpAnalysisResult {
  categories: string[]
  tasks: CategorizedTaskSuggestion[]
  summary: string
  detected_duplicates: Array<{
    existing_task_index: number
    new_task_index: number
    similarity: number // 0-1
  }>
  focus_suggestion: {
    today_top_3: number[]
    batching_groups: Array<{
      label: string
      task_indices: number[]
    }>
    first_next_action: {
      task_index: number
      why: string
    }
  }
  stats: {
    total_tasks: number
    categorized: number
    uncategorized: number
    quick_wins: number
    estimated_total_minutes: number
  }
}

export interface SimpleBraindumpAnalysisResult {
  response: string
}
