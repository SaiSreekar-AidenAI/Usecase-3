import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { IntroService } from './core/services/intro.service';
import { HeartbeatService } from './core/services/heartbeat.service';
import { PageTransitionComponent } from './shared/page-transition/page-transition.component';

/**
 * Root shell.
 *
 * - ThemeService is injected so it constructs early (constructor reads
 *   localStorage and applies the data-theme attribute).
 * - When auth flips to 'authenticated', start the intro animation timeline
 *   and the heartbeat tracker. When it flips to 'unauthenticated', tear them
 *   down. This mirrors React's <AuthGate>/useHeartbeat behaviour.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PageTransitionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-page-transition />
  `,
})
export class AppComponent {
  private auth = inject(AuthService);
  private intro = inject(IntroService);
  private heartbeat = inject(HeartbeatService);
  // Eagerly construct ThemeService so the theme attribute is set on <html>
  // before the first render — avoids a flash of the default theme.
  private theme = inject(ThemeService);

  constructor() {
    effect(() => {
      const status = this.auth.status();
      if (status === 'authenticated') {
        this.intro.start();
        this.heartbeat.startTracking();
      } else {
        this.intro.reset();
        this.heartbeat.stopTracking();
      }
    });
  }
}
