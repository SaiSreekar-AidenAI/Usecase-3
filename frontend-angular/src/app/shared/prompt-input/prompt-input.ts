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
  templateUrl: './prompt-input.html',
  styleUrl: './prompt-input.css',
})
export class PromptInput {
  protected state = inject(AppStateService);

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.state.setCustomPrompt(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}
