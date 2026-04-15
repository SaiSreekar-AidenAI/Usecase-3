import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Conversation, RetrievedSource } from '../types';

export interface GenerateResult {
  response: string;
  reasoning?: string | null;
  sources?: RetrievedSource[];
  conversation: Conversation;
}

@Injectable({ providedIn: 'root' })
export class ConversationsApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

  private historyInFlight$: Observable<Conversation[]> | null = null;

  generateResponse(query: string, customPrompt?: string): Observable<GenerateResult> {
    return this.http
      .post<GenerateResult>(
        `${this.base}/api/generate`,
        { query, customPrompt: customPrompt || null },
      )
      .pipe(
        catchError((err) => throwError(() => new Error(err?.error?.detail ?? 'Failed to generate response'))),
      );
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
}
