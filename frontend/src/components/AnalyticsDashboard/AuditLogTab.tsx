import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuditEvent } from '../../types';
import { fetchAuditLog } from '../../services/api';
import './AuditLogTab.css';

const EVENT_TYPES = [
  '', 'login', 'logout', 'generate', 'history_view', 'history_edit',
  'history_delete', 'history_clear', 'user_create', 'user_update',
  'user_delete', 'auth_failure', 'unauthorized_access',
];

const EVENT_COLORS: Record<string, string> = {
  login: 'success', logout: 'warning', generate: 'accent',
  auth_failure: 'danger', unauthorized_access: 'danger',
  history_delete: 'danger', history_clear: 'danger',
  user_delete: 'danger', user_create: 'success',
  user_update: 'accent',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function AuditLogTab() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 25;

  const load = useCallback(() => {
    fetchAuditLog({ page, limit, event_type: filter || undefined })
      .then((res) => { setEvents(res.items); setTotal(res.total); })
      .catch(() => {});
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="audit-log">
      <div className="audit-log__toolbar">
        <select
          className="audit-log__filter"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Events</option>
          {EVENT_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <span className="audit-log__count">{total} events</span>
      </div>

      <div className="audit-log__table">
        <div className="audit-log__header-row">
          <span className="audit-log__col audit-log__col--time">Time</span>
          <span className="audit-log__col audit-log__col--event">Event</span>
          <span className="audit-log__col audit-log__col--user">User</span>
          <span className="audit-log__col audit-log__col--ip">IP</span>
          <span className="audit-log__col audit-log__col--resource">Resource</span>
        </div>

        <AnimatePresence mode="popLayout">
          {events.map((ev) => (
            <motion.div
              key={ev.id}
              className="audit-log__row-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              layout
            >
              <div
                className={`audit-log__row ${expandedId === ev.id ? 'audit-log__row--expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <span className="audit-log__col audit-log__col--time">{formatTime(ev.timestamp)}</span>
                <span className="audit-log__col audit-log__col--event">
                  <span className={`audit-log__badge audit-log__badge--${EVENT_COLORS[ev.event_type] || 'default'}`}>
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="audit-log__col audit-log__col--user">{ev.user_email || '—'}</span>
                <span className="audit-log__col audit-log__col--ip">{ev.ip_address || '—'}</span>
                <span className="audit-log__col audit-log__col--resource">
                  {ev.resource_type ? `${ev.resource_type}` : '—'}
                </span>
              </div>
              {expandedId === ev.id && ev.metadata_json && (
                <motion.div
                  className="audit-log__details"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <pre className="audit-log__json">{JSON.stringify(JSON.parse(ev.metadata_json), null, 2)}</pre>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="audit-log__empty">No events found</div>
        )}
      </div>

      <div className="audit-log__pagination">
        <button
          className="audit-log__page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <span className="audit-log__page-info">{page} / {totalPages}</span>
        <button
          className="audit-log__page-btn"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
