import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SessionActivity, SecurityAlert, LoginAttempt } from '../../types';
import { fetchSessions, fetchSecurityAlerts, fetchLoginAttempts } from '../../services/api';
import './SessionsSecurityTab.css';

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function SessionsSecurityTab() {
  const [sessions, setSessions] = useState<SessionActivity[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [logins, setLogins] = useState<LoginAttempt[]>([]);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(() => {});
    fetchSecurityAlerts().then(setAlerts).catch(() => {});
    fetchLoginAttempts({ limit: 20 }).then((r) => setLogins(r.items)).catch(() => {});
  }, []);

  return (
    <div className="sessions-tab">
      {/* Security Alerts */}
      <section className="sessions-tab__section">
        <h3 className="sessions-tab__section-title">Security Alerts</h3>
        {alerts.length === 0 ? (
          <div className="sessions-tab__empty">No active alerts</div>
        ) : (
          <div className="sessions-tab__alerts">
            {alerts.map((a, i) => (
              <motion.div
                key={i}
                className={`sessions-tab__alert sessions-tab__alert--${a.severity}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className={`sessions-tab__severity sessions-tab__severity--${a.severity}`}>
                  {a.severity}
                </span>
                <div className="sessions-tab__alert-content">
                  <span className="sessions-tab__alert-type">{a.alert_type.replace(/_/g, ' ')}</span>
                  <span className="sessions-tab__alert-desc">{a.description}</span>
                  {a.user_email && <span className="sessions-tab__alert-user">{a.user_email}</span>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Active Sessions */}
      <section className="sessions-tab__section">
        <h3 className="sessions-tab__section-title">Sessions (Last 7 Days)</h3>
        <div className="sessions-tab__table">
          <div className="sessions-tab__header-row">
            <span>User</span>
            <span>Started</span>
            <span>Active Time</span>
            <span>Idle Time</span>
            <span>Actions</span>
            <span>Status</span>
          </div>
          {sessions.map((s) => (
            <div key={s.session_id} className="sessions-tab__row">
              <span className="sessions-tab__cell">{s.user_email || s.user_id}</span>
              <span className="sessions-tab__cell sessions-tab__cell--muted">{formatTime(s.started_at)}</span>
              <span className="sessions-tab__cell">{formatDuration(s.active_duration_ms)}</span>
              <span className="sessions-tab__cell sessions-tab__cell--muted">{formatDuration(s.idle_duration_ms)}</span>
              <span className="sessions-tab__cell">{s.actions_count}</span>
              <span className="sessions-tab__cell">
                <span className={`sessions-tab__status-dot sessions-tab__status-dot--${s.is_active ? 'active' : 'ended'}`} />
                {s.is_active ? 'Active' : 'Ended'}
              </span>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="sessions-tab__empty">No sessions recorded</div>
          )}
        </div>
      </section>

      {/* Login Geography */}
      <section className="sessions-tab__section">
        <h3 className="sessions-tab__section-title">Recent Logins</h3>
        <div className="sessions-tab__table">
          <div className="sessions-tab__header-row sessions-tab__header-row--logins">
            <span>User</span>
            <span>IP</span>
            <span>Location</span>
            <span>Browser / OS</span>
            <span>Time</span>
            <span>Status</span>
          </div>
          {logins.map((l) => (
            <div key={l.id} className="sessions-tab__row sessions-tab__row--logins">
              <span className="sessions-tab__cell">{l.user_email}</span>
              <span className="sessions-tab__cell sessions-tab__cell--mono">{l.ip_address || '—'}</span>
              <span className="sessions-tab__cell sessions-tab__cell--muted">
                {l.country && l.city ? `${l.city}, ${l.country}` : '—'}
              </span>
              <span className="sessions-tab__cell sessions-tab__cell--muted">
                {l.browser || '—'} / {l.os || '—'}
              </span>
              <span className="sessions-tab__cell sessions-tab__cell--muted">{formatTime(l.timestamp)}</span>
              <span className="sessions-tab__cell">
                <span className={`sessions-tab__login-badge sessions-tab__login-badge--${l.success ? 'success' : 'fail'}`}>
                  {l.success ? 'OK' : l.failure_reason || 'Failed'}
                </span>
              </span>
            </div>
          ))}
          {logins.length === 0 && (
            <div className="sessions-tab__empty">No login attempts recorded</div>
          )}
        </div>
      </section>
    </div>
  );
}
