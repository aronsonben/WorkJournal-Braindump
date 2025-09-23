import { NextRequest, NextResponse } from 'next/server';
import { scoreBraindump } from '@/lib/server/scoring';

export async function POST(req: NextRequest) {
  try {
    const { braindump_id } = await req.json();
    if (!braindump_id) return NextResponse.json({ error: 'braindump_id required' }, { status: 400 });
    const result = await scoreBraindump(braindump_id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
// getUserId removed – single-user mode
