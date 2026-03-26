import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { OverviewStats, DailyActivityPoint } from '../../types';
import { fetchOverviewStats, fetchDailyActivity } from '../../services/api';
import { useChartTheme } from './chartTheme';
import { StatCard } from './components/StatCard';
import './OverviewTab.css';

export function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [daily, setDaily] = useState<DailyActivityPoint[]>([]);
  const chart = useChartTheme();

  useEffect(() => {
    fetchOverviewStats().then(setStats).catch(() => {});
    fetchDailyActivity(30).then(setDaily).catch(() => {});
  }, []);

  return (
    <div className="overview-tab">
      <div className="overview-tab__cards">
        <StatCard label="Active Users (24h)" value={stats?.active_users_24h ?? 0} />
        <StatCard label="Active Sessions" value={stats?.active_sessions ?? 0} />
        <StatCard label="Queries Today" value={stats?.queries_today ?? 0} />
        <StatCard label="Tokens Today" value={stats?.tokens_today ?? 0} format="compact" />
      </div>

      <div className="overview-tab__chart-card">
        <h3 className="overview-tab__chart-title">Activity (Last 30 Days)</h3>
        <div className="overview-tab__chart">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLogins" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chart.colors.secondary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chart.colors.secondary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradQueries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chart.colors.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chart.colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.colors.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: chart.colors.textLight, fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
                stroke={chart.colors.grid}
              />
              <YAxis tick={{ fill: chart.colors.textLight, fontSize: 11 }} stroke={chart.colors.grid} />
              <Tooltip
                contentStyle={{
                  background: chart.colors.tooltip,
                  border: `1px solid ${chart.colors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: chart.colors.text,
                }}
              />
              <Area
                type="monotone" dataKey="logins" name="Logins"
                stroke={chart.colors.secondary} fill="url(#gradLogins)" strokeWidth={2}
              />
              <Area
                type="monotone" dataKey="queries" name="Queries"
                stroke={chart.colors.primary} fill="url(#gradQueries)" strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overview-tab__stats-row">
        <StatCard label="Total Users" value={stats?.total_users ?? 0} />
        <StatCard label="Total Queries" value={stats?.total_queries ?? 0} format="compact" />
        <StatCard label="Total Tokens" value={stats?.total_tokens ?? 0} format="compact" />
      </div>
    </div>
  );
}
