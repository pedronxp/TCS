import React, { createContext, useContext, useState } from 'react';

export type ViewportMode = 'desktop' | 'mobile';

interface ViewportContextType {
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  toggleViewportMode: () => void;
}

const STORAGE_KEY = 'tcs.viewport.mode';

const ViewportContext = createContext<ViewportContextType | undefined>(undefined);

export function ViewportProvider({ children }: { children: React.ReactNode }) {
  const [viewportMode, setViewportModeState] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'mobile' ? 'mobile' : 'desktop';
  });

  const setViewportMode = (mode: ViewportMode) => {
    setViewportModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const toggleViewportMode = () => {
    setViewportMode(viewportMode === 'desktop' ? 'mobile' : 'desktop');
  };

  return (
    <ViewportContext.Provider value={{ viewportMode, setViewportMode, toggleViewportMode }}>
      {children}
    </ViewportContext.Provider>
  );
}

export function useViewport() {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error('useViewport deve ser usado dentro de um ViewportProvider');
  }
  return context;
}
