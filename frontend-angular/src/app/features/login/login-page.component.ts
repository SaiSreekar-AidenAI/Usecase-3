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

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  { icon: '⚡', title: 'AI-Powered Responses', desc: 'Instant, context-aware support answers' },
  { icon: '🔒', title: 'Secure & Audited', desc: 'Full session tracking and activity logs' },
  { icon: '📊', title: 'Real-Time Analytics', desc: 'Usage metrics and performance insights' },
];

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
              <span class="login-page__hero-logo-mark">//</span>
              <div class="login-page__hero-logo-burst"></div>
            </div>
            <h1 class="login-page__hero-title">Email Composer</h1>
          </div>

          <p class="login-page__hero-tagline">AI-Powered Support Console</p>

          <div class="login-page__hero-divider"></div>

          <div class="login-page__hero-features">
            @for (feat of features; track feat.title; let i = $index) {
              <div class="login-page__hero-feature" [style.--feat-delay]="0.75 + i * 0.12 + 's'">
                <span class="login-page__hero-feature-icon">{{ feat.icon }}</span>
                <div>
                  <span class="login-page__hero-feature-title">{{ feat.title }}</span>
                  <span class="login-page__hero-feature-desc">{{ feat.desc }}</span>
                </div>
              </div>
            }
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
        <div class="login-page__right-noise"></div>

        <div class="login-page__card">
          <div class="login-page__card-brand-mobile">
            <div class="login-page__card-logo-sm">
              <span class="login-page__card-logo-sm-mark">//</span>
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
                  ← Back to email
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

  protected readonly features = FEATURES;

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
