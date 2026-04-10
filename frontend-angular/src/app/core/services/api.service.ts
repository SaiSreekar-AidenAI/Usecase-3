import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuditEvent,
  Conversation,
  DailyActivityPoint,
  HeatmapCell,
  LoginAttempt,
  OverviewStats,
  RetrievedSource,
  SecurityAlert,
  SessionActivity,
  TokenByUser,
  TokenUsagePoint,
  User,
} from '../types';

export interface GenerateResult {
  response: string;
  reasoning: string | null;
  sources: RetrievedSource[];
  conversation: Conversation;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

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
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  // Mirrors the historyInFlight dedup logic from the React api.ts
  private historyInFlight$: Observable<Conversation[]> | null = null;

  // ── Generate / History ────────────────────────────────
  generateResponse(query: string, customPrompt?: string): Observable<GenerateResult> {
    return this.http
      .post<{ response: string; reasoning?: string | null; sources?: RetrievedSource[]; conversation: Conversation }>(
        `${this.base}/api/generate`,
        { query, customPrompt: customPrompt || null },
      )
      .pipe(
        catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Failed to generate response'))),
      ) as Observable<GenerateResult>;
  }

  fetchHistory(): Observable<Conversation[]> {
    if (this.historyInFlight$) {
      return this.historyInFlight$;
    }
    this.historyInFlight$ = this.http.get<Conversation[]>(`${this.base}/api/history`).pipe(
      shareReplay(1),
      catchError((err) => {
        this.historyInFlight$ = null;
        return throwError(() => new Error(err?.error?.detail ?? 'Failed to fetch history'));
      }),
      finalize(() => {
        // Allow a fresh fetch on the next call
        this.historyInFlight$ = null;
      }),
    );
    return this.historyInFlight$;
  }

  updateHistoryItem(id: string, response: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/api/history/${id}`, { response });
  }

  deleteHistoryItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/history/${id}`);
  }

  clearAllHistory(): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/history`);
  }

  // ── Auth ─────────────────────────────────────────────
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

  // ── Users ────────────────────────────────────────────
  fetchUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/api/users`);
  }

  createUser(data: { email: string; name: string; role: string; password?: string }): Observable<User> {
    return this.http
      .post<User>(`${this.base}/api/users`, data)
      .pipe(catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Failed to create user'))));
  }

  updateUser(
    userId: string,
    data: { name?: string; role?: string; password?: string; is_active?: boolean },
  ): Observable<User> {
    return this.http
      .patch<User>(`${this.base}/api/users/${userId}`, data)
      .pipe(catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Failed to update user'))));
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/users/${userId}`);
  }

  // ── Analytics ────────────────────────────────────────
  fetchOverviewStats(): Observable<OverviewStats> {
    return this.http.get<OverviewStats>(`${this.base}/api/analytics/overview`);
  }

  fetchDailyActivity(days = 30): Observable<DailyActivityPoint[]> {
    return this.http.get<DailyActivityPoint[]>(`${this.base}/api/analytics/daily-activity`, {
      params: new HttpParams().set('days', String(days)),
    });
  }

  fetchAuditLog(params: {
    page?: number;
    limit?: number;
    event_type?: string;
    user_id?: string;
    from_ts?: number;
    to_ts?: number;
  }): Observable<PaginatedResult<AuditEvent>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limit) p = p.set('limit', String(params.limit));
    if (params.event_type) p = p.set('event_type', params.event_type);
    if (params.user_id) p = p.set('user_id', params.user_id);
    if (params.from_ts) p = p.set('from_ts', String(params.from_ts));
    if (params.to_ts) p = p.set('to_ts', String(params.to_ts));
    return this.http.get<PaginatedResult<AuditEvent>>(`${this.base}/api/analytics/audit-log`, { params: p });
  }

  fetchLoginAttempts(params: {
    page?: number;
    limit?: number;
    success?: boolean;
    from_ts?: number;
    to_ts?: number;
  }): Observable<PaginatedResult<LoginAttempt>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limit) p = p.set('limit', String(params.limit));
    if (params.success !== undefined) p = p.set('success', String(params.success));
    if (params.from_ts) p = p.set('from_ts', String(params.from_ts));
    if (params.to_ts) p = p.set('to_ts', String(params.to_ts));
    return this.http.get<PaginatedResult<LoginAttempt>>(`${this.base}/api/analytics/login-attempts`, { params: p });
  }

  fetchSessions(): Observable<SessionActivity[]> {
    return this.http.get<SessionActivity[]>(`${this.base}/api/analytics/sessions`);
  }

  fetchTokenUsage(params: {
    from_ts?: number;
    to_ts?: number;
    group_by?: 'day' | 'hour';
  }): Observable<TokenUsagePoint[]> {
    let p = new HttpParams();
    if (params.from_ts) p = p.set('from_ts', String(params.from_ts));
    if (params.to_ts) p = p.set('to_ts', String(params.to_ts));
    if (params.group_by) p = p.set('group_by', params.group_by);
    return this.http.get<TokenUsagePoint[]>(`${this.base}/api/analytics/token-usage`, { params: p });
  }

  fetchTokenByUser(): Observable<TokenByUser[]> {
    return this.http.get<TokenByUser[]>(`${this.base}/api/analytics/token-by-user`);
  }

  fetchSecurityAlerts(): Observable<SecurityAlert[]> {
    return this.http.get<SecurityAlert[]>(`${this.base}/api/analytics/security-alerts`);
  }

  fetchUsageHeatmap(): Observable<HeatmapCell[]> {
    return this.http.get<HeatmapCell[]>(`${this.base}/api/analytics/usage-heatmap`);
  }

  sendHeartbeat(active: boolean): Observable<void> {
    return this.http
      .post<void>(`${this.base}/api/analytics/heartbeat`, { active })
      .pipe(catchError(() => of(void 0)));
  }
}
