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
  templateUrl: './toggle.html',
  styleUrl: './toggle.css',
})
export class Toggle {
  checked = input<boolean>(false);
  label = input.required<string>();
  checkedChange = output<boolean>();

  toggle(): void {
    this.checkedChange.emit(!this.checked());
  }
}
