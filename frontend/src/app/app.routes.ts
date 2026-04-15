import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

/**
 * Route table — replaces React's view-enum + selectedConversationId state.
 *
 * /login is unguarded and rendered without the sidebar shell.
 * Everything else lives under the LayoutShell parent so the sidebar +
 * topbar render exactly once and only the main content swaps via the
 * inner <router-outlet>.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/layout-shell.component').then(
        (m) => m.LayoutShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'generate' },
      {
        path: 'generate',
        loadComponent: () =>
          import('./features/generate/generate-view.component').then(
            (m) => m.GenerateViewComponent,
          ),
      },
      {
        path: 'history/:id',
        loadComponent: () =>
          import(
            './features/conversation-detail/conversation-detail.component'
          ).then((m) => m.ConversationDetailComponent),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/user-management/user-management.component').then(
            (m) => m.UserManagementComponent,
          ),
      },
      {
        path: 'analytics',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/analytics/analytics-dashboard.component').then(
            (m) => m.AnalyticsDashboardComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/analytics/overview-tab.component').then(
                (m) => m.OverviewTabComponent,
              ),
          },
          {
            path: 'audit',
            loadComponent: () =>
              import('./features/analytics/audit-log-tab.component').then(
                (m) => m.AuditLogTabComponent,
              ),
          },
          {
            path: 'sessions',
            loadComponent: () =>
              import(
                './features/analytics/sessions-security-tab.component'
              ).then((m) => m.SessionsSecurityTabComponent),
          },
          {
            path: 'tokens',
            loadComponent: () =>
              import('./features/analytics/token-usage-tab.component').then(
                (m) => m.TokenUsageTabComponent,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
