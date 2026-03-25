import React, { useCallback, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import './QueryInput.css';

export function QueryInput() {
  const { query } = useAppState();
  const dispatch = useAppDispatch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'SET_QUERY', payload: e.target.value });
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [dispatch]);

  return (
    <div className="query-input">
      <label className="query-input__label" htmlFor="query-textarea">
        Customer Query
      </label>
      <textarea
        ref={textareaRef}
        id="query-textarea"
        className="query-input__textarea"
        placeholder="Paste the customer's query here..."
        value={query}
        onChange={handleChange}
        rows={4}
        spellCheck={false}
      />
    </div>
  );
}
