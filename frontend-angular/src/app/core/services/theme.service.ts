import { Injectable, signal } from '@angular/core';
import { ThemeName } from '../types';

const STORAGE_KEY = 'resolve.theme';
const THEME_TRANSITION_MS = 400;

/** Migrate legacy persisted theme values to the new dark/light names. */
function normalizeStoredTheme(raw: string | null): ThemeName | null {
  if (raw === 'dark' || raw === 'light') return raw;
  if (raw === 'obsidian') return 'dark';
  if (raw === 'paper') return 'light';
  return null;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<ThemeName>('dark');
  readonly theme = this._theme.asReadonly();

  constructor() {
    const rawSaved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const migrated = normalizeStoredTheme(rawSaved);
    const initial: ThemeName = migrated ?? 'dark';

    this.applyToDom(initial, false);
    this._theme.set(initial);

    // If we migrated from a legacy value, persist the new one so next reload is clean.
    if (migrated && rawSaved !== migrated) {
      try {
        localStorage.setItem(STORAGE_KEY, migrated);
      } catch {
        /* ignore */
      }
    }
  }

  toggleTheme(): void {
    const next: ThemeName = this._theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(theme: ThemeName): void {
    this.applyToDom(theme, true);
    this._theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  private applyToDom(theme: ThemeName, withTransition: boolean): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (withTransition) {
      html.classList.add('theme-transitioning');
      window.setTimeout(() => html.classList.remove('theme-transitioning'), THEME_TRANSITION_MS);
    }
    html.setAttribute('data-theme', theme);
  }
}
