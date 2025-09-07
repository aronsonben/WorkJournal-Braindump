'use client';

import { useEffect, useState } from 'react';

interface GraphProps {
  entries: Array<{ created_at: string; word_count: number }>;
}

interface TooltipState {
  day: string | null;
  x: number;
  y: number;
}

export function ContributionGraph({ entries }: GraphProps) {
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({ day: null, x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 bg-gray-800 rounded-lg w-64 animate-pulse" />
          <div className="h-6 bg-gray-800 rounded-full w-32 animate-pulse" />
        </div>
        <div className="h-32 bg-gray-800 animate-pulse rounded-lg" />
      </div>
    );
  }

  const days = Array.from({ length: 365 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (364 - i));
    return date.toISOString().split('T')[0];
  });

  const entryMap = entries.reduce((acc, entry) => {
    const date = entry.created_at.split('T')[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Generate month labels
  const monthLabels: { month: string; position: number }[] = [];
  weeks.forEach((week, weekIndex) => {
    if (week.length > 0) {
      const firstDayOfWeek = new Date(week[0]);
      const dayOfMonth = firstDayOfWeek.getDate();
      
      // Show month label if it's the first week of the month or close to it
      if (dayOfMonth <= 7) {
        monthLabels.push({
          month: firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' }),
          position: weekIndex
        });
      }
    }
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-white">Activity Overview</h2>
        <span className="text-gray-400 bg-gray-800 px-4 py-2 rounded-full text-sm font-medium">Last 365 days</span>
      </div>
      
      <div className="overflow-x-auto pb-4">
        {/* Month labels */}
        <div className="relative mb-4">
          <div className="flex gap-[3px] ml-10">
            {weeks.map((_, weekIndex) => (
              <div key={weekIndex} className="w-4 h-6 flex items-start justify-center">
                {monthLabels.find(label => label.position === weekIndex) && (
                  <span className="text-sm text-gray-300 font-medium">
                    {monthLabels.find(label => label.position === weekIndex)?.month}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex gap-[3px]">
          {/* Weekday labels */}
          <div className="flex flex-col gap-[3px] mr-2">
            <div className="w-8 h-4 flex items-center justify-end">
              <span className="text-sm text-gray-300">Sun</span>
            </div>
            <div className="w-8 h-4"></div>
            <div className="w-8 h-4 flex items-center justify-end">
              <span className="text-sm text-gray-300">Tue</span>
            </div>
            <div className="w-8 h-4"></div>
            <div className="w-8 h-4 flex items-center justify-end">
              <span className="text-sm text-gray-300">Thu</span>
            </div>
            <div className="w-8 h-4"></div>
            <div className="w-8 h-4 flex items-center justify-end">
              <span className="text-sm text-gray-300">Sat</span>
            </div>
          </div>
          
          {/* Contribution grid */}
          <div className="inline-flex gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const count = entryMap[day] || 0;
                  const intensity = 
                    count === 0 ? 'bg-gray-800' : 
                    count === 1 ? 'bg-[#15c460]/30' : 
                    count === 2 ? 'bg-[#15c460]/60' : 
                    count >= 3 ? 'bg-[#15c460]' : 'bg-gray-800';
                  
                  return (
                    <div
                      key={day}
                      className={`
                        w-4 h-4 rounded-sm ${intensity} 
                        hover:ring-2 hover:ring-[#15c460] hover:ring-offset-1 hover:ring-offset-black
                        cursor-pointer transition-all duration-200 relative
                        ${count > 0 ? 'shadow-lg shadow-[#15c460]/20' : ''}
                      `}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          day,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 10
                        });
                      }}
                      onMouseLeave={() => setTooltip({ day: null, x: 0, y: 0 })}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltip.day && (
        <div 
          className="fixed z-50 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg border border-gray-600 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px` 
          }}
        >
          <div className="text-center">
            <p className="font-medium">
              {new Date(tooltip.day).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </p>
            <p className="text-[#15c460] text-xs">
              {entryMap[tooltip.day] || 0} entries
            </p>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}

      <div className="flex items-center gap-8 mt-8">
        <span className="text-gray-400 text-sm font-medium">Less</span>
        <div className="flex gap-2">
          <div className="w-4 h-4 bg-gray-800 rounded-sm" />
          <div className="w-4 h-4 bg-[#15c460]/30 rounded-sm" />
          <div className="w-4 h-4 bg-[#15c460]/60 rounded-sm" />
          <div className="w-4 h-4 bg-[#15c460] rounded-sm shadow-lg shadow-[#15c460]/30" />
        </div>
        <span className="text-gray-400 text-sm font-medium">More</span>
      </div>
    </div>
  );
}