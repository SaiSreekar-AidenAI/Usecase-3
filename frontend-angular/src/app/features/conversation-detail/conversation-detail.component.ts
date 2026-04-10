import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { AppStateService } from '../../core/services/app-state.service';
import { IntroService } from '../../core/services/intro.service';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { Conversation } from '../../core/types';

type Tab = 'response' | 'reasoning' | 'sources';

/**
 * Detail view for a single past conversation. Resolves the `:id` route param,
 * looks the conversation up in the AppStateService history signal (which is
 * the same source the sidebar reads from — no extra API call), and renders
 * the same tabbed editor as the GenerateView's response panel, plus a
 * delete action.
 */
@Component({
  selector: 'app-conversation-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent, CardComponent],
  styleUrl: './conversation-detail.component.css',
  template: `
    @if (conversation(); as conv) {
      <div class="conv-detail" [class.conv-detail--ready]="intro.contentReady()">
        <!-- Top actions -->
        <div class="conv-detail__topbar conv-detail__stagger-1">
          <app-button variant="ghost" (click)="onNewQuery()">
            ← New Query
          </app-button>
          <span class="conv-detail__timestamp">{{ formatTime(conv.timestamp) }}</span>
        </div>

        <!-- Query bubble -->
        <div class="conv-detail__stagger-2">
          <app-card variant="conv-detail__query-card">
            <div class="conv-detail__card-label">
              <span class="conv-detail__label-dot conv-detail__label-dot--query"></span>
              <span>Customer Query</span>
            </div>
            <p class="conv-detail__query-text">{{ conv.query }}</p>
            @if (conv.customPrompt) {
              <div class="conv-detail__prompt-used">
                <span class="conv-detail__prompt-tag">Custom Prompt</span>
                <span class="conv-detail__prompt-text">{{ conv.customPrompt }}</span>
              </div>
            }
          </app-card>
        </div>

        <!-- Connector line -->
        <div class="conv-detail__connector conv-detail__stagger-3">
          <div class="conv-detail__connector-line"></div>
          <span class="conv-detail__connector-label">AI Generated</span>
          <div class="conv-detail__connector-line"></div>
        </div>

        <!-- Response card -->
        <div class="conv-detail__stagger-4">
          <app-card variant="conv-detail__response-card">
            <div class="conv-detail__response-header">
              <div class="conv-detail__tabs">
                <button
                  type="button"
                  class="conv-detail__tab"
                  [class.conv-detail__tab--active]="activeTab() === 'response'"
                  (click)="activeTab.set('response')"
                >
                  Response
                </button>
                <button
                  type="button"
                  class="conv-detail__tab"
                  [class.conv-detail__tab--active]="activeTab() === 'reasoning'"
                  (click)="activeTab.set('reasoning')"
                >
                  Reasoning
                </button>
                <button
                  type="button"
                  class="conv-detail__tab"
                  [class.conv-detail__tab--active]="activeTab() === 'sources'"
                  (click)="activeTab.set('sources')"
                >
                  Sources@if (sourcesCount() > 0) { ({{ sourcesCount() }}) }
                </button>
              </div>
              <div class="conv-detail__response-actions">
                @if (activeTab() === 'response' && isEdited()) {
                  <app-button
                    variant="primary"
                    [disabled]="saving()"
                    (click)="onSave(conv.id)"
                  >
                    {{ saved() ? 'Saved!' : saving() ? 'Saving...' : 'Save' }}
                  </app-button>
                }
                <app-button variant="success" (click)="onCopy()">
                  {{ copied() ? 'Copied!' : 'Copy' }}
                </app-button>
                <app-button variant="danger" (click)="onDelete(conv.id)">
                  Delete
                </app-button>
              </div>
            </div>

            @switch (activeTab()) {
              @case ('response') {
                <textarea
                  #textarea
                  class="conv-detail__response-textarea"
                  spellcheck="false"
                  [value]="editedText()"
                  (input)="onInput($event)"
                ></textarea>
                <p class="conv-detail__edit-hint">
                  {{
                    isEdited()
                      ? 'You have unsaved edits — click Save to update'
                      : 'Edit the response above before copying'
                  }}
                </p>
              }
              @case ('reasoning') {
                <div class="conv-detail__reasoning-body">
                  {{ conv.reasoning || 'No reasoning available for this response.' }}
                </div>
              }
              @case ('sources') {
                <div class="conv-detail__sources-body">
                  @if (sourcesCount() === 0) {
                    <p class="conv-detail__sources-empty">No sources retrieved.</p>
                  } @else {
                    @for (src of conv.sources; track $index) {
                      <div class="conv-detail__source-card">
                        <div class="conv-detail__source-header">
                          <span class="conv-detail__source-badge">{{ src.category }}</span>
                          <span class="conv-detail__source-score">
                            {{ (src.relevance_score * 100).toFixed(0) }}% match
                          </span>
                        </div>
                        <p class="conv-detail__source-desc">{{ src.description }}</p>
                        <p class="conv-detail__source-response">{{ src.response }}</p>
                      </div>
                    }
                  }
                </div>
              }
            }
          </app-card>
        </div>
      </div>
    } @else {
      <div class="conv-detail conv-detail--missing">
        <p class="conv-detail__missing-text">Conversation not found.</p>
        <app-button variant="ghost" (click)="onNewQuery()">← New Query</app-button>
      </div>
    }
  `,
})
export class ConversationDetailComponent implements AfterViewInit {
  protected state = inject(AppStateService);
  protected intro = inject(IntroService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('textarea') textareaRef?: ElementRef<HTMLTextAreaElement>;

  private routeId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: null as string | null },
  );

  protected conversation = computed<Conversation | null>(() => {
    const id = this.routeId();
    if (!id) return null;
    return this.state.history().find((c) => c.id === id) ?? null;
  });

  protected sourcesCount = computed(
    () => this.conversation()?.sources?.length ?? 0,
  );

  protected activeTab = signal<Tab>('response');
  protected editedText = signal<string>('');
  protected copied = signal(false);
  protected saved = signal(false);
  protected saving = signal(false);

  protected isEdited = computed(
    () => this.editedText() !== (this.conversation()?.response ?? ''),
  );

  constructor() {
    // Sync editedText whenever the resolved conversation changes (route swap
    // or after a save propagates new state).
    effect(() => {
      const conv = this.conversation();
      if (conv) {
        this.editedText.set(conv.response);
        queueMicrotask(() => this.autoResize());
      }
    });

    // Make sure history is loaded so the lookup succeeds on direct deep-link.
    if (this.state.history().length === 0) {
      void this.state.loadHistory();
    }
  }

  ngAfterViewInit(): void {
    this.autoResize();
  }

  private autoResize(): void {
    const el = this.textareaRef?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.editedText.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  async onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.editedText());
      this.copied.set(true);
      setTimeout(() => {
        this.copied.set(false);
        this.cdr.markForCheck();
      }, 2000);
    } catch {
      this.textareaRef?.nativeElement.select();
    }
  }

  async onSave(id: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.state.updateConversationResponse(id, this.editedText());
      this.saved.set(true);
      setTimeout(() => {
        this.saved.set(false);
        this.cdr.markForCheck();
      }, 2000);
    } catch {
      /* ignore */
    } finally {
      this.saving.set(false);
    }
  }

  async onDelete(id: string): Promise<void> {
    await this.state.deleteConversation(id);
  }

  onNewQuery(): void {
    this.state.newQuery();
  }

  formatTime(timestamp: number): string {
    const d = new Date(timestamp);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  }
}
