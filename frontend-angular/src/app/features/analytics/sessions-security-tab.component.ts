import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import {
  LoginAttempt,
  SecurityAlert,
  SessionActivity,
} from '../../core/types';

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

/**
 * Sessions & Security tab — three sections in one screen:
 *   1. Active security alerts (with severity badges)
 *   2. Sessions in the last 7 days (active vs ended, durations, action count)
 *   3. Recent login attempts with geo / browser info
 *
 * All three load in parallel via firstValueFrom + Promise.all so the tab
 * doesn't waterfall.
 */
@Component({
  selector: 'app-sessions-security-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './sessions-security-tab.component.css',
  template: `
    <div class="sessions-tab">
      <!-- Security alerts -->
      <section class="sessions-tab__section">
        <h3 class="sessions-tab__section-title">Security Alerts</h3>
        @if (alerts().length === 0) {
          <div class="sessions-tab__empty">No active alerts</div>
        } @else {
          <div class="sessions-tab__alerts">
            @for (a of alerts(); track $index) {
              <div
                class="sessions-tab__alert"
                [class]="'sessions-tab__alert sessions-tab__alert--' + a.severity"
                [style.animation-delay.ms]="$index * 50"
              >
                <span
                  [class]="'sessions-tab__severity sessions-tab__severity--' + a.severity"
                >
                  {{ a.severity }}
                </span>
                <div class="sessions-tab__alert-content">
                  <span class="sessions-tab__alert-type">
                    {{ humanize(a.alert_type) }}
                  </span>
                  <span class="sessions-tab__alert-desc">{{ a.description }}</span>
                  @if (a.user_email) {
                    <span class="sessions-tab__alert-user">{{ a.user_email }}</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Sessions table -->
      <section class="sessions-tab__section">
        <h3 class="sessions-tab__section-title">Sessions (Last 7 Days)</h3>
        <div class="sessions-tab__table">
          <div class="sessions-tab__header-row">
            <span>User</span>
            <span>Started</span>
            <span>Active Time</span>
            <span>Idle Time</span>
            <span>Actions</span>
            <span>Status</span>
          </div>
          @for (s of sessions(); track s.session_id) {
            <div class="sessions-tab__row">
              <span class="sessions-tab__cell">{{ s.user_email || s.user_id }}</span>
              <span class="sessions-tab__cell sessions-tab__cell--muted">
                {{ formatTime(s.started_at) }}
              </span>
              <span class="sessions-tab__cell">
                {{ formatDuration(s.active_duration_ms) }}
              </span>
              <span class="sessions-tab__cell sessions-tab__cell--muted">
                {{ formatDuration(s.idle_duration_ms) }}
              </span>
              <span class="sessions-tab__cell">{{ s.actions_count }}</span>
              <span class="sessions-tab__cell">
                <span
                  [class]="
                    'sessions-tab__status-dot sessions-tab__status-dot--' +
                    (s.is_active ? 'active' : 'ended')
                  "
                ></span>
                {{ s.is_active ? 'Active' : 'Ended' }}
              </span>
            </div>
          }
          @if (sessions().length === 0) {
            <div class="sessions-tab__empty">No sessions recorded</div>
          }
        </div>
      </section>

      <!-- Recent logins -->
      <section class="sessions-tab__section">
        <h3 class="sessions-tab__section-title">Recent Logins</h3>
        <div class="sessions-tab__table">
          <div class="sessions-tab__header-row sessions-tab__header-row--logins">
            <span>User</span>
            <span>IP</span>
            <span>Location</span>
            <span>Browser / OS</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          @for (l of logins(); track l.id) {
            <div class="sessions-tab__row sessions-tab__row--logins">
              <span class="sessions-tab__cell">{{ l.user_email }}</span>
              <span class="sessions-tab__cell sessions-tab__cell--mono">
                {{ l.ip_address || '—' }}
              </span>
              <span class="sessions-tab__cell sessions-tab__cell--muted">
                {{ l.country && l.city ? l.city + ', ' + l.country : '—' }}
              </span>
              <span class="sessions-tab__cell sessions-tab__cell--muted">
                {{ (l.browser || '—') + ' / ' + (l.os || '—') }}
              </span>
              <span class="sessions-tab__cell sessions-tab__cell--muted">
                {{ formatTime(l.timestamp) }}
              </span>
              <span class="sessions-tab__cell">
                <span
                  [class]="
                    'sessions-tab__login-badge sessions-tab__login-badge--' +
                    (l.success ? 'success' : 'fail')
                  "
                >
                  {{ l.success ? 'OK' : (l.failure_reason || 'Failed') }}
                </span>
              </span>
            </div>
          }
          @if (logins().length === 0) {
            <div class="sessions-tab__empty">No login attempts recorded</div>
          }
        </div>
      </section>
    </div>
  `,
})
export class SessionsSecurityTabComponent {
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
