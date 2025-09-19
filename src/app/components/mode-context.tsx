"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AppMode = 'journal' | 'braindump';

interface ModeContextValue {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  toggle: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const STORAGE_KEY = 'workjournal:mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('journal');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as AppMode | null;
      if (saved === 'journal' || saved === 'braindump') {
        setModeState(saved);
      }
    } catch {/* ignore */}
  }, []);

  function setMode(m: AppMode) {
    setModeState(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch {/* ignore */}
  }

  function toggle() { setMode(mode === 'journal' ? 'braindump' : 'journal'); }

  return (
    <ModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useAppMode must be used within ModeProvider');
  return ctx;
}
