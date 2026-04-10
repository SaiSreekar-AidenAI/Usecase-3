import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Blocks navigation until the auth status resolves.
 * Mirrors React's `if (status !== 'authenticated') return <LoginPage />` gating.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const status = auth.status();
  if (status === 'authenticated') return true;

  // 'loading' or 'unauthenticated' — bounce to login.
  // APP_INITIALIZER awaits restoreSession() before bootstrap, so by the time
  // a route is hit, status is never 'loading'.
  return router.createUrlTree(['/login']);
};
