import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthStatus, User } from '../types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  private _user = signal<User | null>(null);
  private _status = signal<AuthStatus>('loading');

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  /** Called from APP_INITIALIZER to restore the session via /api/auth/me. */
  async restoreSession(): Promise<void> {
    try {
      const user = await firstValueFrom(this.api.fetchCurrentUser());
      this._user.set(user);
      this._status.set('authenticated');
    } catch {
      this._user.set(null);
      this._status.set('unauthenticated');
    }
  }

  async checkEmail(email: string) {
    return firstValueFrom(this.api.checkEmail(email));
  }

  async login(email: string, password?: string): Promise<User> {
    const result = await firstValueFrom(this.api.loginUser(email, password));
    this._user.set(result.user);
    this._status.set('authenticated');
    return result.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logoutUser());
    } catch {
      /* swallow — server may already be unreachable */
    }
    this._user.set(null);
    this._status.set('unauthenticated');
  }
}
