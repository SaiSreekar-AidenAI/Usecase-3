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

import { ApiService } from '../../core/services/api.service';
import { DailyActivityPoint, OverviewStats } from '../../core/types';
import { ChartThemeService } from './chart-theme';
import { StatCardComponent } from './stat-card/stat-card.component';

interface SeriesPoint {
  name: string;
  value: number;
}

interface Series {
  name: string;
  series: SeriesPoint[];
}

/**
 * Overview tab — top StatCards row, ngx-charts area chart for the
 * last-30-days activity, and a bottom totals row. The chart's color
 * scheme is derived from the live theme signal so it re-renders on
 * theme switch without any manual subscription bookkeeping.
 */
@Component({
  selector: 'app-overview-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgxChartsModule, StatCardComponent],
  styleUrl: './overview-tab.component.css',
  template: `
    <div class="overview-tab">
      <div class="overview-tab__cards">
        <app-stat-card label="Active Users (24h)" [value]="stats()?.active_users_24h ?? 0" />
        <app-stat-card label="Active Sessions" [value]="stats()?.active_sessions ?? 0" />
        <app-stat-card label="Queries Today" [value]="stats()?.queries_today ?? 0" />
        <app-stat-card label="Tokens Today" [value]="stats()?.tokens_today ?? 0" format="compact" />
      </div>

      <div class="overview-tab__chart-card">
        <h3 class="overview-tab__chart-title">Activity (Last 30 Days)</h3>
        <div class="overview-tab__chart">
          <ngx-charts-area-chart
            [results]="chartData()"
            [scheme]="colorScheme()"
            [gradient]="true"
            [xAxis]="true"
            [yAxis]="true"
            [showXAxisLabel]="false"
            [showYAxisLabel]="false"
            [autoScale]="true"
            [curve]="curve"
          ></ngx-charts-area-chart>
        </div>
      </div>

      <div class="overview-tab__stats-row">
        <app-stat-card label="Total Users" [value]="stats()?.total_users ?? 0" />
        <app-stat-card
          label="Total Queries"
          [value]="stats()?.total_queries ?? 0"
          format="compact"
        />
        <app-stat-card
          label="Total Tokens"
          [value]="stats()?.total_tokens ?? 0"
          format="compact"
        />
      </div>
    </div>
  `,
})
export class OverviewTabComponent {
  private api = inject(ApiService);
  private chartTheme = inject(ChartThemeService);
  private cdr = inject(ChangeDetectorRef);

  protected stats = signal<OverviewStats | null>(null);
  protected daily = signal<DailyActivityPoint[]>([]);

  // Recharts `type='monotone'` equivalent for ngx-charts.
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
