'use client';

import { useState, useEffect } from 'react';

interface SmartTipProps {
  suggested_tip: string | null;
  show: boolean;
  onDismiss: () => void;
}

export function SmartTip({ suggested_tip, show, onDismiss }: SmartTipProps) {
  const [visible, setVisible] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    if (show && suggested_tip) {
      setVisible(true);
      
      // Start progress animation after a brief delay to ensure proper rendering
      const animationTimer = setTimeout(() => {
        setAnimateProgress(true);
      }, 50);
      
      // Auto-dismiss after 5 seconds
      const dismissTimer = setTimeout(() => {
        setVisible(false);
        setAnimateProgress(false);
        setTimeout(onDismiss, 300);
      }, 5000);

      return () => {
        clearTimeout(animationTimer);
        clearTimeout(dismissTimer);
      };
    } else {
      setVisible(false);
      setAnimateProgress(false);
    }
  }, [show, suggested_tip, onDismiss]);

  if (!suggested_tip || !show) {
    return null;
  }

  return (
    <div className={`
      transform transition-all duration-300 ease-out
      ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'}
    `}>
      <div className="bg-gradient-to-r from-[#15c460]/10 to-green-400/10 border border-[#15c460]/20 rounded-lg p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-gray-300 leading-relaxed">
              {suggested_tip}
            </p>
          </div>
          
          <button
            onClick={() => {
              setVisible(false);
              setAnimateProgress(false);
              setTimeout(onDismiss, 300);
            }}
            className="text-gray-400 hover:text-gray-300 transition-colors p-1 -m-1"
            aria-label="Dismiss tip"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar showing auto-dismiss countdown - starts empty, fills over 5s */}
        <div className="mt-3 h-1 bg-gray-700/50 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-[#15c460]/60 rounded-full transition-all ease-linear ${
              animateProgress 
                ? 'duration-[5000ms] w-full' 
                : 'duration-0 w-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
}