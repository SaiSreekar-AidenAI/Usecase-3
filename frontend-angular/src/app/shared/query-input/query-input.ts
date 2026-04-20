import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-query-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './query-input.html',
  styleUrl: './query-input.css',
})
export class QueryInput {
  protected state = inject(AppStateService);

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.state.setQuery(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
