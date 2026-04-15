import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from '@angular/core';

export type ButtonVariant = 'primary' | 'danger' | 'success' | 'accent' | 'ghost';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Resolve button — gold-shimmer primary, outlined danger/success, ghost.
 *
 * Encapsulation is None so the .btn / .btn--variant class names live in the
 * global stylesheet (Button.css ported verbatim from React) and we don't pay
 * the cost of duplicate per-instance scoped styles.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './button.component.css',
  template: `
    <button
      [type]="type()"
      [class]="'btn btn--' + variant()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  type = input<ButtonType>('button');
  disabled = input<boolean>(false);
}
