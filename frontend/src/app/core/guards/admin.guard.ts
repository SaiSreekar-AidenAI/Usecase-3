import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Restricts a route to admin users. Non-admins are redirected to /generate
 * (mirrors React's `if (!isAdmin) setView('generate')` fallbacks).
 */
export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['/generate']);
};
