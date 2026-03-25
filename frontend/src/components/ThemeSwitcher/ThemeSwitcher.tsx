import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import './ThemeSwitcher.css';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'obsidian';
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      className="theme-switch"
      onClick={toggleTheme}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      whileTap={{ scale: 0.97 }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          className="theme-switch__glyph"
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {isDark ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
      <div className="theme-switch__track">
        <motion.div
          className="theme-switch__indicator"
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{ marginLeft: isDark ? 0 : 'auto' }}
        />
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.span
            key={theme}
            className="theme-switch__label"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {isDark ? 'Obsidian' : 'Paper'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
