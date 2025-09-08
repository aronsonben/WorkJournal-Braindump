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
