import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { useIntro } from '../../context/IntroContext';
import { fetchHistory, clearAllHistory } from '../../services/api';
import './HistorySidebar.css';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    x: -12,
    height: 0,
    transition: { duration: 0.2 },
  },
};

export function HistorySidebar() {
  const { history, selectedConversationId, view } = useAppState();
  const dispatch = useAppDispatch();
  const { contentReady } = useIntro();

  useEffect(() => {
    let cancelled = false;
    fetchHistory()
      .then((data) => {
        if (!cancelled) {
          dispatch({ type: 'LOAD_HISTORY', payload: data });
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load history:', err);
      });
    return () => { cancelled = true; };
  }, [dispatch]);

  const handleClearAll = useCallback(async () => {
    try {
      await clearAllHistory();
    } catch {}
    dispatch({ type: 'CLEAR_ALL_HISTORY' });
  }, [dispatch]);

  const handleNewQuery = useCallback(() => {
    dispatch({ type: 'NEW_QUERY' });
  }, [dispatch]);

  const handleSelect = useCallback((id: string) => {
    dispatch({ type: 'SELECT_CONVERSATION', payload: id });
  }, [dispatch]);

  return (
    <div className="history-sidebar">
      {/* New Query button */}
      <motion.button
        className={`history-sidebar__new-btn ${view === 'generate' ? 'history-sidebar__new-btn--active' : ''}`}
        onClick={handleNewQuery}
        initial={{ opacity: 0, y: 8 }}
        animate={contentReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="history-sidebar__new-icon">+</span>
        <span>New Query</span>
      </motion.button>

      {/* History header */}
      {history.length > 0 && (
        <div className="history-sidebar__header">
          <span className="history-sidebar__count">History ({history.length})</span>
          <button className="history-sidebar__clear" onClick={handleClearAll}>
            Clear
          </button>
        </div>
      )}

      {/* History list */}
      {history.length === 0 ? (
        <motion.div
          className="history-sidebar__empty"
          initial={{ opacity: 0 }}
          animate={contentReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <span className="history-sidebar__empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <p>No history yet</p>
        </motion.div>
      ) : (
        <div className="history-sidebar__list">
          <AnimatePresence>
            {history.map((conv, i) => (
              <motion.button
                key={conv.id}
                className={`history-sidebar__item ${
                  selectedConversationId === conv.id ? 'history-sidebar__item--active' : ''
                }`}
                onClick={() => handleSelect(conv.id)}
                variants={itemVariants}
                initial="hidden"
                animate={contentReady ? "visible" : "hidden"}
                exit="exit"
                transition={{ delay: i * 0.03 }}
                layout
              >
                <span className="history-sidebar__item-query">{conv.query}</span>
                <div className="history-sidebar__item-meta">
                  <span className="history-sidebar__item-time">{timeAgo(conv.timestamp)}</span>
                  {conv.customPrompt && <span className="history-sidebar__item-badge">P</span>}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
