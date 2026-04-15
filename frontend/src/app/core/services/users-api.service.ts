import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User } from '../types';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private http = inject(HttpClient);
  private base = environment.apiBase;

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
}
