import React from 'react';
import { motion } from 'framer-motion';
import './Toggle.css';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      type="button"
    >
      <span className={`toggle__track ${checked ? 'toggle__track--active' : ''}`}>
        <motion.span
          className="toggle__thumb"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </span>
      <span className={`toggle__label ${checked ? 'toggle__label--active' : ''}`}>{label}</span>
    </button>
  );
}
