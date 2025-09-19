// Server-only Gemini client helper. Avoid importing in client components.
import type { NextRequest } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  // Not throwing so local dev without key still works (falls back to heuristics)
  console.warn('[gemini] GEMINI_API_KEY missing; AI features will use fallbacks.');
}

interface GenerateOptions {
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
  model?: string;
  timeoutMs?: number;
}

export async function generateGeminiJSON<T=unknown>({ prompt, maxOutputTokens = 800, temperature = 0.4, model = 'gemini-1.5-flash-8b-latest', timeoutMs = 15000 }: GenerateOptions): Promise<T | null> {
  if (!GEMINI_API_KEY) return null;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens }
      })
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(json)?/,'').replace(/```$/,'').trim();
    }
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn('[gemini] fallback due to error:', e);
    return null;
  } finally {
    clearTimeout(id);
  }
}
