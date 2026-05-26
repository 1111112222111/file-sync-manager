/**
 * src/renderer/hooks/useTheme.ts — 主题切换 hook
 */
import { useState, useCallback, useEffect } from 'react';
import type { ThemeMode } from '../../shared/types';

const THEME_STORAGE_KEY = 'app-theme';

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'dark';
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolveTheme(theme));
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  return { theme, setTheme };
}
