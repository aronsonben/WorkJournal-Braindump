// Configuration for WorkJournal Desktop Widget
// This file reads environment variables to configure the widget
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const dotenv = require('dotenv');
// Load .env from current working directory (dev)
dotenv.config();
// Also try to load .env next to this file (packaged app)
dotenv.config({ path: path.join(__dirname, '.env') });

// You can either:
// 1. Create a .env file in this directory with your values
// 2. Set environment variables before running the app
// 3. Copy values directly from your main app's .env.local file

const CONFIG = {
  // Your Vercel deployment URL
  API_ENDPOINT: process.env.WORKJOURNAL_API_ENDPOINT || 'https://work-journal-omega.vercel.app/api/entries',
  // Base site URL for calling analysis endpoints
  WORKJOURNAL_SITE_URL: process.env.WORKJOURNAL_SITE_URL || 'https://work-journal-omega.vercel.app',
  // Analysis endpoint (tags + story elements + depth)
  ANALYSIS_ENDPOINT: process.env.WORKJOURNAL_ANALYSIS_ENDPOINT || null,
  
  // Optional API key if you implement custom authentication
  API_KEY: process.env.WORKJOURNAL_API_KEY || null,
  
  // Supabase configuration (copy from your main app's .env.local)
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'your-supabase-project-url',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key'
};

// Validate configuration
function validateConfig() {
  const missing = [];
  
  if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL === 'your-supabase-project-url') {
    missing.push('SUPABASE_URL');
  }
  
  if (!CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY === 'your-supabase-anon-key') {
    missing.push('SUPABASE_ANON_KEY');
  }
  
  if (missing.length > 0) {
    console.warn('Missing configuration:', missing.join(', '));
    console.warn('Please copy values from your main app .env.local file');
    return false;
  }
  
  return true;
}

// Helper to compute effective analysis endpoint
function getAnalysisEndpoint() {
  return CONFIG.ANALYSIS_ENDPOINT || `${CONFIG.WORKJOURNAL_SITE_URL}/api/generate-tags`;
}

module.exports = { CONFIG, validateConfig, getAnalysisEndpoint };
