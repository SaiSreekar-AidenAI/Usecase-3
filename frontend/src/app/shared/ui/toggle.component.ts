import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './toggle.component.css',
  template: `
    <button
      type="button"
      class="toggle"
      role="switch"
      [attr.aria-checked]="checked()"
      (click)="toggle()"
    >
      <span class="toggle__track" [class.toggle__track--active]="checked()">
        <span class="toggle__thumb"></span>
      </span>
      <span class="toggle__label" [class.toggle__label--active]="checked()">
        {{ label() }}
      </span>
    </button>
  `,
})
export class ToggleComponent {
  checked = input<boolean>(false);
  label = input.required<string>();
  checkedChange = output<boolean>();

  toggle(): void {
    this.checkedChange.emit(!this.checked());
  }
}
