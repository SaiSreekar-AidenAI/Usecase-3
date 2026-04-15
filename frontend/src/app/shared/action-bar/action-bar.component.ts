import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';
import { ButtonComponent } from '../ui/button.component';
import { ToggleComponent } from '../ui/toggle.component';

@Component({
  selector: 'app-action-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent, ToggleComponent],
  styleUrl: './action-bar.component.css',
  template: `
    <div class="action-bar">
      <div class="action-bar__left">
        @if (!hasResponse()) {
          <app-button
            variant="primary"
            [disabled]="!canGenerate()"
            (click)="onGenerate()"
          >
            Generate Response
          </app-button>
        } @else {
          <app-button
            variant="danger"
            [disabled]="!canGenerate()"
            (click)="onGenerate()"
          >
            Regenerate
          </app-button>
          <app-button variant="ghost" (click)="onClear()">Clear</app-button>
        }
      </div>
      <div class="action-bar__right">
        <app-toggle
          [checked]="state.promptModeEnabled()"
          label="Prompt Mode"
          (checkedChange)="onTogglePromptMode()"
        />
      </div>
    </div>
  `,
})
export class ActionBarComponent {
  protected state = inject(AppStateService);

  protected hasResponse = computed(() => this.state.response().length > 0);
  protected canGenerate = computed(
    () => this.state.query().trim().length > 0 && !this.state.isLoading(),
  );

  async onGenerate(): Promise<void> {
    if (!this.canGenerate()) return;
    await this.state.generate();
  }

  onClear(): void {
    this.state.clearResponse();
  }

  onTogglePromptMode(): void {
    this.state.togglePromptMode();
  }
}
