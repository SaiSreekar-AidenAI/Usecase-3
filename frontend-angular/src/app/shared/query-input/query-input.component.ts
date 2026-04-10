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
  styleUrl: './query-input.component.css',
  template: `
    <div class="query-input">
      <label class="query-input__label" for="query-textarea">Customer Query</label>
      <textarea
        id="query-textarea"
        class="query-input__textarea"
        placeholder="Paste the customer's query here..."
        rows="4"
        spellcheck="false"
        [value]="state.query()"
        (input)="onInput($event)"
      ></textarea>
    </div>
  `,
})
export class QueryInputComponent {
  protected state = inject(AppStateService);

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.state.setQuery(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
