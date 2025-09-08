'use client';

import { useState, useEffect } from 'react';
import { supabase, Entry } from '../lib/supabase';
import { EntryInput } from './components/entry-input';
import { ContributionGraph } from './components/contribution-graph';
import { EntryCard } from './components/entry-card';
import { MorningSummaryCard } from './components/morning-summary';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // UI state
  const [showEntriesPanel, setShowEntriesPanel] = useState(false); // overlay panel for entries list

  async function loadEntries() {
    setLoading(true);
    console.log('Loading entries...');
    
    try {
      // Test basic connection first
      const { data: testData, error: testError } = await supabase
        .from('entries')
        .select('count(*)', { count: 'exact', head: true });
      
      console.log('Connection test - count:', testData);
      console.log('Connection test - error:', testError);
      
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading entries:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      } else {
        console.log('Loaded entries:', data);
        console.log('Number of entries:', data?.length || 0);
        setEntries(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
    
    setLoading(false);
  }

  useEffect(() => {
    console.log('Component mounted, loading entries...');
    loadEntries();
  }, []);

  const handleSave = () => {
    loadEntries(); // Reload entries after saving
  };

  // Filter entries based on search
  const filteredEntries = entries.filter(entry => {
    const contentMatch = entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = entry.tags && Array.isArray(entry.tags) ? 
      entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) : false;
    return contentMatch || tagMatch;
  });

  console.log('Total entries:', entries.length);
  console.log('Filtered entries:', filteredEntries.length);
  console.log('Loading state:', loading);

  return (
    <main className="min-h-screen bg-black">
      {/* Navigation Bar */}
  <nav className="full-bleed border-b border-gray-800/50 bg-transparent">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-[#15c460] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <span className="text-xl font-semibold text-white">WorkJournal</span>
            </div>

            {/* Search (moved into header) */}
            <div className="hidden md:flex flex-1">
              <input
                type="text"
                aria-label="Search entries"
                placeholder="Search entries or tags..."
                className="w-full px-4 py-2 bg-gray-800/90 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15c460] focus:border-transparent text-gray-100 placeholder-gray-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 ml-auto">
              {/* Compact search button for mobile */}
              <div className="md:hidden">
                <button
                  onClick={() => {
                    // Simple prompt style fallback for mobile quick search
                    const value = prompt('Search entries or tags', searchTerm) || '';
                    setSearchTerm(value);
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm"
                  aria-label="Search entries"
                >
                  🔍
                </button>
              </div>
              <button
                onClick={() => setShowEntriesPanel(true)}
                className="relative px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 flex items-center gap-2 text-sm"
                aria-label="Open entries list"
              >
                <span>🗂️</span>
                <span className="hidden sm:inline">Entries</span>
                <span className="absolute -top-1 -right-1 bg-[#15c460] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{entries.length}</span>
              </button>
              <button className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700">
                Export
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Two Column Layout: Left (60%) - Graph + Search + Input, Right (40%) - Morning Summary */}
      <div className="full-bleed bg-black/95">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col lg:flex-row gap-10">
        {/* Left Column */}
        <div className="w-full lg:w-3/5 flex flex-col gap-8">
          {/* Contribution Graph */}
          <div>
            <ContributionGraph entries={entries} />
          </div>

            {/* (Search bar moved to header) */}

          {/* Entry Input Section */}
          <EntryInput onSave={handleSave} />
        </div>

        {/* Right Column */}
        <div className="w-full lg:w-2/5 lg:sticky lg:top-4 h-fit">
          <MorningSummaryCard
            lastEntryCreatedAt={entries[0]?.created_at || null}
            entryCount={entries.length}
          />
        </div>
        </div>
      </div>

      {/* Entries Overlay Panel */}
      {showEntriesPanel && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowEntriesPanel(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] md:w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <span>🗂️</span> Your Entries
              </h3>
              <button
                onClick={() => setShowEntriesPanel(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close entries panel"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Results Count */}
            {searchTerm && (
              <div className="px-6 py-2 text-xs text-gray-400 border-b border-gray-800">
                {filteredEntries.length} result{filteredEntries.length === 1 ? '' : 's'} for &quot;{searchTerm}&quot;.
              </div>
            )}
            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse flex space-x-4 w-full">
                    <div className="rounded-lg bg-gray-800 h-24 w-full"></div>
                  </div>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm mb-2">
                    {searchTerm ? 'No entries match your search.' : 'No entries yet.'}
                  </p>
                  {!searchTerm && (
                    <p className="text-gray-500 text-xs">Start by adding your first entry on the left!</p>
                  )}
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}