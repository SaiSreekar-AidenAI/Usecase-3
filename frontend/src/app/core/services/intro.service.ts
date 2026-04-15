import { Injectable, computed, signal } from '@angular/core';
import { IntroPhase } from '../types';

const TIMINGS: Array<{ phase: IntroPhase; delay: number }> = [
  { phase: 'sidebar', delay: 0 },
  { phase: 'atmosphere', delay: 500 },
  { phase: 'topbar', delay: 700 },
  { phase: 'content', delay: 1000 },
  { phase: 'done', delay: 2000 },
];

@Injectable({ providedIn: 'root' })
export class IntroService {
  private _phase = signal<IntroPhase>('waiting');
  readonly phase = this._phase.asReadonly();

  readonly sidebarReady = computed(() => this.atOrAfter('sidebar'));
  readonly atmosphereReady = computed(() => this.atOrAfter('atmosphere'));
  readonly topbarReady = computed(() => this.atOrAfter('topbar'));
  readonly contentReady = computed(() => this.atOrAfter('content'));

  private timers: number[] = [];

  start(): void {
    if (typeof window === 'undefined') {
      this._phase.set('done');
      return;
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      this._phase.set('done');
      return;
    }
    this.cancelTimers();
    for (const { phase, delay } of TIMINGS) {
      this.timers.push(
        window.setTimeout(() => this._phase.set(phase), delay),
      );
    }
  }

  reset(): void {
    this.cancelTimers();
    this._phase.set('waiting');
  }

  private cancelTimers(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }

  private atOrAfter(target: IntroPhase): boolean {
    const order: IntroPhase[] = ['waiting', 'sidebar', 'atmosphere', 'topbar', 'content', 'done'];
    return order.indexOf(this._phase()) >= order.indexOf(target);
  }
}
