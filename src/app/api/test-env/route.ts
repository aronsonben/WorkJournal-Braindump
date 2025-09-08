import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Environment test endpoint',
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY
    }
  });
}