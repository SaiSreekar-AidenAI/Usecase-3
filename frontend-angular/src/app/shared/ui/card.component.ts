import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  inject,
  input,
} from '@angular/core';

/**
 * Cursor-reactive card. Updates `--glow-x` / `--glow-y` CSS vars on mousemove
 * so the radial gradient inside `.card__glow` follows the pointer. No
 * Framer Motion / no Angular animation engine — just two CSS variables and
 * a transition. This is the "differentiation anchor" of the design system.
 *
 * Accepts an optional `class` input that extends `.card` (e.g., for layout-
 * specific overrides like `.generate-view__input-card`).
 */
@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './card.component.css',
  template: `
    <div [class]="'card ' + variant()">
      <div class="card__glow"></div>
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  private host = inject(ElementRef<HTMLElement>);

  /** Additional class names appended to the inner `.card` element. */
  variant = input<string>('');

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>('.card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty('--glow-x', x.toFixed(3));
    card.style.setProperty('--glow-y', y.toFixed(3));
  }
}
