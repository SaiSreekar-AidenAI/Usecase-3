import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  templateUrl: './theme-switcher.html',
  styleUrl: './theme-switcher.css',
})
export class ThemeSwitcher {
  private hostEl = inject(ElementRef<HTMLElement>);
  protected theme = inject(ThemeService);
  protected hovered = signal(false);
  protected isDark = computed(() => this.theme.theme() === 'dark');

  onToggle(): void {
    const btn = (this.hostEl.nativeElement as HTMLElement).querySelector(
      '.theme-switch',
    ) as HTMLElement | null;
    let origin: { x: number; y: number } | undefined;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    this.theme.toggleTheme(origin);
  }
}
