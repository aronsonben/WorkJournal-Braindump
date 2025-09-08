'use client';

import { Entry } from '../../lib/supabase';

export function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className="p-6 bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-700 hover:border-gray-600">
      <p className="text-gray-100 leading-relaxed mb-4 text-sm">{entry.content}</p>
      
      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {entry.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-[#15c460]/10 text-[#15c460] rounded-md text-xs font-medium border border-[#15c460]/20"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#15c460] rounded-full"></span>
            {new Date(entry.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
            {entry.word_count} words
          </span>
        </div>
      </div>
    </div>
  );
}