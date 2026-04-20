import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';

import { AppStateService } from '../../../core/services/app-state.service';
import { IntroService } from '../../../core/services/intro.service';
import { Card } from '../../../shared/ui/card/card';
import { LoadingSpinner } from '../../../shared/ui/loading-spinner/loading-spinner';
import { QueryInput } from '../../../shared/query-input/query-input';
import { PromptInput } from '../../../shared/prompt-input/prompt-input';
import { ActionBar } from '../../../shared/action-bar/action-bar';
import { ResponsePanel } from '../../../shared/response-panel/response-panel';

@Component({
  selector: 'app-generate-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    Card,
    LoadingSpinner,
    QueryInput,
    PromptInput,
    ActionBar,
    ResponsePanel,
  ],
  templateUrl: './generate-view.html',
  styleUrl: './generate-view.css',
})
export class GenerateView {
  protected state = inject(AppStateService);
  protected intro = inject(IntroService);
}
