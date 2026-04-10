import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-prompt-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './prompt-input.component.css',
  template: `
    <div class="prompt-input">
      <label class="prompt-input__label" for="prompt-textarea">Custom Prompt</label>
      <textarea
        id="prompt-textarea"
        class="prompt-input__textarea"
        placeholder="Add specific instructions for the AI..."
        rows="2"
        spellcheck="false"
        [value]="state.customPrompt()"
        (input)="onInput($event)"
      ></textarea>
    </div>
  `,
})
export class PromptInputComponent {
  protected state = inject(AppStateService);

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.state.setCustomPrompt(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
