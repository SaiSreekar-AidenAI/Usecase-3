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
import { Button } from '../ui/button/button';

type Tab = 'response' | 'reasoning' | 'sources';

@Component({
  selector: 'app-response-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [Button],
  templateUrl: './response-panel.html',
  styleUrl: './response-panel.css',
})
export class ResponsePanel implements AfterViewInit {
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
    effect(() => {
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
