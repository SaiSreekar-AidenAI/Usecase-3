import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { deviceInfoInterceptor } from './core/interceptors/device-info.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Root application config.
 *
 * APP_INITIALIZER awaits AuthService.restoreSession() before bootstrap so
 * the auth guard never observes a 'loading' state on first navigation.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([deviceInfoInterceptor])),
    provideAnimations(),
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
