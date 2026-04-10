import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';

/**
 * Compact metric card used across analytics tabs. Mirrors the React
 * StatCard: a label above a large accent-colored value, with the value
 * formatted either as a localized integer or compact (1.2K / 3.4M).
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './stat-card.component.css',
  template: `
    <div class="stat-card">
      <span class="stat-card__label">{{ label() }}</span>
      <span class="stat-card__value">{{ formatted() }}</span>
    </div>
  `,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<number>();
  format = input<'number' | 'compact'>('number');

  protected formatted = computed(() => {
    const v = this.value();
    if (this.format() === 'compact') {
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    }
    return v.toLocaleString();
  });
}
