import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login-page/login-page').then(
        (m) => m.LoginPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/layout-shell/layout-shell').then(
        (m) => m.LayoutShell,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'generate' },
      {
        path: 'generate',
        loadComponent: () =>
          import('./features/generate/generate-view/generate-view').then(
            (m) => m.GenerateView,
          ),
      },
      {
        path: 'history/:id',
        loadComponent: () =>
          import(
            './features/conversation-detail/conversation-detail/conversation-detail'
          ).then((m) => m.ConversationDetail),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/user-management/user-management/user-management').then(
            (m) => m.UserManagement,
          ),
      },
      {
        path: 'analytics',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/analytics/analytics-dashboard/analytics-dashboard').then(
            (m) => m.AnalyticsDashboard,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/analytics/overview-tab/overview-tab').then(
                (m) => m.OverviewTab,
              ),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/analytics/audit-log-tab/audit-log-tab').then(
                (m) => m.AuditLogTab,
              ),
          },
          {
            path: 'sessions',
            loadComponent: () =>
              import(
                './features/analytics/sessions-security-tab/sessions-security-tab'
              ).then((m) => m.SessionsSecurityTab),
          },
          {
            path: 'tokens',
            loadComponent: () =>
              import('./features/analytics/token-usage-tab/token-usage-tab').then(
                (m) => m.TokenUsageTab,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
