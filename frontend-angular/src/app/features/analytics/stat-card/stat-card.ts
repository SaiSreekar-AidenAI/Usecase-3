import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCard {
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
