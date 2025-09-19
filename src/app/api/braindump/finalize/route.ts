import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

interface IncomingTask {
  line: string;
  category?: string;
  priority?: number;
  action: 'keep' | 'merge' | 'drop' | 'ignore';
}

export async function POST(req: NextRequest) {
  try {
    const { raw_text, tasks } = await req.json();
    if (!raw_text || !Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'raw_text and tasks required'}), { status: 400 });
    }

    const kept: IncomingTask[] = tasks.filter((t: IncomingTask) => t.action === 'keep' || t.action === 'merge');
    if (kept.length === 0) {
      return new Response(JSON.stringify({ error: 'No tasks to save'}), { status: 400 });
    }

    // Create braindump
    const { data: bdInsert, error: bdError } = await supabase
      .from('braindumps')
      .insert({ raw_text, task_count: kept.length })
      .select('id')
      .single();
    if (bdError) throw bdError;

    const braindumpId = bdInsert.id;

    const taskRows = kept.map(t => ({
      content: t.line,
      status: 'todo',
      source: 'manual',
      priority: t.priority ?? 3,
      category: t.category || 'uncategorized',
      original_line: t.line,
      braindump_id: braindumpId
    }));

    const { error: taskError } = await supabase.from('tasks').insert(taskRows);
    if (taskError) throw taskError;

    return new Response(JSON.stringify({ braindump_id: braindumpId, tasks_saved: taskRows.length }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal error'}), { status: 500 });
  }
}
