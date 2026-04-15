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

import { AnalyticsApiService } from '../../core/services/analytics-api.service';
import { AuditEvent } from '../../core/types';

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

/**
 * Audit log tab — paginated table of backend audit events with an
 * event-type filter and an expand-on-click row that pretty-prints the
 * stored metadata JSON. Mirrors the React tab 1:1.
 */
@Component({
  selector: 'app-audit-log-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule],
  styleUrl: './audit-log-tab.component.css',
  template: `
    <div class="audit-log">
      <div class="audit-log__toolbar">
        <select
          class="audit-log__filter"
          [ngModel]="filter()"
          (ngModelChange)="onFilterChange($event)"
        >
          <option value="">All Events</option>
          @for (t of eventTypes; track t) {
            <option [value]="t">{{ humanize(t) }}</option>
          }
        </select>
        <span class="audit-log__count">{{ total() }} events</span>
      </div>

      <div class="audit-log__table">
        <div class="audit-log__header-row">
          <span class="audit-log__col audit-log__col--time">Time</span>
          <span class="audit-log__col audit-log__col--event">Event</span>
          <span class="audit-log__col audit-log__col--user">User</span>
          <span class="audit-log__col audit-log__col--ip">IP</span>
          <span class="audit-log__col audit-log__col--resource">Resource</span>
        </div>

        @for (ev of events(); track ev.id) {
          <div class="audit-log__row-wrapper">
            <div
              class="audit-log__row"
              [class.audit-log__row--expanded]="expandedId() === ev.id"
              (click)="toggleExpanded(ev.id)"
            >
              <span class="audit-log__col audit-log__col--time">
                {{ formatTime(ev.timestamp) }}
              </span>
              <span class="audit-log__col audit-log__col--event">
                <span
                  [class]="'audit-log__badge audit-log__badge--' + badgeFor(ev.event_type)"
                >
                  {{ humanize(ev.event_type) }}
                </span>
              </span>
              <span class="audit-log__col audit-log__col--user">
                {{ ev.user_email || '—' }}
              </span>
              <span class="audit-log__col audit-log__col--ip">
                {{ ev.ip_address || '—' }}
              </span>
              <span class="audit-log__col audit-log__col--resource">
                {{ ev.resource_type || '—' }}
              </span>
            </div>
            @if (expandedId() === ev.id && ev.metadata_json) {
              <div class="audit-log__details">
                <pre class="audit-log__json">{{ prettyJson(ev.metadata_json) }}</pre>
              </div>
            }
          </div>
        }

        @if (events().length === 0) {
          <div class="audit-log__empty">No events found</div>
        }
      </div>

      <div class="audit-log__pagination">
        <button
          type="button"
          class="audit-log__page-btn"
          [disabled]="page() <= 1"
          (click)="prevPage()"
        >
          Prev
        </button>
        <span class="audit-log__page-info">{{ page() }} / {{ totalPages() }}</span>
        <button
          type="button"
          class="audit-log__page-btn"
          [disabled]="page() >= totalPages()"
          (click)="nextPage()"
        >
          Next
        </button>
      </div>
    </div>
  `,
})
export class AuditLogTabComponent {
  private analyticsApi = inject(AnalyticsApiService);
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
        this.analyticsApi.fetchAuditLog({
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
