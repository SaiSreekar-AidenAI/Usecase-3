import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User } from '../types';

export interface CheckEmailResult {
  email: string;
  requires_password: boolean;
  user_name: string;
}

export interface LoginResult {
  user: User;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  checkEmail(email: string): Observable<CheckEmailResult> {
    return this.http
      .post<CheckEmailResult>(`${this.base}/api/auth/check-email`, { email })
      .pipe(catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Failed to check email'))));
  }

  loginUser(email: string, password?: string): Observable<LoginResult> {
    return this.http
      .post<LoginResult>(`${this.base}/api/auth/login`, { email, password: password || null })
      .pipe(catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Login failed'))));
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.base}/api/auth/me`);
  }

  logoutUser(): Observable<void> {
    return this.http.post<void>(`${this.base}/api/auth/logout`, {}).pipe(catchError(() => of(void 0)));
  }
}
