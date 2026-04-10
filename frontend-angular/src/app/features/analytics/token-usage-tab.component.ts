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
import { TokenByUser, TokenUsagePoint } from '../../core/types';
import { ChartThemeService } from './chart-theme';
import { StatCardComponent } from './stat-card/stat-card.component';

interface BarPoint {
  name: string;
  value: number;
}

interface LineSeries {
  name: string;
  series: BarPoint[];
}

interface TopUserRow {
  user: TokenByUser;
  pct: number;
}

/**
 * Token Usage tab — three StatCards, a combo chart (bar = requests,
 * line = total tokens), a pie chart for prompt vs completion split,
 * and a top-users table with a gradient bar indicator. ngx-charts
 * doesn't have a true ComposedChart, so we render the bar chart and
 * line chart in the same wrapper with absolute positioning so they
 * share the same x-axis space — close enough to the Recharts version.
 */
@Component({
  selector: 'app-token-usage-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgxChartsModule, StatCardComponent],
  styleUrl: './token-usage-tab.component.css',
  template: `
    <div class="token-tab">
      <div class="token-tab__cards">
        <app-stat-card
          label="Total Tokens"
          [value]="totalTokens()"
          format="compact"
        />
        <app-stat-card label="Total Requests" [value]="totalRequests()" />
        <app-stat-card label="Avg Tokens / Request" [value]="avgTokensPerRequest()" />
      </div>

      <div class="token-tab__charts-row">
        <!-- Token usage trend (bar+line combo) -->
        <div class="token-tab__chart-card token-tab__chart-card--wide">
          <h3 class="token-tab__chart-title">Token Usage Over Time</h3>
          @if (usage().length > 0) {
            <div class="token-tab__chart-stack">
              <ngx-charts-bar-vertical
                class="token-tab__chart-layer"
                [results]="barData()"
                [scheme]="barScheme()"
                [xAxis]="true"
                [yAxis]="true"
                [showXAxisLabel]="false"
                [showYAxisLabel]="false"
                [barPadding]="6"
                [roundEdges]="true"
              ></ngx-charts-bar-vertical>
              <ngx-charts-line-chart
                class="token-tab__chart-layer token-tab__chart-layer--overlay"
                [results]="lineData()"
                [scheme]="lineScheme()"
                [xAxis]="false"
                [yAxis]="false"
                [autoScale]="true"
                [curve]="curve"
              ></ngx-charts-line-chart>
            </div>
          } @else {
            <div class="token-tab__empty">No data yet</div>
          }
        </div>

        <!-- Prompt vs completion split -->
        <div class="token-tab__chart-card token-tab__chart-card--narrow">
          <h3 class="token-tab__chart-title">Token Breakdown</h3>
          @if (pieData().length > 0) {
            <div class="token-tab__pie">
              <ngx-charts-advanced-pie-chart
                [results]="pieData()"
                [scheme]="pieScheme()"
              ></ngx-charts-advanced-pie-chart>
            </div>
          } @else {
            <div class="token-tab__empty">No data yet</div>
          }
        </div>
      </div>

      <!-- Top users by token usage -->
      <div class="token-tab__section">
        <h3 class="token-tab__chart-title">Top Users by Token Usage</h3>
        <div class="token-tab__table">
          <div class="token-tab__header-row">
            <span>User</span>
            <span>Total Tokens</span>
            <span>Requests</span>
            <span>Avg / Request</span>
          </div>
          @for (row of topUsers(); track row.user.user_id) {
            <div class="token-tab__row">
              <span class="token-tab__cell">
                {{ row.user.user_email || row.user.user_id }}
              </span>
              <span class="token-tab__cell">
                <span class="token-tab__bar-wrapper">
                  <span
                    class="token-tab__bar"
                    [style.width.%]="row.pct"
                  ></span>
                  <span class="token-tab__bar-label">
                    {{ row.user.total_tokens.toLocaleString() }}
                  </span>
                </span>
              </span>
              <span class="token-tab__cell">{{ row.user.request_count }}</span>
              <span class="token-tab__cell">
                {{ formatAvg(row.user.avg_tokens_per_request) }}
              </span>
            </div>
          }
          @if (topUsers().length === 0) {
            <div class="token-tab__empty">No usage data</div>
          }
        </div>
      </div>
    </div>
  `,
})
export class TokenUsageTabComponent {
  private api = inject(ApiService);
  private chartTheme = inject(ChartThemeService);
  private cdr = inject(ChangeDetectorRef);

  protected usage = signal<TokenUsagePoint[]>([]);
  protected byUser = signal<TokenByUser[]>([]);

  protected readonly curve = curveMonotoneX;

  // ── Aggregated stats ──
  protected totalPrompt = computed(() =>
    this.usage().reduce((s, u) => s + u.prompt_tokens, 0),
  );

  protected totalCompletion = computed(() =>
    this.usage().reduce((s, u) => s + u.completion_tokens, 0),
  );

  protected totalRequests = computed(() =>
    this.usage().reduce((s, u) => s + u.request_count, 0),
  );

  protected totalTokens = computed(() =>
    this.usage().reduce((s, u) => s + u.total_tokens, 0),
  );

  protected avgTokensPerRequest = computed(() => {
    const reqs = this.totalRequests();
    return reqs > 0 ? Math.round(this.totalTokens() / reqs) : 0;
  });

  // ── Chart data ──
  protected barData = computed<BarPoint[]>(() =>
    this.usage().map((u) => ({
      name: u.date.slice(5),
      value: u.request_count,
    })),
  );

  protected lineData = computed<LineSeries[]>(() => [
    {
      name: 'Tokens',
      series: this.usage().map((u) => ({
        name: u.date.slice(5),
        value: u.total_tokens,
      })),
    },
  ]);

  protected pieData = computed(() =>
    [
      { name: 'Prompt', value: this.totalPrompt() },
      { name: 'Completion', value: this.totalCompletion() },
    ].filter((d) => d.value > 0),
  );

  // ── Top users with bar percentages ──
  protected topUsers = computed<TopUserRow[]>(() => {
    const users = this.byUser();
    if (users.length === 0) return [];
    const max = users[0]?.total_tokens || 1;
    return users.map((u) => ({
      user: u,
      pct: Math.round((u.total_tokens / max) * 100),
    }));
  });

  // ── Color schemes (recompute on theme change) ──
  protected barScheme = computed(() => {
    const c = this.chartTheme.colors();
    return this.chartTheme.schemeFor([c.secondary]);
  });

  protected lineScheme = computed(() => {
    const c = this.chartTheme.colors();
    return this.chartTheme.schemeFor([c.primary]);
  });

  protected pieScheme = computed(() => {
    const c = this.chartTheme.colors();
    return this.chartTheme.schemeFor([c.primary, c.secondary]);
  });

  protected formatAvg(n: number): string {
    return Math.round(n).toLocaleString();
  }

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [usage, byUser] = await Promise.all([
        firstValueFrom(this.api.fetchTokenUsage({})),
        firstValueFrom(this.api.fetchTokenByUser()),
      ]);
      this.usage.set(usage);
      this.byUser.set(byUser);
    } catch {
      /* ignore */
    } finally {
      this.cdr.markForCheck();
    }
  }
}
