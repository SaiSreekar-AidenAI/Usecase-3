import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type IntroPhase = 'waiting' | 'sidebar' | 'atmosphere' | 'topbar' | 'content' | 'done';

interface IntroContextType {
  phase: IntroPhase;
  sidebarReady: boolean;
  atmosphereReady: boolean;
  topbarReady: boolean;
  contentReady: boolean;
}

const IntroContext = createContext<IntroContextType>({
  phase: 'done',
  sidebarReady: true,
  atmosphereReady: true,
  topbarReady: true,
  contentReady: true,
});

export function IntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>(() => {
    // prefers-reduced-motion → skip entirely
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'done';
    }
    return 'waiting';
  });

  useEffect(() => {
    if (phase === 'done') return;

    // Reset to waiting on each mount (handles StrictMode remount)
    setPhase('waiting');

    const timers = [
      setTimeout(() => setPhase('sidebar'), 0),
      setTimeout(() => setPhase('atmosphere'), 500),
      setTimeout(() => setPhase('topbar'), 700),
      setTimeout(() => setPhase('content'), 1000),
      setTimeout(() => setPhase('done'), 2000),
    ];

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebarReady = phase !== 'waiting';
  const atmosphereReady = phase !== 'waiting' && phase !== 'sidebar';
  const topbarReady = phase !== 'waiting' && phase !== 'sidebar' && phase !== 'atmosphere';
  const contentReady = phase === 'content' || phase === 'done';

  return (
    <IntroContext.Provider value={{ phase, sidebarReady, atmosphereReady, topbarReady, contentReady }}>
      {children}
    </IntroContext.Provider>
  );
}

export function useIntro(): IntroContextType {
  return useContext(IntroContext);
}
