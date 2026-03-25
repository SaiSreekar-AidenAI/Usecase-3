import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { updateHistoryItem } from '../../services/api';
import { Button } from '../common/Button';
import './ResponsePanel.css';

type Tab = 'response' | 'reasoning' | 'sources';

export function ResponsePanel() {
  const { editedResponse, response, reasoning, sources, selectedConversationId } = useAppState();
  const dispatch = useAppDispatch();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('response');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEdited = editedResponse !== response;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'SET_EDITED_RESPONSE', payload: e.target.value });
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [dispatch]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      textareaRef.current?.select();
    }
  }, [editedResponse]);

  const handleSave = useCallback(async () => {
    if (!selectedConversationId || saving) return;
    setSaving(true);
    try {
      await updateHistoryItem(selectedConversationId, editedResponse);
      dispatch({
        type: 'UPDATE_CONVERSATION_RESPONSE',
        payload: { id: selectedConversationId, response: editedResponse },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }, [selectedConversationId, editedResponse, saving, dispatch]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [editedResponse]);

  return (
    <div className="response-panel">
      <div className="response-panel__header">
        <div className="response-panel__tabs">
          <button
            className={`response-panel__tab ${activeTab === 'response' ? 'response-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('response')}
          >
            Response
          </button>
          <button
            className={`response-panel__tab ${activeTab === 'reasoning' ? 'response-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('reasoning')}
          >
            Reasoning
          </button>
          <button
            className={`response-panel__tab ${activeTab === 'sources' ? 'response-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            Sources{sources.length > 0 && ` (${sources.length})`}
          </button>
        </div>
        {activeTab === 'response' && (
          <div className="response-panel__actions">
            <AnimatePresence>
              {isEdited && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 8 }}
                  transition={{ duration: 0.2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="primary"
                    className="response-panel__save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={saved ? 'saved' : saving ? 'saving' : 'save'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                      >
                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant="success"
                className="response-panel__copy-btn"
                onClick={handleCopy}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={copied ? 'copied' : 'copy'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      {activeTab === 'response' && (
        <>
          <textarea
            ref={textareaRef}
            className="response-panel__textarea"
            value={editedResponse}
            onChange={handleChange}
            spellCheck={false}
          />
          <p className="response-panel__hint">
            {isEdited ? 'You have unsaved edits — click Save to update' : 'Edit the response above before copying'}
          </p>
        </>
      )}

      {activeTab === 'reasoning' && (
        <div className="response-panel__reasoning">
          {reasoning ? reasoning : 'No reasoning available for this response.'}
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="response-panel__sources">
          {sources.length === 0 ? (
            <p className="response-panel__sources-empty">No sources retrieved.</p>
          ) : (
            sources.map((src, i) => (
              <div key={i} className="response-panel__source-card">
                <div className="response-panel__source-header">
                  <span className="response-panel__source-badge">{src.category}</span>
                  <span className="response-panel__source-score">
                    {(src.relevance_score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="response-panel__source-desc">{src.description}</p>
                <p className="response-panel__source-response">{src.response}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
