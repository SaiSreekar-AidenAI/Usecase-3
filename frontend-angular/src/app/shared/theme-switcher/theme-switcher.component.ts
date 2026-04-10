import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './theme-switcher.component.css',
  template: `
    <button
      type="button"
      class="theme-switch"
      [attr.aria-label]="'Switch to ' + (isDark() ? 'light' : 'dark') + ' theme'"
      (click)="onToggle()"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
    >
      <span class="theme-switch__glyph" [attr.data-theme]="theme.theme()">
        @if (isDark()) {
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
          </svg>
        } @else {
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <path
              d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            />
          </svg>
        }
      </span>

      <div class="theme-switch__track">
        <div
          class="theme-switch__indicator"
          [style.margin-left]="isDark() ? '0' : 'auto'"
        ></div>
      </div>

      @if (hovered()) {
        <span class="theme-switch__label">{{ isDark() ? 'Obsidian' : 'Paper' }}</span>
      }
    </button>
  `,
})
export class ThemeSwitcherComponent {
  protected theme = inject(ThemeService);
  protected hovered = signal(false);
  protected isDark = computed(() => this.theme.theme() === 'obsidian');

  onToggle(): void {
    this.theme.toggleTheme();
  }
}
