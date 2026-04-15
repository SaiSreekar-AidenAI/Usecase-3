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
import { AppStateService } from '../../core/services/app-state.service';
import { ButtonComponent } from '../ui/button.component';

type Tab = 'response' | 'reasoning' | 'sources';

@Component({
  selector: 'app-response-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent],
  styleUrl: './response-panel.component.css',
  template: `
    <div class="response-panel">
      <div class="response-panel__header">
        <div class="response-panel__tabs">
          <button
            type="button"
            class="response-panel__tab"
            [class.response-panel__tab--active]="activeTab() === 'response'"
            (click)="activeTab.set('response')"
          >
            Response
          </button>
          <button
            type="button"
            class="response-panel__tab"
            [class.response-panel__tab--active]="activeTab() === 'reasoning'"
            (click)="activeTab.set('reasoning')"
          >
            Reasoning
          </button>
          <button
            type="button"
            class="response-panel__tab"
            [class.response-panel__tab--active]="activeTab() === 'sources'"
            (click)="activeTab.set('sources')"
          >
            Sources@if (state.sources().length > 0) { ({{ state.sources().length }}) }
          </button>
        </div>

        @if (activeTab() === 'response') {
          <div class="response-panel__actions">
            @if (isEdited()) {
              <app-button
                variant="primary"
                [disabled]="saving()"
                (click)="onSave()"
              >
                {{ saved() ? 'Saved!' : saving() ? 'Saving...' : 'Save' }}
              </app-button>
            }
            <app-button variant="success" (click)="onCopy()">
              {{ copied() ? 'Copied!' : 'Copy' }}
            </app-button>
          </div>
        }
      </div>

      @switch (activeTab()) {
        @case ('response') {
          <textarea
            #textarea
            class="response-panel__textarea"
            spellcheck="false"
            [value]="state.editedResponse()"
            (input)="onInput($event)"
          ></textarea>
          <p class="response-panel__hint">
            {{
              isEdited()
                ? 'You have unsaved edits — click Save to update'
                : 'Edit the response above before copying'
            }}
          </p>
        }

        @case ('reasoning') {
          <div class="response-panel__reasoning">
            {{ state.reasoning() ?? 'No reasoning available for this response.' }}
          </div>
        }

        @case ('sources') {
          <div class="response-panel__sources">
            @if (state.sources().length === 0) {
              <p class="response-panel__sources-empty">No sources retrieved.</p>
            } @else {
              @for (src of state.sources(); track $index) {
                <div class="response-panel__source-card">
                  <div class="response-panel__source-header">
                    <span class="response-panel__source-badge">{{ src.category }}</span>
                    <span class="response-panel__source-score">
                      {{ (src.relevance_score * 100).toFixed(0) }}% match
                    </span>
                  </div>
                  <p class="response-panel__source-desc">{{ src.description }}</p>
                  <p class="response-panel__source-response">{{ src.response }}</p>
                </div>
              }
            }
          </div>
        }
      }
    </div>
  `,
})
export class ResponsePanelComponent implements AfterViewInit {
  protected state = inject(AppStateService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('textarea') textareaRef?: ElementRef<HTMLTextAreaElement>;

  protected activeTab = signal<Tab>('response');
  protected copied = signal(false);
  protected saved = signal(false);
  protected saving = signal(false);

  protected isEdited = computed(
    () => this.state.editedResponse() !== this.state.response(),
  );

  constructor() {
    // Whenever editedResponse changes (via load or external set), reflow the textarea.
    effect(() => {
      // touch the signal so the effect re-runs on change
      void this.state.editedResponse();
      queueMicrotask(() => this.autoResize());
    });
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
    this.state.setEditedResponse(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  async onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.state.editedResponse());
      this.copied.set(true);
      setTimeout(() => {
        this.copied.set(false);
        this.cdr.markForCheck();
      }, 2000);
    } catch {
      this.textareaRef?.nativeElement.select();
    }
  }

  async onSave(): Promise<void> {
    const id = this.state.selectedConversationId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    try {
      await this.state.updateConversationResponse(id, this.state.editedResponse());
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
}
