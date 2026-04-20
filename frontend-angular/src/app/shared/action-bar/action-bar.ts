import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';
import { Button } from '../ui/button/button';
import { Toggle } from '../ui/toggle/toggle';

@Component({
  selector: 'app-action-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [Button, Toggle],
  templateUrl: './action-bar.html',
  styleUrl: './action-bar.css',
})
export class ActionBar {
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
