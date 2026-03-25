import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Conversation } from '../../types';
import { useAppDispatch } from '../../context/AppContext';
import './HistoryItem.css';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m Ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h Ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d Ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w Ago`;
}

interface HistoryItemProps {
  conversation: Conversation;
}

export function HistoryItem({ conversation }: HistoryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const dispatch = useAppDispatch();

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_HISTORY_ITEM', payload: conversation.id });
  }, [dispatch, conversation.id]);

  return (
    <motion.div
      className={`history-item ${expanded ? 'history-item--expanded' : ''}`}
      layout
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Top bar with metadata */}
      <div className="history-item__topbar">
        <span className="history-item__time">{timeAgo(conversation.timestamp)}</span>
        {conversation.customPrompt && (
          <span className="history-item__prompt-badge">Custom Prompt</span>
        )}
      </div>

      {/* Query text — always visible */}
      <button
        className="history-item__body-btn"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="history-item__query">{conversation.query}</span>
        <motion.span
          className="history-item__expand-indicator"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.span>
      </button>

      {/* Expanded response panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="history-item__expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="history-item__expanded-inner">
              <div className="history-item__divider" />

              <div className="history-item__response-header">
                <span className="history-item__response-label">AI Response</span>
                <motion.button
                  className="history-item__delete-btn"
                  onClick={handleDelete}
                  aria-label="Delete Conversation"
                  title="Delete"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Delete
                </motion.button>
              </div>

              <div className="history-item__response">
                {conversation.response}
              </div>

              {conversation.customPrompt && (
                <div className="history-item__custom-prompt">
                  <span className="history-item__prompt-label">Prompt Used:</span>
                  <span>{conversation.customPrompt}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
