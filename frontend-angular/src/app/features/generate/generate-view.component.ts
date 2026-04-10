import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from '@angular/core';

import { AppStateService } from '../../core/services/app-state.service';
import { IntroService } from '../../core/services/intro.service';
import { CardComponent } from '../../shared/ui/card.component';
import { LoadingSpinnerComponent } from '../../shared/ui/loading-spinner.component';
import { QueryInputComponent } from '../../shared/query-input/query-input.component';
import { PromptInputComponent } from '../../shared/prompt-input/prompt-input.component';
import { ActionBarComponent } from '../../shared/action-bar/action-bar.component';
import { ResponsePanelComponent } from '../../shared/response-panel/response-panel.component';

/**
 * The primary view: a hero, an input card (query + optional prompt + action
 * bar), and either a loading spinner OR a response card. Stagger animations
 * are CSS-driven and gated by the `intro-content` class on the shell.
 */
@Component({
  selector: 'app-generate-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CardComponent,
    LoadingSpinnerComponent,
    QueryInputComponent,
    PromptInputComponent,
    ActionBarComponent,
    ResponsePanelComponent,
  ],
  styleUrl: './generate-view.component.css',
  template: `
    <div class="generate-view" [class.generate-view--ready]="intro.contentReady()">
      <!-- ═══ HERO ═══ -->
      <div class="generate-view__hero generate-view__stagger-1">
        <div class="generate-view__hero-accent"></div>
        <h2 class="generate-view__hero-title">
          Craft The Perfect<br />
          <span class="generate-view__hero-highlight">Support Response</span>
        </h2>
        <p class="generate-view__hero-desc">
          Paste a customer query below. AI generates a tailored, human-quality
          response in seconds.
        </p>
      </div>

      <!-- ═══ INPUT CARD ═══ -->
      <div class="generate-view__stagger-2">
        <app-card variant="generate-view__input-card">
          <div class="generate-view__card-header">
            <span class="generate-view__card-tag">Input</span>
            <span class="generate-view__card-line"></span>
          </div>

          <app-query-input />

          <div
            class="generate-view__prompt-wrap"
            [class.generate-view__prompt-wrap--open]="state.promptModeEnabled()"
          >
            @if (state.promptModeEnabled()) {
              <app-prompt-input />
            }
          </div>

          <div class="generate-view__actions">
            <app-action-bar />
          </div>
        </app-card>
      </div>

      <!-- ═══ LOADING / RESPONSE ═══ -->
      @if (state.isLoading()) {
        <div class="generate-view__loader-wrap">
          <app-loading-spinner />
        </div>
      } @else if (state.response()) {
        <div class="generate-view__response-wrap">
          <app-card variant="generate-view__response-card">
            <div class="generate-view__card-header">
              <span class="generate-view__card-tag generate-view__card-tag--output">
                Output
              </span>
              <span class="generate-view__card-line"></span>
            </div>
            <app-response-panel />
          </app-card>
        </div>
      }
    </div>
  `,
})
export class GenerateViewComponent {
  protected state = inject(AppStateService);
  protected intro = inject(IntroService);
}
