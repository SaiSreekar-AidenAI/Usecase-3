import { Injectable, signal } from '@angular/core';
import { ThemeName } from '../types';

const STORAGE_KEY = 'resolve.theme';
const THEME_TRANSITION_MS = 400;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<ThemeName>('obsidian');
  readonly theme = this._theme.asReadonly();

  constructor() {
    const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as
      | ThemeName
      | null;
    const initial: ThemeName = saved === 'paper' || saved === 'obsidian' ? saved : 'obsidian';
    this.applyToDom(initial, false);
    this._theme.set(initial);
  }

  toggleTheme(): void {
    const next: ThemeName = this._theme() === 'obsidian' ? 'paper' : 'obsidian';
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
