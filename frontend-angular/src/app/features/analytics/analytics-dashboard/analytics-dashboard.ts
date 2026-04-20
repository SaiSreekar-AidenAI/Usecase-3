import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

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
@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.css',
})
export class AnalyticsDashboard {
protected readonly tabs = TABS;
}
