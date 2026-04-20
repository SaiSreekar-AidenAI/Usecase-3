import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet } from '@angular/router';

import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { IntroService } from '../../../core/services/intro.service';
import { OverviewStats } from '../../../core/types';
import { HistorySidebar } from '../../history-sidebar/history-sidebar';
import { ThemeSwitcher } from '../../theme-switcher/theme-switcher';

const SIDEBAR_COLLAPSED_KEY = 'layout.sidebarCollapsed';

@Component({
  selector: 'app-layout-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, HistorySidebar, ThemeSwitcher],
  templateUrl: './layout-shell.html',
  styleUrl: './layout-shell.css',
})
export class LayoutShell {
  protected auth = inject(AuthService);
  protected intro = inject(IntroService);
  private api = inject(ApiService);
  private router = inject(Router);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  protected sidebarOpen = signal(false);
  protected sidebarCollapsed = signal(this.readCollapsedPref());

  private stats = signal<OverviewStats | null>(null);

  protected tickerItems = computed<string[]>(() => {
    const s = this.stats();
    const items: string[] = ['Email Composer'];

    if (s) {
      items.push(
        `${this.formatCount(s.total_users)} Users`,
        `${this.formatCount(s.active_sessions)} Live Sessions`,
        `${this.formatCount(s.active_users_24h)} Active (24h)`,
        `${this.formatCount(s.queries_today)} Queries Today`,
        `${this.formatCount(s.total_queries)} Queries All-Time`,
        `${this.formatCount(s.tokens_today)} Tokens Today`,
        `${this.formatCount(s.total_tokens)} Tokens All-Time`,
      );
    }

    items.push('System Online', 'v0.1.0');
    return items;
  });

  constructor() {
    effect(() => {
      const collapsed = this.sidebarCollapsed();
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
    });

    if (this.auth.isAdmin()) {
      this.api
        .fetchOverviewStats()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (s) => this.stats.set(s),
          error: () => { /* fallback gracefully */ },
        });
    }
  }

  private formatCount(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  private readCollapsedPref(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
  toggleCollapse(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  goAnalytics(): void {
    this.router.navigate(['/analytics']);
    this.closeSidebar();
  }
  goUsers(): void {
    this.router.navigate(['/users']);
    this.closeSidebar();
  }

  async onLogout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const main = this.host.nativeElement.querySelector<HTMLElement>('.main');
    if (!main) return;
    const rect = main.getBoundingClientRect();
    main.style.setProperty('--cursor-x', `${event.clientX - rect.left}px`);
    main.style.setProperty('--cursor-y', `${event.clientY - rect.top}px`);
  }
}
