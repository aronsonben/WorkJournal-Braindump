-- WorkJournal Database Setup for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for enums
CREATE TYPE entry_status AS ENUM ('in_progress', 'completed', 'blocked', 'cancelled');
CREATE TYPE workflow_stage AS ENUM ('documented', 'planning', 'in_progress', 'review', 'completed');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_source AS ENUM ('way_ahead', 'manual', 'ai_suggested');

-- Create entries table
CREATE TABLE public.entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tags TEXT[] DEFAULT '{}',
    status entry_status DEFAULT NULL,
    workflow_stage workflow_stage DEFAULT NULL,
    blocked_reason TEXT DEFAULT NULL,
    completion_percentage INTEGER DEFAULT NULL CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Create tasks table
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content TEXT NOT NULL,
    status task_status DEFAULT 'todo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
    source task_source DEFAULT 'manual',
    priority INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX idx_entries_user_id ON public.entries(user_id);
CREATE INDEX idx_entries_created_at ON public.entries(created_at DESC);
CREATE INDEX idx_entries_status ON public.entries(status);
CREATE INDEX idx_entries_workflow_stage ON public.entries(workflow_stage);
CREATE INDEX idx_entries_tags ON public.entries USING GIN(tags);

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_entry_id ON public.tasks(entry_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX idx_tasks_priority ON public.tasks(priority DESC);

-- Create function to automatically update word_count when content changes
CREATE OR REPLACE FUNCTION update_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update word_count
CREATE TRIGGER trigger_update_word_count
    BEFORE INSERT OR UPDATE OF content ON public.entries
    FOR EACH ROW
    EXECUTE FUNCTION update_word_count();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_entries_updated_at
    BEFORE UPDATE ON public.entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically set completed_at when task status changes to completed
CREATE OR REPLACE FUNCTION update_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for completed_at
CREATE TRIGGER trigger_task_completed_at
    BEFORE UPDATE OF status ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_completed_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for entries table
CREATE POLICY "Users can view their own entries" ON public.entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries" ON public.entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries" ON public.entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries" ON public.entries
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for tasks table
CREATE POLICY "Users can view their own tasks" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.entries TO authenticated;
GRANT ALL ON public.tasks TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create a view for entry statistics (optional, for analytics)
CREATE VIEW public.entry_stats AS
SELECT 
    user_id,
    COUNT(*) as total_entries,
    SUM(word_count) as total_words,
    AVG(word_count) as avg_words_per_entry,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_entries,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_entries,
    DATE(created_at) as entry_date,
    COUNT(*) as entries_per_day
FROM public.entries
GROUP BY user_id, DATE(created_at);

-- Grant access to the view
GRANT SELECT ON public.entry_stats TO authenticated;

-- Create a view for task statistics (optional, for analytics)
CREATE VIEW public.task_stats AS
SELECT 
    user_id,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN status = 'todo' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
    AVG(priority) as avg_priority,
    source,
    COUNT(*) as tasks_by_source
FROM public.tasks
GROUP BY user_id, source;

-- Grant access to the view
GRANT SELECT ON public.task_stats TO authenticated;
