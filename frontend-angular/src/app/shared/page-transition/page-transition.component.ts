import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Event as RouterEvent,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

type WipeState = 'idle' | 'covering' | 'revealing';

/**
 * Full-screen wipe transition played between top-level route changes.
 *
 * Mirrors the React reference (Framer Motion PageTransition + AnimatePresence
 * mode="wait"): an accent-coloured panel scales in from the left to cover the
 * outgoing page, then scales out to the right to reveal the incoming page.
 *
 * Driven by Router.events + a three-state signal rather than @angular/animations
 * because (a) we want a single overlay above router-outlet, not per-component
 * enter/leave transitions, and (b) the panel must stay fully covered until
 * NavigationEnd fires, so lazy-loaded chunks don't flash through.
 *
 * Only plays on login/logout transitions (either /login -> app or app -> /login).
 * In-app navigation between top-level pages is silent.
 *
 * Suppressed when:
 *  - It's the initial bootstrap navigation (avoids a flash on first paint).
 *  - Neither the from- nor to-URL is /login (i.e. in-app navigation).
 *  - The user has prefers-reduced-motion: reduce.
 */
@Component({
  selector: 'app-page-transition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './page-transition.component.css',
  template: `
    <div
      class="wipe"
      [class.wipe--covering]="state() === 'covering'"
      [class.wipe--revealing]="state() === 'revealing'"
      aria-hidden="true"
    ></div>
  `,
})
export class PageTransitionComponent {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  protected state = signal<WipeState>('idle');

  private readonly COVER_MS = 260;
  private readonly REVEAL_MS = 260;

  private firstNavDone = false;
  private coverStartedAt = 0;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => this.handle(ev));

    this.destroyRef.onDestroy(() => {
      this.clearTimers();
    });
  }

  private handle(ev: RouterEvent): void {
    if (ev instanceof NavigationStart) {
      // Skip the very first navigation after bootstrap so the app doesn't
      // flash a wipe on initial paint. The flag flips on the first NavigationEnd.
      if (!this.firstNavDone) return;
      if (!this.shouldAnimate(this.router.url, ev.url)) return;
      this.startCover();
      return;
    }

    if (ev instanceof NavigationEnd) {
      this.firstNavDone = true;
      if (this.state() === 'covering') {
        this.scheduleReveal();
      }
      return;
    }

    if (ev instanceof NavigationCancel || ev instanceof NavigationError) {
      // Don't strand the user behind a panel if a guard rejects or an error fires.
      if (this.state() === 'covering') {
        this.scheduleReveal();
      }
    }
  }

  private shouldAnimate(fromUrl: string, toUrl: string): boolean {
    if (this.prefersReducedMotion()) return false;

    // Only wipe on login/logout — i.e. when exactly one side is /login.
    // In-app navigation between top-level pages should stay silent.
    const fromIsLogin = this.isLoginPath(fromUrl);
    const toIsLogin = this.isLoginPath(toUrl);
    return fromIsLogin !== toIsLogin;
  }

  private isLoginPath(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '/login' || path.startsWith('/login/');
  }

  private prefersReducedMotion(): boolean {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private startCover(): void {
    this.clearTimers();
    this.coverStartedAt = performance.now();
    this.state.set('covering');
  }

  private scheduleReveal(): void {
    if (this.revealTimer !== null) return; // already scheduled
    const elapsed = performance.now() - this.coverStartedAt;
    const remaining = Math.max(0, this.COVER_MS - elapsed);

    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      this.state.set('revealing');

      this.idleTimer = setTimeout(() => {
        this.idleTimer = null;
        this.state.set('idle');
      }, this.REVEAL_MS);
    }, remaining);
  }

  private clearTimers(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
