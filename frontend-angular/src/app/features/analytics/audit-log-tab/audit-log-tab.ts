import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { AuditEvent } from '../../../core/types';

const EVENT_TYPES: ReadonlyArray<string> = [
  'login',
  'logout',
  'generate',
  'history_view',
  'history_edit',
  'history_delete',
  'history_clear',
  'user_create',
  'user_update',
  'user_delete',
  'auth_failure',
  'unauthorized_access',
];

const EVENT_COLORS: Readonly<Record<string, string>> = {
  login: 'success',
  logout: 'warning',
  generate: 'accent',
  auth_failure: 'danger',
  unauthorized_access: 'danger',
  history_delete: 'danger',
  history_clear: 'danger',
  user_delete: 'danger',
  user_create: 'success',
  user_update: 'accent',
};

const PAGE_LIMIT = 25;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

@Component({
  selector: 'app-audit-log-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule],
  templateUrl: './audit-log-tab.html',
  styleUrl: './audit-log-tab.css',
})
export class AuditLogTab {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  protected readonly eventTypes = EVENT_TYPES;

  protected events = signal<AuditEvent[]>([]);
  protected total = signal<number>(0);
  protected page = signal<number>(1);
  protected filter = signal<string>('');
  protected expandedId = signal<string | null>(null);

  protected totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / PAGE_LIMIT)),
  );

  constructor() {
    void this.load();
  }

  protected formatTime = formatTime;

  protected humanize(value: string): string {
    return value.replace(/_/g, ' ');
  }

  protected badgeFor(eventType: string): string {
    return EVENT_COLORS[eventType] ?? 'default';
  }

  protected prettyJson(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  protected async onFilterChange(value: string): Promise<void> {
    this.filter.set(value);
    this.page.set(1);
    this.expandedId.set(null);
    await this.load();
  }

  protected async prevPage(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.expandedId.set(null);
    await this.load();
  }

  protected async nextPage(): Promise<void> {
    if (this.page() >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.expandedId.set(null);
    await this.load();
  }

  protected toggleExpanded(id: string): void {
    this.expandedId.update((curr) => (curr === id ? null : id));
  }

  private async load(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.api.fetchAuditLog({
          page: this.page(),
          limit: PAGE_LIMIT,
          event_type: this.filter() || undefined,
        }),
      );
      this.events.set(res.items);
      this.total.set(res.total);
    } catch {
      /* ignore */
    } finally {
      this.cdr.markForCheck();
    }
  }
}
