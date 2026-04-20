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
import { TokenByUser, TokenUsagePoint } from '../../../core/types';
import { ChartThemeService } from '../chart-theme';
import { StatCard } from '../stat-card/stat-card';

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

@Component({
  selector: 'app-token-usage-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgxChartsModule, StatCard],
  templateUrl: './token-usage-tab.html',
  styleUrl: './token-usage-tab.css',
})
export class TokenUsageTab {
  private api = inject(ApiService);
  private chartTheme = inject(ChartThemeService);
  private cdr = inject(ChangeDetectorRef);

  protected usage = signal<TokenUsagePoint[]>([]);
  protected byUser = signal<TokenByUser[]>([]);

  protected readonly curve = curveMonotoneX;

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

  protected topUsers = computed<TopUserRow[]>(() => {
    const users = this.byUser();
    if (users.length === 0) return [];
    const max = users[0]?.total_tokens || 1;
    return users.map((u) => ({
      user: u,
      pct: Math.round((u.total_tokens / max) * 100),
    }));
  });

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

  protected sliceColor(index: number): string {
    const domain = this.pieScheme().domain;
    return domain[index % domain.length];
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
