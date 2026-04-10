import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { AppStateService } from '../../core/services/app-state.service';
import { IntroService } from '../../core/services/intro.service';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

@Component({
  selector: 'app-history-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './history-sidebar.component.css',
  template: `
    <div class="history-sidebar" [class.history-sidebar--ready]="intro.contentReady()">
      <button
        type="button"
        class="history-sidebar__new-btn"
        [class.history-sidebar__new-btn--active]="isOnGenerate()"
        (click)="onNewQuery()"
      >
        <span class="history-sidebar__new-icon">+</span>
        <span>New Query</span>
      </button>

      @if (state.history().length > 0) {
        <div class="history-sidebar__header">
          <span class="history-sidebar__count">History ({{ state.history().length }})</span>
          <button type="button" class="history-sidebar__clear" (click)="onClearAll()">
            Clear
          </button>
        </div>
      }

      @if (state.history().length === 0) {
        <div class="history-sidebar__empty">
          <span class="history-sidebar__empty-icon">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <p>No history yet</p>
        </div>
      } @else {
        <div class="history-sidebar__list">
          @for (conv of state.history(); track conv.id; let i = $index) {
            <button
              type="button"
              class="history-sidebar__item"
              [class.history-sidebar__item--active]="state.selectedConversationId() === conv.id"
              [style.--stagger-delay]="i * 0.03 + 's'"
              (click)="onSelect(conv.id)"
            >
              <span class="history-sidebar__item-query">{{ conv.query }}</span>
              <div class="history-sidebar__item-meta">
                <span class="history-sidebar__item-time">{{ timeAgo(conv.timestamp) }}</span>
                @if (conv.customPrompt) {
                  <span class="history-sidebar__item-badge">P</span>
                }
              </div>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class HistorySidebarComponent implements OnInit {
  protected state = inject(AppStateService);
  protected intro = inject(IntroService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected timeAgo = timeAgo;

  /** Tracks the active URL so the "New Query" button highlights on /generate. */
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected isOnGenerate = computed(() =>
    this.currentUrl().startsWith('/generate'),
  );

  ngOnInit(): void {
    // Load history once when the sidebar mounts. AppStateService.loadHistory
    // is idempotent — repeated calls dedup via shareReplay in ApiService.
    void this.state.loadHistory();
  }

  onNewQuery(): void {
    this.state.newQuery();
  }

  async onClearAll(): Promise<void> {
    try {
      await this.state.clearAllHistory();
    } catch {
      /* swallow — UI state already cleared optimistically */
    }
  }

  onSelect(id: string): void {
    this.state.selectConversation(id);
  }
}
