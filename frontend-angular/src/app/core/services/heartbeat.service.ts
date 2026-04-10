import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 60_000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll'] as const;

@Injectable({ providedIn: 'root' })
export class HeartbeatService implements OnDestroy {
  private api = inject(ApiService);
  private lastActivity = Date.now();
  private intervalId: number | null = null;
  private listenerBound = false;
  private readonly markActive = () => {
    this.lastActivity = Date.now();
  };

  startTracking(): void {
    if (typeof window === 'undefined') return;
    if (this.intervalId !== null) return;
    if (!this.listenerBound) {
      for (const evt of ACTIVITY_EVENTS) {
        window.addEventListener(evt, this.markActive, { passive: true });
      }
      this.listenerBound = true;
    }
    this.lastActivity = Date.now();
    this.intervalId = window.setInterval(() => {
      const idle = Date.now() - this.lastActivity > IDLE_THRESHOLD_MS;
      this.api.sendHeartbeat(!idle).subscribe({
        error: (err) => {
          // Session is gone — stop the timer so we don't spam the audit log
          // from a stale tab. AuthService will tear us down on its own when
          // the user reauthenticates and the auth signal flips back.
          if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
            this.stopTracking();
          }
        },
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  stopTracking(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.listenerBound) {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, this.markActive);
      }
      this.listenerBound = false;
    }
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }
}
