import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  inject,
  input,
} from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  private host: ElementRef<HTMLElement> = inject(ElementRef);

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
