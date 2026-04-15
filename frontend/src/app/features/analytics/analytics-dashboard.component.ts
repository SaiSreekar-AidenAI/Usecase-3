import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

interface Tab {
  path: string;
  label: string;
}

const TABS: ReadonlyArray<Tab> = [
  { path: 'overview', label: 'Overview' },
  { path: 'audit', label: 'Audit Log' },
  { path: 'sessions', label: 'Sessions & Security' },
  { path: 'tokens', label: 'Token Usage' },
];

/**
 * Analytics dashboard shell. Renders the page header and a tab strip
 * driven by the router — each tab is a `routerLink` to a child route
 * (`/analytics/overview`, `/analytics/audit`, etc.). The active state +
 * indicator come from `routerLinkActive`, so deep-linking works for free.
 */
@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  styleUrl: './analytics-dashboard.component.css',
  template: `
    <div class="analytics">
      <div class="analytics__header">
        <div>
          <h2 class="analytics__title">Analytics</h2>
          <p class="analytics__subtitle">
            Audit trails, sessions, and usage metrics
          </p>
        </div>
      </div>

      <div class="analytics__tabs" role="tablist">
        @for (tab of tabs; track tab.path) {
          <a
            class="analytics__tab"
            routerLinkActive="analytics__tab--active"
            #rla="routerLinkActive"
            [routerLink]="['/analytics', tab.path]"
            role="tab"
          >
            {{ tab.label }}
            @if (rla.isActive) {
              <span class="analytics__tab-indicator"></span>
            }
          </a>
        }
      </div>

      <div class="analytics__content">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AnalyticsDashboardComponent {
  protected readonly tabs = TABS;
}
