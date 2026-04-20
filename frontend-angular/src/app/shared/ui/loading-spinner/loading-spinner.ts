import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';

const STATUS_WORDS = [
  'Thinking',
  'Analyzing Query',
  'Searching Knowledge Base',
  'Retrieving Sources',
  'Generating Response',
  'Crafting Reply',
] as const;

const CYCLE_MS = 2400;
const NUM_ORBS = 5;
const NUM_PARTICLES = 8;

interface ParticleStyle {
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  duration: number;
  delay: number;
}

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.css',
})
export class LoadingSpinner implements OnInit {
  private destroyRef = inject(DestroyRef);

  readonly words = STATUS_WORDS;
  readonly wordIndex = signal(0);
  readonly orbIndices = Array.from({ length: NUM_ORBS }, (_, i) => i);
  readonly particles: ParticleStyle[] = Array.from({ length: NUM_PARTICLES }, (_, i) => {
    const angle = (i / NUM_PARTICLES) * 360;
    const radius = 44 + (i % 3) * 8;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    return {
      index: i,
      x1: Math.cos(toRad(angle)) * radius,
      y1: Math.sin(toRad(angle)) * radius,
      x2: Math.cos(toRad(angle + 60)) * (radius + 10),
      y2: Math.sin(toRad(angle + 60)) * (radius + 10),
      x3: Math.cos(toRad(angle + 120)) * radius,
      y3: Math.sin(toRad(angle + 120)) * radius,
      duration: 3 + (i % 3),
      delay: i * 0.4,
    };
  });

  ngOnInit(): void {
    const id = setInterval(() => {
      this.wordIndex.update((v) => (v + 1) % STATUS_WORDS.length);
    }, CYCLE_MS);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }
}
