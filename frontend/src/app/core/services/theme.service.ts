import { Injectable, signal } from '@angular/core';
import { ThemeName } from '../types';

const STORAGE_KEY = 'resolve.theme';
const THEME_TRANSITION_MS = 400;

/** Minimal shape of the View Transition API we rely on. */
type StartViewTransition = (cb: () => void) => { finished: Promise<void> };

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

  toggleTheme(origin?: { x: number; y: number }): void {
    const next: ThemeName = this._theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next, origin);
  }

  setTheme(theme: ThemeName, origin?: { x: number; y: number }): void {
    if (typeof document !== 'undefined') {
      this.setRevealOrigin(origin);
    }

    const startViewTransition =
      typeof document !== 'undefined'
        ? ((document as unknown as { startViewTransition?: StartViewTransition })
            .startViewTransition)
        : undefined;

    if (startViewTransition) {
      // The browser snapshots, runs our callback to flip the theme, then crossfades
      // via the ::view-transition-* pseudos in global.css. No legacy class needed.
      startViewTransition.call(document, () => {
        this.applyToDom(theme, false);
        this._theme.set(theme);
      });
    } else {
      // Fallback: blanket CSS crossfade via html.theme-transitioning.
      this.applyToDom(theme, true);
      this._theme.set(theme);
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  /**
   * Writes --theme-reveal-x/y/r CSS variables on <html> so the circular
   * clip-path animation in global.css originates from the click point and
   * expands far enough to cover the entire viewport.
   */
  private setRevealOrigin(origin?: { x: number; y: number }): void {
    const html = document.documentElement;
    if (!origin) {
      html.style.setProperty('--theme-reveal-x', '100%');
      html.style.setProperty('--theme-reveal-y', '0%');
      html.style.setProperty('--theme-reveal-r', '150vmax');
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dx = Math.max(origin.x, w - origin.x);
    const dy = Math.max(origin.y, h - origin.y);
    const radius = Math.hypot(dx, dy);
    html.style.setProperty('--theme-reveal-x', `${origin.x}px`);
    html.style.setProperty('--theme-reveal-y', `${origin.y}px`);
    html.style.setProperty('--theme-reveal-r', `${radius}px`);
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
