import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { fetchHistory } from '../../services/api';
import { HistoryItem } from '../HistoryItem/HistoryItem';
import './HistoryView.css';

const listVariants = {
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    x: -16,
    height: 0,
    marginBottom: 0,
    transition: { duration: 0.25 },
  },
};

export function HistoryView() {
  const { history } = useAppState();
  const dispatch = useAppDispatch();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    fetchHistory().then((data) => {
      if (!cancelled) {
        dispatch({ type: 'LOAD_HISTORY', payload: data });
      }
    });
    return () => { cancelled = true; };
  }, [dispatch]);

  const handleClearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_HISTORY' });
  }, [dispatch]);

  if (history.length === 0) {
    return (
      <motion.div
        className="history-view__empty"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="history-view__empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="history-view__empty-text">No Conversations Yet</p>
        <p className="history-view__empty-hint">Generated responses will appear here</p>
      </motion.div>
    );
  }

  return (
    <div className="history-view">
      <div className="history-view__top">
        <span className="history-view__count">{history.length} Entries</span>
        <motion.button
          className="history-view__clear-btn"
          onClick={handleClearAll}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Clear All
        </motion.button>
      </div>
      <motion.div
        className="history-view__list"
        variants={listVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {history.map((conv) => (
            <motion.div
              key={conv.id}
              variants={itemVariants}
              exit="exit"
              layout
            >
              <HistoryItem conversation={conv} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
