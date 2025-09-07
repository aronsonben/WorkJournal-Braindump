import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent(`You are an AI assistant that analyzes work journal entries. Provide concise, actionable insights about the user's work experience, achievements, challenges, and suggestions for improvement. Keep your response under 200 words.

Analyze this work journal entry and provide insights:

${content}`);

    const response = await result.response;
    const insights = response.text() || 'Unable to generate insights at this time.';

    return NextResponse.json({ insights });
  } catch (error: unknown) {
    console.error('Error analyzing entry:', error);
    
    // Handle specific Gemini errors
    const errorObj = error as { status?: number };
    if (errorObj?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid Gemini API key. Please check your configuration.' },
        { status: 401 }
      );
    }
    
    if (errorObj?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to analyze entry. Please try again.' },
      { status: 500 }
    );
  }
}
