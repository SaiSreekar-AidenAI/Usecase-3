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

import { AppStateService } from '../../../core/services/app-state.service';
import { IntroService } from '../../../core/services/intro.service';
import { Button } from '../../../shared/ui/button/button';
import { Card } from '../../../shared/ui/card/card';
import { Conversation } from '../../../core/types';

type Tab = 'response' | 'reasoning' | 'sources';

@Component({
  selector: 'app-conversation-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [Button, Card],
  templateUrl: './conversation-detail.html',
  styleUrl: './conversation-detail.css',
})
export class ConversationDetail implements AfterViewInit {
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
    effect(() => {
      const conv = this.conversation();
      if (conv) {
        this.editedText.set(conv.response);
        queueMicrotask(() => this.autoResize());
      }
    });

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
