import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scoreBraindump } from '@/lib/server/scoring';
import { normalizeTaskLine } from '@/lib/braindump-utils';

interface IncomingTask {
  line: string;
  category?: string;
  priority?: number; // 1-5 scale from UI (AI suggested or user adjusted)
  action: 'keep' | 'merge' | 'drop' | 'clarify' | 'ignore';
}

export async function POST(req: NextRequest) {
  try {
    const { raw_text, tasks } = await req.json();
    if (!raw_text || !Array.isArray(tasks)) {
      return NextResponse.json({ error: 'raw_text and tasks required'}, { status: 400 });
    }

    const kept: IncomingTask[] = tasks.filter((t: IncomingTask) => t.action === 'keep' || t.action === 'merge');
    if (kept.length === 0) return NextResponse.json({ error: 'No tasks to save' }, { status: 400 });

    const { data: bdInsert, error: bdError } = await supabase
      .from('braindumps')
      .insert({ raw_text, task_count: kept.length })
      .select('*')
      .single();
    if (bdError || !bdInsert) throw bdError;

    const braindumpId = bdInsert.id;

    const taskRows = kept.map(t => {
      const normalized = normalizeTaskLine(t.line);
      const priority = clampPriority(t.priority ?? 3);
      return {
        content: t.line,
        status: 'todo',
        source: 'ai_suggested',
        priority,
  category: (t.category || 'uncategorized').trim(),
        original_line: t.line,
        braindump_id: braindumpId,
        normalized,
        priority_group: mapPriorityToGroup(priority),
        action: t.action === 'ignore' ? 'clarify' : (t.action === 'merge' ? 'merge' : (t.action as any))
      };
    });

    const { error: taskError } = await supabase.from('tasks').insert(taskRows);
    if (taskError) throw taskError;

    let scoring_result: any = null;
    try {
      scoring_result = await scoreBraindump(braindumpId);
    } catch (scErr) {
      console.error('Scoring failed (non-fatal)', scErr);
    }

    return NextResponse.json({ braindump_id: braindumpId, tasks_saved: taskRows.length, scoring_result });
  } catch (e: any) {
    console.error('Finalize error', e);
    return NextResponse.json({ error: e.message || 'Internal error'}, { status: 500 });
  }
}

function clampPriority(p: number) { return Math.min(5, Math.max(1, p)); }

function mapPriorityToGroup(p: number): number {
  if (p >= 5) return 1; // Must Do
  if (p === 4) return 2; // Need
  if (p === 3) return 3; // Should
  return 4; // Want (1-2)
}

// getUserId removed – single-user mode
