import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Theme = 'obsidian' | 'paper';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'obsidian',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'resolve-theme';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'obsidian' || saved === 'paper') return saved;
  } catch {}
  return 'obsidian';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((newTheme: Theme) => {
    document.documentElement.classList.add('theme-transitioning');
    setThemeState(newTheme);
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 400);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'obsidian' ? 'paper' : 'obsidian');
  }, [theme, setTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
