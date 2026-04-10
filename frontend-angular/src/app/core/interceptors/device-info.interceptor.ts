import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Adds the same X-Device-Info header that the React app sends and forces
 * `withCredentials: true` so cookie-based auth works.
 */
export const deviceInfoInterceptor: HttpInterceptorFn = (req, next) => {
  let deviceInfo = '';
  try {
    deviceInfo = JSON.stringify({
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
    });
  } catch {
    /* ignore */
  }

  const cloned = req.clone({
    setHeaders: deviceInfo ? { 'X-Device-Info': deviceInfo } : {},
    withCredentials: true,
  });

  return next(cloned);
};
