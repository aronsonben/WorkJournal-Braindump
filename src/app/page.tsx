'use client';

import { useState, useEffect } from 'react';
import { supabase, Entry } from '../lib/supabase';
import { EntryInput } from './components/entry-input';
import { ContributionGraph } from './components/contribution-graph';
import { EntryCard } from './components/entry-card';

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#15c460] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <span className="text-xl font-semibold text-white">WorkJournal</span>
            </div>
            <button className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-gray-700">
              Export
            </button>
          </div>
        </div>
      </nav>

      {/* Full-width Activity Overview */}
      <section className="w-full bg-black py-8">
        <div className="max-w-7xl mx-auto px-8">
          <ContributionGraph entries={entries} />
        </div>
      </section>

      {/* Main Content - Bento Grid Layout */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-fit">
          {/* Left Column - Input Section */}
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-gray-900 p-8 rounded-2xl shadow-lg border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-gray-100">What happened today?</h2>
              <EntryInput onSave={handleSave} />
            </div>
          </div>

          {/* Right Column - Entries List */}
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-800">
              <input
                type="text"
                placeholder="🔍 Search entries and tags..."
                className="w-full p-4 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#15c460] focus:border-transparent text-gray-100 placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Entries List */}
            <div className="bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-800 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-100">
                  Your Entries
                </h3>
                {searchTerm && (
                  <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                    {filteredEntries.length} results
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-pulse flex space-x-4 w-full">
                      <div className="rounded-lg bg-gray-800 h-24 w-full"></div>
                    </div>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg mb-2">
                      {searchTerm ? 'No entries match your search.' : 'No entries yet.'}
                    </p>
                    {!searchTerm && (
                      <p className="text-gray-500 text-sm">
                        Start by adding your first entry in the left panel!
                      </p>
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
        </div>
      </div>
    </main>
  );
}