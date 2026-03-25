import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Conversation } from '../../types';
import { useAppDispatch } from '../../context/AppContext';
import { useIntro } from '../../context/IntroContext';
import { deleteHistoryItem, updateHistoryItem } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import './ConversationDetail.css';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

interface ConversationDetailProps {
  conversation: Conversation;
}

type Tab = 'response' | 'reasoning' | 'sources';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

export function ConversationDetail({ conversation }: ConversationDetailProps) {
  const dispatch = useAppDispatch();
  const { contentReady } = useIntro();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('response');
  const [editedText, setEditedText] = useState(conversation.response);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset edited text when conversation changes
  useEffect(() => {
    setEditedText(conversation.response);
  }, [conversation.id, conversation.response]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [editedText, resizeTextarea]);

  const isEdited = editedText !== conversation.response;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [editedText]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateHistoryItem(conversation.id, editedText);
      dispatch({
        type: 'UPDATE_CONVERSATION_RESPONSE',
        payload: { id: conversation.id, response: editedText },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }, [conversation.id, editedText, saving, dispatch]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteHistoryItem(conversation.id);
    } catch {}
    dispatch({ type: 'DELETE_HISTORY_ITEM', payload: conversation.id });
  }, [dispatch, conversation.id]);

  const handleNewQuery = useCallback(() => {
    dispatch({ type: 'NEW_QUERY' });
  }, [dispatch]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  const sources = conversation.sources || [];

  return (
    <motion.div
      className="conv-detail"
      variants={stagger}
      initial="hidden"
      animate={contentReady ? "visible" : "hidden"}
      onAnimationComplete={resizeTextarea}
    >
      {/* Top actions */}
      <motion.div className="conv-detail__topbar" variants={fadeUp}>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button variant="ghost" onClick={handleNewQuery}>
            &larr; New Query
          </Button>
        </motion.div>
        <span className="conv-detail__timestamp">{formatTime(conversation.timestamp)}</span>
      </motion.div>

      {/* Query bubble */}
      <motion.div variants={fadeUp}>
        <Card className="conv-detail__query-card">
          <div className="conv-detail__card-label">
            <span className="conv-detail__label-dot conv-detail__label-dot--query" />
            <span>Customer Query</span>
          </div>
          <p className="conv-detail__query-text">{conversation.query}</p>
          {conversation.customPrompt && (
            <div className="conv-detail__prompt-used">
              <span className="conv-detail__prompt-tag">Custom Prompt</span>
              <span className="conv-detail__prompt-text">{conversation.customPrompt}</span>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Connector line */}
      <motion.div
        className="conv-detail__connector"
        variants={fadeUp}
      >
        <div className="conv-detail__connector-line" />
        <span className="conv-detail__connector-label">AI Generated</span>
        <div className="conv-detail__connector-line" />
      </motion.div>

      {/* Response */}
      <motion.div variants={fadeUp}>
        <Card className="conv-detail__response-card">
          <div className="conv-detail__response-header">
            <div className="conv-detail__tabs">
              <button
                className={`conv-detail__tab ${activeTab === 'response' ? 'conv-detail__tab--active' : ''}`}
                onClick={() => setActiveTab('response')}
              >
                Response
              </button>
              <button
                className={`conv-detail__tab ${activeTab === 'reasoning' ? 'conv-detail__tab--active' : ''}`}
                onClick={() => setActiveTab('reasoning')}
              >
                Reasoning
              </button>
              <button
                className={`conv-detail__tab ${activeTab === 'sources' ? 'conv-detail__tab--active' : ''}`}
                onClick={() => setActiveTab('sources')}
              >
                Sources{sources.length > 0 && ` (${sources.length})`}
              </button>
            </div>
            <div className="conv-detail__response-actions">
              <AnimatePresence>
                {activeTab === 'response' && isEdited && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: 8 }}
                    transition={{ duration: 0.2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      variant="primary"
                      className="conv-detail__save-btn"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={saved ? 'saved' : saving ? 'saving' : 'save'}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12 }}
                        >
                          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                        </motion.span>
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button variant="success" onClick={handleCopy}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={copied ? 'done' : 'copy'}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button variant="danger" onClick={handleDelete}>
                  Delete
                </Button>
              </motion.div>
            </div>
          </div>

          {activeTab === 'response' && (
            <>
              <textarea
                ref={textareaRef}
                className="conv-detail__response-textarea"
                value={editedText}
                onChange={handleChange}
                spellCheck={false}
              />
              <p className="conv-detail__edit-hint">
                {isEdited ? 'You have unsaved edits — click Save to update' : 'Edit the response above before copying'}
              </p>
            </>
          )}

          {activeTab === 'reasoning' && (
            <div className="conv-detail__reasoning-body">
              {conversation.reasoning || 'No reasoning available for this response.'}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="conv-detail__sources-body">
              {sources.length === 0 ? (
                <p className="conv-detail__sources-empty">No sources retrieved.</p>
              ) : (
                sources.map((src, i) => (
                  <div key={i} className="conv-detail__source-card">
                    <div className="conv-detail__source-header">
                      <span className="conv-detail__source-badge">{src.category}</span>
                      <span className="conv-detail__source-score">
                        {(src.relevance_score * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p className="conv-detail__source-desc">{src.description}</p>
                    <p className="conv-detail__source-response">{src.response}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
