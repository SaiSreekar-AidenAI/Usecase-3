import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { curveMonotoneX } from 'd3-shape';

import { ApiService } from '../../../core/services/api.service';
import { DailyActivityPoint, OverviewStats } from '../../../core/types';
import { ChartThemeService } from '../chart-theme';
import { StatCard } from '../stat-card/stat-card';

interface SeriesPoint {
  name: string;
  value: number;
}

interface Series {
  name: string;
  series: SeriesPoint[];
}

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgxChartsModule, StatCard],
  templateUrl: './overview-tab.html',
  styleUrl: './overview-tab.css',
})
export class OverviewTab {
  private api = inject(ApiService);
  private chartTheme = inject(ChartThemeService);
  private cdr = inject(ChangeDetectorRef);

  protected stats = signal<OverviewStats | null>(null);
  protected daily = signal<DailyActivityPoint[]>([]);

  protected readonly curve = curveMonotoneX;

  protected chartData = computed<Series[]>(() => {
    const points = this.daily();
    return [
      {
        name: 'Logins',
        series: points.map((p) => ({ name: p.date.slice(5), value: p.logins })),
      },
      {
        name: 'Queries',
        series: points.map((p) => ({ name: p.date.slice(5), value: p.queries })),
      },
    ];
  });

  protected colorScheme = computed(() => {
    const c = this.chartTheme.colors();
    return this.chartTheme.schemeFor([c.secondary, c.primary]);
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [stats, daily] = await Promise.all([
        firstValueFrom(this.api.fetchOverviewStats()),
        firstValueFrom(this.api.fetchDailyActivity(30)),
      ]);
      this.stats.set(stats);
      this.daily.set(daily);
    } catch {
      /* ignore — leave defaults */
    } finally {
      this.cdr.markForCheck();
    }
  }
}
