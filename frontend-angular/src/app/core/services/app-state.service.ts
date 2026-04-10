import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Conversation, RetrievedSource } from '../types';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private api = inject(ApiService);
  private router = inject(Router);

  // ── Signals (private writable, exposed read-only) ─────
  private _query = signal<string>('');
  private _response = signal<string>('');
  private _editedResponse = signal<string>('');
  private _customPrompt = signal<string>('');
  private _promptModeEnabled = signal<boolean>(false);
  private _isLoading = signal<boolean>(false);
  private _reasoning = signal<string | null>(null);
  private _sources = signal<RetrievedSource[]>([]);
  private _history = signal<Conversation[]>([]);
  private _selectedConversationId = signal<string | null>(null);

  readonly query = this._query.asReadonly();
  readonly response = this._response.asReadonly();
  readonly editedResponse = this._editedResponse.asReadonly();
  readonly customPrompt = this._customPrompt.asReadonly();
  readonly promptModeEnabled = this._promptModeEnabled.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly reasoning = this._reasoning.asReadonly();
  readonly sources = this._sources.asReadonly();
  readonly history = this._history.asReadonly();
  readonly selectedConversationId = this._selectedConversationId.asReadonly();

  readonly selectedConversation = computed(() => {
    const id = this._selectedConversationId();
    if (!id) return null;
    return this._history().find((c) => c.id === id) ?? null;
  });

  // ── Mutators ──────────────────────────────────────────
  setQuery(value: string): void {
    this._query.set(value);
  }

  setCustomPrompt(value: string): void {
    this._customPrompt.set(value);
  }

  togglePromptMode(): void {
    this._promptModeEnabled.update((v) => !v);
  }

  setEditedResponse(value: string): void {
    this._editedResponse.set(value);
  }

  generateStart(): void {
    this._isLoading.set(true);
    this._response.set('');
    this._editedResponse.set('');
    this._reasoning.set(null);
    this._sources.set([]);
  }

  async generate(): Promise<void> {
    const q = this._query().trim();
    if (!q) return;
    this.generateStart();
    try {
      const result = await firstValueFrom(
        this.api.generateResponse(q, this._customPrompt() || undefined),
      );
      this._response.set(result.response);
      this._editedResponse.set(result.response);
      this._reasoning.set(result.reasoning ?? null);
      this._sources.set(result.sources ?? []);
      this._history.update((h) => [result.conversation, ...h]);
      this._selectedConversationId.set(result.conversation.id);
      // Stay on /generate; the response card renders inline.
    } finally {
      this._isLoading.set(false);
    }
  }

  clearResponse(): void {
    this._response.set('');
    this._editedResponse.set('');
    this._reasoning.set(null);
    this._sources.set([]);
  }

  async loadHistory(): Promise<void> {
    try {
      const items = await firstValueFrom(this.api.fetchHistory());
      this._history.set(items);
    } catch {
      /* leave existing */
    }
  }

  async updateConversationResponse(id: string, response: string): Promise<void> {
    await firstValueFrom(this.api.updateHistoryItem(id, response));
    this._history.update((h) => h.map((c) => (c.id === id ? { ...c, response } : c)));
    if (this._selectedConversationId() === id) {
      this._response.set(response);
      this._editedResponse.set(response);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await firstValueFrom(this.api.deleteHistoryItem(id));
    this._history.update((h) => h.filter((c) => c.id !== id));
    if (this._selectedConversationId() === id) {
      this._selectedConversationId.set(null);
      this.router.navigate(['/generate']);
    }
  }

  async clearAllHistory(): Promise<void> {
    await firstValueFrom(this.api.clearAllHistory());
    this._history.set([]);
    this._selectedConversationId.set(null);
    this.router.navigate(['/generate']);
  }

  selectConversation(id: string): void {
    this._selectedConversationId.set(id);
    this.router.navigate(['/history', id]);
  }

  newQuery(): void {
    this._selectedConversationId.set(null);
    this._query.set('');
    this._customPrompt.set('');
    this.clearResponse();
    this.router.navigate(['/generate']);
  }
}
