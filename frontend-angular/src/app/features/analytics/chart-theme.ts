import { Injectable, computed, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

export interface ChartColors {
  primary: string;
  secondary: string;
  tertiary: string;
  danger: string;
  grid: string;
  text: string;
  textLight: string;
  bg: string;
  tooltip: string;
  tooltipBorder: string;
}

/**
 * Signal-based chart theme service. Mirrors React's `useChartTheme` hook
 * 1:1 — colors are recomputed whenever the global theme signal flips so
 * any chart that consumes `colors()` re-renders automatically.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private theme = inject(ThemeService);

  readonly isDark = computed(() => this.theme.theme() === 'obsidian');

  readonly colors = computed<ChartColors>(() => {
    const isDark = this.isDark();
    return {
      primary: isDark ? '#c99a2e' : '#b8602c',
      secondary: isDark ? '#4d9960' : '#3d7f4d',
      tertiary: isDark ? '#c46b5a' : '#5a7a8a',
      danger: isDark ? '#c45454' : '#a84040',
      grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
      text: isDark ? '#8a8478' : '#6b655a',
      textLight: isDark ? '#5e584e' : '#948d82',
      bg: 'transparent',
      tooltip: isDark ? '#16161a' : '#eae5dc',
      tooltipBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    };
  });

  /** Convenience: ngx-charts colorScheme for a series of colors. */
  schemeFor(colors: string[]): { name: string; selectable: boolean; group: 'Ordinal'; domain: string[] } {
    return {
      name: 'resolve',
      selectable: true,
      group: 'Ordinal',
      domain: colors,
    };
  }
}
