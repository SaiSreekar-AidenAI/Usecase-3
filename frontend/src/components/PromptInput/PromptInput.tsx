import React, { useCallback } from 'react';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import './PromptInput.css';

export function PromptInput() {
  const { customPrompt } = useAppState();
  const dispatch = useAppDispatch();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'SET_CUSTOM_PROMPT', payload: e.target.value });
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [dispatch]);

  return (
    <div className="prompt-input">
      <label className="prompt-input__label" htmlFor="prompt-textarea">
        Custom Prompt
      </label>
      <textarea
        id="prompt-textarea"
        className="prompt-input__textarea"
        placeholder="Add specific instructions for the AI..."
        value={customPrompt}
        onChange={handleChange}
        rows={2}
        spellCheck={false}
      />
    </div>
  );
}
