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
  templateUrl: './history-sidebar.html',
  styleUrl: './history-sidebar.css',
})
export class HistorySidebar implements OnInit {
  protected state = inject(AppStateService);
  protected intro = inject(IntroService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected timeAgo = timeAgo;

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
    void this.state.loadHistory();
  }

  onNewQuery(): void {
    this.state.newQuery();
  }

  async onClearAll(): Promise<void> {
    try {
      await this.state.clearAllHistory();
    } catch {
      /* swallow */
    }
  }

  onSelect(id: string): void {
    this.state.selectConversation(id);
  }
}
