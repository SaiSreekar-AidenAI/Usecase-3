import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import {
  LoginAttempt,
  SecurityAlert,
  SessionActivity,
} from '../../../core/types';

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Component({
  selector: 'app-sessions-security-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './sessions-security-tab.html',
  styleUrl: './sessions-security-tab.css',
})
export class SessionsSecurityTab {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  protected sessions = signal<SessionActivity[]>([]);
  protected alerts = signal<SecurityAlert[]>([]);
  protected logins = signal<LoginAttempt[]>([]);

  protected formatTime = formatTime;
  protected formatDuration = formatDuration;

  protected humanize(value: string): string {
    return value.replace(/_/g, ' ');
  }

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [sessions, alerts, logins] = await Promise.all([
        firstValueFrom(this.api.fetchSessions()),
        firstValueFrom(this.api.fetchSecurityAlerts()),
        firstValueFrom(this.api.fetchLoginAttempts({ limit: 20 })),
      ]);
      this.sessions.set(sessions);
      this.alerts.set(alerts);
      this.logins.set(logins.items);
    } catch {
      /* ignore */
    } finally {
      this.cdr.markForCheck();
    }
  }
}
