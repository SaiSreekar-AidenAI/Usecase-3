import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { TokenUsagePoint, TokenByUser } from '../../types';
import { fetchTokenUsage, fetchTokenByUser } from '../../services/api';
import { useChartTheme } from './chartTheme';
import { StatCard } from './components/StatCard';
import './TokenUsageTab.css';

export function TokenUsageTab() {
  const [usage, setUsage] = useState<TokenUsagePoint[]>([]);
  const [byUser, setByUser] = useState<TokenByUser[]>([]);
  const chart = useChartTheme();

  useEffect(() => {
    fetchTokenUsage({}).then(setUsage).catch(() => {});
    fetchTokenByUser().then(setByUser).catch(() => {});
  }, []);

  const totalPrompt = usage.reduce((s, u) => s + u.prompt_tokens, 0);
  const totalCompletion = usage.reduce((s, u) => s + u.completion_tokens, 0);
  const totalRequests = usage.reduce((s, u) => s + u.request_count, 0);
  const totalTokens = usage.reduce((s, u) => s + u.total_tokens, 0);

  const pieData = [
    { name: 'Prompt', value: totalPrompt },
    { name: 'Completion', value: totalCompletion },
  ].filter((d) => d.value > 0);

  const pieColors = [chart.colors.primary, chart.colors.secondary];

  return (
    <div className="token-tab">
      <div className="token-tab__cards">
        <StatCard label="Total Tokens" value={totalTokens} format="compact" />
        <StatCard label="Total Requests" value={totalRequests} />
        <StatCard label="Avg Tokens / Request" value={totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0} />
      </div>

      <div className="token-tab__charts-row">
        {/* Token trend */}
        <div className="token-tab__chart-card token-tab__chart-card--wide">
          <h3 className="token-tab__chart-title">Token Usage Over Time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={usage} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.colors.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: chart.colors.textLight, fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
                stroke={chart.colors.grid}
              />
              <YAxis yAxisId="tokens" tick={{ fill: chart.colors.textLight, fontSize: 11 }} stroke={chart.colors.grid} />
              <YAxis yAxisId="requests" orientation="right" tick={{ fill: chart.colors.textLight, fontSize: 11 }} stroke={chart.colors.grid} />
              <Tooltip
                contentStyle={{
                  background: chart.colors.tooltip,
                  border: `1px solid ${chart.colors.tooltipBorder}`,
                  borderRadius: 8, fontSize: 13, color: chart.colors.text,
                }}
              />
              <Bar yAxisId="requests" dataKey="request_count" name="Requests" fill={chart.colors.secondary} opacity={0.6} radius={[3, 3, 0, 0]} />
              <Line yAxisId="tokens" type="monotone" dataKey="total_tokens" name="Tokens" stroke={chart.colors.primary} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Token breakdown pie */}
        <div className="token-tab__chart-card token-tab__chart-card--narrow">
          <h3 className="token-tab__chart-title">Token Breakdown</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={(props: PieLabelRenderProps) => `${props.name ?? ''} ${((Number(props.percent ?? 0)) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: chart.colors.tooltip,
                    border: `1px solid ${chart.colors.tooltipBorder}`,
                    borderRadius: 8, fontSize: 13, color: chart.colors.text,
                  }}
                  formatter={(value: unknown) => String(Number(value ?? 0).toLocaleString())}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="token-tab__empty">No data yet</div>
          )}
        </div>
      </div>

      {/* Top users table */}
      <div className="token-tab__section">
        <h3 className="token-tab__chart-title">Top Users by Token Usage</h3>
        <div className="token-tab__table">
          <div className="token-tab__header-row">
            <span>User</span>
            <span>Total Tokens</span>
            <span>Requests</span>
            <span>Avg / Request</span>
          </div>
          {byUser.map((u) => {
            const maxTokens = byUser[0]?.total_tokens || 1;
            const pct = Math.round((u.total_tokens / maxTokens) * 100);
            return (
              <div key={u.user_id} className="token-tab__row">
                <span className="token-tab__cell">{u.user_email || u.user_id}</span>
                <span className="token-tab__cell">
                  <span className="token-tab__bar-wrapper">
                    <span className="token-tab__bar" style={{ width: `${pct}%` }} />
                    <span className="token-tab__bar-label">{u.total_tokens.toLocaleString()}</span>
                  </span>
                </span>
                <span className="token-tab__cell">{u.request_count}</span>
                <span className="token-tab__cell">{Math.round(u.avg_tokens_per_request).toLocaleString()}</span>
              </div>
            );
          })}
          {byUser.length === 0 && (
            <div className="token-tab__empty">No usage data</div>
          )}
        </div>
      </div>
    </div>
  );
}
