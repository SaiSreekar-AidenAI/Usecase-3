import { Injectable, computed, inject } from '@angular/core';
import { Color, ScaleType } from '@swimlane/ngx-charts';
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

  readonly isDark = computed(() => this.theme.theme() === 'dark');

  readonly colors = computed<ChartColors>(() => {
    const isDark = this.isDark();
    return {
      primary:       isDark ? '#60a5fa' : '#3b82f6',
      secondary:     isDark ? '#22d3ee' : '#0891b2',
      tertiary:      isDark ? '#a78bfa' : '#8b5cf6',
      danger:        isDark ? '#f43f5e' : '#e11d48',
      grid:          isDark ? 'rgba(148,180,236,0.08)' : 'rgba(30,64,175,0.08)',
      text:          isDark ? '#a8b8d6' : '#4b6485',
      textLight:     isDark ? '#6b7ea0' : '#8497b6',
      bg:            'transparent',
      tooltip:       isDark ? 'rgba(18,28,54,0.92)' : 'rgba(255,255,255,0.92)',
      tooltipBorder: isDark ? 'rgba(148,180,236,0.18)' : 'rgba(59,130,246,0.25)',
    };
  });

  /** Convenience: ngx-charts colorScheme for a series of colors. */
  schemeFor(colors: string[]): Color {
    return {
      name: 'resolve',
      selectable: true,
      group: ScaleType.Ordinal,
      domain: colors,
    };
  }
}
