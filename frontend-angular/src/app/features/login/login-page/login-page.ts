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

import { Button } from '../../../shared/ui/button/button';
import { ThemeSwitcher } from '../../../shared/theme-switcher/theme-switcher';
import { AuthService } from '../../../core/services/auth.service';

type LoginStep = 'email' | 'password' | 'logging-in';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, Button, ThemeSwitcher],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected step = signal<LoginStep>('email');
  protected email = '';
  protected password = '';
  protected userName = signal('');
  protected error = signal<string | null>(null);
  protected direction = signal(1);

  constructor() {
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
