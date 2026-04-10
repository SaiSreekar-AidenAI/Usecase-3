import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonComponent } from '../../shared/ui/button.component';
import { ThemeSwitcherComponent } from '../../shared/theme-switcher/theme-switcher.component';
import { AuthService } from '../../core/services/auth.service';

type LoginStep = 'email' | 'password' | 'logging-in';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, ButtonComponent, ThemeSwitcherComponent],
  styleUrl: './login-page.component.css',
  template: `
    <div class="login-page">
      <!-- ═══ LEFT — Hero panel ═══ -->
      <div class="login-page__hero">
        <div class="login-page__hero-bg"></div>
        <div class="login-page__hero-orb login-page__hero-orb--1"></div>
        <div class="login-page__hero-orb login-page__hero-orb--2"></div>
        <div class="login-page__hero-orb login-page__hero-orb--3"></div>
        <div class="login-page__hero-grid"></div>
        <div class="login-page__hero-noise"></div>
        <div class="login-page__hero-edge"></div>

        <div class="login-page__hero-content">
          <div class="login-page__hero-brand">
            <div class="login-page__hero-logo">
              <svg
                class="login-page__hero-logo-mark"
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
              <div class="login-page__hero-logo-burst"></div>
            </div>
            <h1 class="login-page__hero-title">Email Composer</h1>
          </div>

          <p class="login-page__hero-tagline">Enterprise Support Intelligence</p>

          <div class="login-page__hero-divider"></div>

          <div class="login-page__hero-features">
            <div class="login-page__hero-feature" style="--feat-delay: 0.75s">
              <span class="login-page__hero-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  <path d="M20 3v4" />
                  <path d="M22 5h-4" />
                  <path d="M4 17v2" />
                  <path d="M5 18H3" />
                </svg>
              </span>
              <div>
                <span class="login-page__hero-feature-title">Knowledge-Grounded Responses</span>
                <span class="login-page__hero-feature-desc">Answers drawn from your verified internal knowledge base</span>
              </div>
            </div>

            <div class="login-page__hero-feature" style="--feat-delay: 0.87s">
              <span class="login-page__hero-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div>
                <span class="login-page__hero-feature-title">Role-Based Access & Audit</span>
                <span class="login-page__hero-feature-desc">Every session, query, and action tracked for compliance review</span>
              </div>
            </div>

            <div class="login-page__hero-feature" style="--feat-delay: 0.99s">
              <span class="login-page__hero-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </span>
              <div>
                <span class="login-page__hero-feature-title">Unified Operational Analytics</span>
                <span class="login-page__hero-feature-desc">Real-time usage, session, and performance insight in one view</span>
              </div>
            </div>
          </div>

          <div class="login-page__hero-footer">
            <div class="login-page__hero-status">
              <span class="login-page__hero-status-dot"></span>
              <span>System Online</span>
            </div>
            <span class="login-page__hero-version">v0.1.0</span>
          </div>
        </div>
      </div>

      <!-- ═══ RIGHT — Login panel ═══ -->
      <div class="login-page__right">
        <div class="login-page__right-glow"></div>
        <div class="login-page__right-glow login-page__right-glow--2"></div>
        <div class="login-page__right-noise"></div>

        <div class="login-page__card">
          <div class="login-page__card-brand-mobile">
            <div class="login-page__card-logo-sm">
              <svg
                class="login-page__card-logo-sm-mark"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="8" width="24" height="17" rx="2.5" />
                <path d="M4 11 L16 19 L28 11" />
              </svg>
            </div>
            <span class="login-page__card-brand-name">Email Composer</span>
          </div>

          <div class="login-page__card-header">
            <h2 class="login-page__card-title">Welcome back</h2>
            <p class="login-page__card-subtitle">Sign in to your console</p>
          </div>

          <div class="login-page__accent-bar"></div>

          @switch (step()) {
            @case ('email') {
              <form
                class="login-page__form login-page__form--enter"
                [attr.data-direction]="direction()"
                (ngSubmit)="onEmailSubmit()"
              >
                <div class="login-page__input-group">
                  <label class="login-page__label" for="login-email">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    class="login-page__input"
                    placeholder="you&#64;company.com"
                    autocomplete="email"
                    [(ngModel)]="email"
                    name="email"
                    autofocus
                  />
                </div>

                @if (error(); as e) {
                  <div class="login-page__error">{{ e }}</div>
                }

                <app-button type="submit" variant="primary">Continue</app-button>
              </form>
            }

            @case ('password') {
              <form
                class="login-page__form login-page__form--enter"
                [attr.data-direction]="direction()"
                (ngSubmit)="onPasswordSubmit()"
              >
                <p class="login-page__welcome">
                  Welcome back,
                  <span class="login-page__welcome-name">{{ userName() }}</span>
                </p>

                <div class="login-page__input-group">
                  <label class="login-page__label" for="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    class="login-page__input"
                    placeholder="Enter password"
                    autocomplete="current-password"
                    [(ngModel)]="password"
                    name="password"
                    autofocus
                  />
                </div>

                @if (error(); as e) {
                  <div class="login-page__error">{{ e }}</div>
                }

                <app-button type="submit" variant="primary">Sign In</app-button>

                <button type="button" class="login-page__back" (click)="goBack()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                  Back to email
                </button>
              </form>
            }

            @case ('logging-in') {
              <div class="login-page__loading-wrap">
                <p class="login-page__heading">Signing in...</p>
                <div class="login-page__loading">
                  <div class="login-page__loading-dot"></div>
                  <div class="login-page__loading-dot"></div>
                  <div class="login-page__loading-dot"></div>
                </div>
              </div>
            }
          }
        </div>

        <div class="login-page__footer">
          <app-theme-switcher />
        </div>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected step = signal<LoginStep>('email');
  protected email = '';
  protected password = '';
  protected userName = signal('');
  protected error = signal<string | null>(null);
  /** 1 = forward (toward password), -1 = backward (toward email). */
  protected direction = signal(1);

  constructor() {
    // If a session is already authenticated (e.g. user types /login while
    // signed in), bounce them straight to /generate.
    effect(() => {
      if (this.auth.status() === 'authenticated') {
        this.router.navigate(['/generate']);
      }
    });
  }

  async onEmailSubmit(): Promise<void> {
    this.error.set(null);
    const trimmed = this.email.trim();
    if (!trimmed) {
      this.error.set('Please enter your email address');
      return;
    }
    try {
      const result = await this.auth.checkEmail(trimmed);
      this.userName.set(result.user_name);
      if (result.requires_password) {
        this.direction.set(1);
        this.step.set('password');
      } else {
        this.step.set('logging-in');
        await this.auth.login(trimmed);
        this.router.navigate(['/generate']);
      }
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async onPasswordSubmit(): Promise<void> {
    this.error.set(null);
    if (!this.password) {
      this.error.set('Please enter your password');
      return;
    }
    try {
      this.step.set('logging-in');
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigate(['/generate']);
    } catch (err: unknown) {
      this.step.set('password');
      this.error.set(err instanceof Error ? err.message : 'Invalid credentials');
    }
  }

  goBack(): void {
    this.direction.set(-1);
    this.password = '';
    this.error.set(null);
    this.step.set('email');
  }
}
