import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { IntroService } from '../../core/services/intro.service';
import { HistorySidebarComponent } from '../history-sidebar/history-sidebar.component';
import { ThemeSwitcherComponent } from '../theme-switcher/theme-switcher.component';

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
      <aside class="sidebar" [class.sidebar--open]="sidebarOpen()">
        <div class="sidebar__header">
          <div class="sidebar__brand">
            <div class="sidebar__logo">
              <span class="sidebar__logo-mark">//</span>
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
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  protected sidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar(): void {
    this.sidebarOpen.set(false);
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
