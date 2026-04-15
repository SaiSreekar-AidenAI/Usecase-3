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

import { AnalyticsApiService } from '../../core/services/analytics-api.service';
import { AuthService } from '../../core/services/auth.service';
import { IntroService } from '../../core/services/intro.service';
import { OverviewStats } from '../../core/types';
import { HistorySidebarComponent } from '../history-sidebar/history-sidebar.component';
import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher.component';

const SIDEBAR_COLLAPSED_KEY = 'layout.sidebarCollapsed';

/**
 * The authenticated app shell — sidebar (with HistorySidebar projected),
 * topbar with theme switcher, and a main <router-outlet> for content.
 *
 * Intro animations are gated by classes derived from IntroService signals,
 * so the entire timeline is CSS — no Angular animation engine churn.
 *
 * The cursor-reactive glow updates --cursor-x / --cursor-y CSS variables
 * on the .main element via @HostListener, mirroring React's spring-smoothed
 * motion values.
 */
@Component({
  selector: 'app-layout-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, HistorySidebarComponent, ThemeSwitcherComponent],
  styleUrl: './layout-shell.component.css',
  template: `
    <div
      class="app-shell"
      [class.intro-sidebar]="intro.sidebarReady()"
      [class.intro-atmosphere]="intro.atmosphereReady()"
      [class.intro-topbar]="intro.topbarReady()"
      [class.intro-content]="intro.contentReady()"
    >
      <aside
        class="sidebar"
        [class.sidebar--open]="sidebarOpen()"
        [class.sidebar--collapsed]="sidebarCollapsed()"
      >
        <div class="sidebar__header">
          <div class="sidebar__brand">
            <div class="sidebar__logo">
              <svg
                class="sidebar__logo-mark"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="8" width="24" height="17" rx="2.5" />
                <path d="M4 11 L16 19 L28 11" />
                <path d="M22 5 L23.2 7.3 L25.5 8.5 L23.2 9.7 L22 12 L20.8 9.7 L18.5 8.5 L20.8 7.3 Z" fill="currentColor" stroke="none" />
              </svg>
              <div class="sidebar__logo-burst"></div>
            </div>
            <div class="sidebar__brand-text">
              <h1 class="sidebar__title">Email Composer</h1>
              <p class="sidebar__subtitle">AI Support Console</p>
            </div>
          </div>
          <div class="sidebar__accent-bar"></div>
        </div>

        <div class="sidebar__content">
          <app-history-sidebar />
        </div>

        <div class="sidebar__user-section">
          @if (auth.user(); as u) {
            <div class="sidebar__user-info">
              <span class="sidebar__user-name">{{ u.name }}</span>
              <span
                class="sidebar__user-role"
                [class.sidebar__user-role--admin]="u.role === 'admin'"
                [class.sidebar__user-role--associate]="u.role === 'associate'"
              >
                {{ u.role }}
              </span>
            </div>
          }
          <div class="sidebar__user-actions">
            @if (auth.isAdmin()) {
              <button type="button" class="sidebar__nav-btn" (click)="goAnalytics()">
                Analytics
              </button>
              <button type="button" class="sidebar__nav-btn" (click)="goUsers()">
                Users
              </button>
            }
            <button
              type="button"
              class="sidebar__nav-btn sidebar__nav-btn--logout"
              (click)="onLogout()"
            >
              Logout
            </button>
          </div>
        </div>

        <button
          type="button"
          class="sidebar__collapse-toggle"
          [attr.aria-label]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          [attr.aria-expanded]="!sidebarCollapsed()"
          [attr.title]="sidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          (click)="toggleCollapse()"
        >
          <svg
            class="sidebar__collapse-toggle-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d="m15 10-2 2 2 2" />
          </svg>
          <span class="sidebar__collapse-toggle-label">Collapse</span>
        </button>

        <div class="sidebar__footer">
          <div class="sidebar__status">
            <span class="sidebar__status-dot"></span>
            <span class="sidebar__status-label">Online</span>
          </div>
          <span class="sidebar__version">v0.1.0</span>
        </div>
      </aside>

      @if (sidebarOpen()) {
        <div class="app-shell__overlay" (click)="closeSidebar()"></div>
      }

      <main class="main">
        <div class="main__cursor-glow"></div>
        <div class="main__orb main__orb--1"></div>
        <div class="main__orb main__orb--2"></div>
        <div class="main__orb main__orb--3"></div>
        <div class="main__glow"></div>
        <div class="main__mesh"></div>
        <div class="main__noise"></div>
        <div class="main__grid"></div>

        <div class="main__topbar">
          <button
            type="button"
            class="main__menu-btn"
            aria-label="Toggle sidebar"
            (click)="toggleSidebar()"
          >
            {{ sidebarOpen() ? '✕' : '☰' }}
          </button>
          <span class="main__mobile-title">Email Composer</span>

          <div class="main__ticker" aria-hidden="true">
            <div class="main__ticker-track">
              @for (item of tickerItems(); track $index) {
                <span class="main__ticker-item">
                  <span class="main__ticker-dot"></span>
                  {{ item }}
                </span>
              }
              @for (item of tickerItems(); track $index) {
                <span class="main__ticker-item">
                  <span class="main__ticker-dot"></span>
                  {{ item }}
                </span>
              }
            </div>
          </div>

          <div class="main__topbar-right">
            <app-theme-switcher />
          </div>
        </div>

        <div class="main__scroll">
          <div class="main__content">
            <router-outlet />
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LayoutShellComponent {
  protected auth = inject(AuthService);
  protected intro = inject(IntroService);
  private analyticsApi = inject(AnalyticsApiService);
  private router = inject(Router);
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  protected sidebarOpen = signal(false);
  protected sidebarCollapsed = signal(this.readCollapsedPref());

  /** Live overview counts, fetched for admins only. Null until loaded. */
  private stats = signal<OverviewStats | null>(null);

  /**
   * Rotating strip content shown in the topbar marquee.
   * Admins see real counts (users, sessions, queries, tokens).
   * Associates see a minimal operational strip — no marketing copy.
   */
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
    // Persist desktop collapse preference across reloads.
    effect(() => {
      const collapsed = this.sidebarCollapsed();
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        /* storage unavailable (private mode, etc.) — ignore */
      }
    });

    // Admins get a live stats ticker. The overview endpoint is admin-gated
    // by casbin, so we silently skip the fetch for associates and fall back
    // to the minimal brand+status strip.
    if (this.auth.isAdmin()) {
      this.analyticsApi
        .fetchOverviewStats()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (s) => this.stats.set(s),
          error: () => {
            /* network or permission error — ticker falls back gracefully */
          },
        });
    }
  }

  /** Compact human count: 1.2K, 3.4M, 5.6B. */
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

  /**
   * Update CSS vars on the .main element so the cursor glow follows the
   * pointer. Uses requestAnimationFrame implicitly via CSS transitions —
   * no JS animation loop needed.
   */
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const main = this.host.nativeElement.querySelector<HTMLElement>('.main');
    if (!main) return;
    const rect = main.getBoundingClientRect();
    main.style.setProperty('--cursor-x', `${event.clientX - rect.left}px`);
    main.style.setProperty('--cursor-y', `${event.clientY - rect.top}px`);
  }
}
