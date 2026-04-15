import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuditEvent,
  DailyActivityPoint,
  HeatmapCell,
  LoginAttempt,
  OverviewStats,
  SecurityAlert,
  SessionActivity,
  TokenByUser,
  TokenUsagePoint,
} from '../types';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

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
    return this.http.post<void>(`${this.base}/api/analytics/heartbeat`, { active });
  }
}
