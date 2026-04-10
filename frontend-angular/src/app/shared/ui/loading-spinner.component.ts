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
  styleUrl: './loading-spinner.component.css',
  template: `
    <div class="loader" role="status" aria-label="Generating response">
      <div class="loader__ambient"></div>

      <div class="loader__orb-system">
        <div class="loader__ring loader__ring--outer"></div>
        <div class="loader__ring loader__ring--inner"></div>

        @for (i of orbIndices; track i) {
          <div
            class="loader__orb-wrapper"
            [style.animation-duration.s]="4 + i * 0.8"
            [style.animation-delay.s]="i * 0.3"
          >
            <div
              class="loader__orb"
              [style.width.px]="4 + (i % 3) * 2"
              [style.height.px]="4 + (i % 3) * 2"
              [style.animation-duration.s]="2 + i * 0.4"
              [style.animation-delay.s]="i * 0.2"
            ></div>
          </div>
        }

        <div class="loader__center"></div>

        @for (p of particles; track p.index) {
          <div
            class="loader__particle"
            [style.--p-x1.px]="p.x1"
            [style.--p-y1.px]="p.y1"
            [style.--p-x2.px]="p.x2"
            [style.--p-y2.px]="p.y2"
            [style.--p-x3.px]="p.x3"
            [style.--p-y3.px]="p.y3"
            [style.animation-duration.s]="p.duration"
            [style.animation-delay.s]="p.delay"
          ></div>
        }
      </div>

      <div class="loader__status">
        <span class="loader__word" [attr.data-key]="wordIndex()">
          {{ words[wordIndex()] }}
        </span>
        <span class="loader__dots">
          <span class="loader__dot-char loader__dot-char--1">.</span>
          <span class="loader__dot-char loader__dot-char--2">.</span>
          <span class="loader__dot-char loader__dot-char--3">.</span>
        </span>
      </div>

      <div class="loader__progress">
        <div class="loader__progress-fill"></div>
      </div>
    </div>
  `,
})
export class LoadingSpinnerComponent implements OnInit {
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
