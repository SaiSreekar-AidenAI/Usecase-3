import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { generateResponse } from '../../services/api';
import { Button } from '../common/Button';
import { Toggle } from '../common/Toggle';
import './ActionBar.css';

export function ActionBar() {
  const { query, response, isLoading, promptModeEnabled, customPrompt } = useAppState();
  const dispatch = useAppDispatch();

  const handleGenerate = useCallback(async () => {
    if (!query.trim() || isLoading) return;
    dispatch({ type: 'GENERATE_START' });
    try {
      const result = await generateResponse(
        query,
        promptModeEnabled ? customPrompt : undefined
      );
      dispatch({ type: 'GENERATE_SUCCESS', payload: result });
    } catch {
      dispatch({ type: 'CLEAR_RESPONSE' });
    }
  }, [query, isLoading, promptModeEnabled, customPrompt, dispatch]);

  const handleToggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_PROMPT_MODE' });
  }, [dispatch]);

  const hasResponse = response.length > 0;

  return (
    <div className="action-bar">
      <div className="action-bar__left">
        {!hasResponse ? (
          <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!query.trim() || isLoading}
            >
              Generate Response
            </Button>
          </motion.div>
        ) : (
          <>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                variant="danger"
                onClick={handleGenerate}
                disabled={!query.trim() || isLoading}
              >
                Regenerate
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: 'CLEAR_RESPONSE' })}
              >
                Clear
              </Button>
            </motion.div>
          </>
        )}
      </div>
      <div className="action-bar__right">
        <Toggle
          checked={promptModeEnabled}
          onChange={handleToggle}
          label="Prompt Mode"
        />
      </div>
    </div>
  );
}
