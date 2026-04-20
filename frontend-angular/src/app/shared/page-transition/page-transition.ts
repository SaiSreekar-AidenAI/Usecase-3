import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
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

@Component({
  selector: 'app-page-transition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './page-transition.html',
  styleUrl: './page-transition.css',
})
export class PageTransition {
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
      if (this.state() === 'covering') {
        this.scheduleReveal();
      }
    }
  }

  private shouldAnimate(fromUrl: string, toUrl: string): boolean {
    if (this.prefersReducedMotion()) return false;
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
    if (this.revealTimer !== null) return;
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
