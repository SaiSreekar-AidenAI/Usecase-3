import React from 'react';
import { motion } from 'framer-motion';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: number;
  format?: 'number' | 'compact';
}

function formatValue(value: number, format: 'number' | 'compact' = 'number'): string {
  if (format === 'compact') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function StatCard({ label, value, format = 'number' }: StatCardProps) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <span className="stat-card__label">{label}</span>
      <motion.span
        className="stat-card__value"
        key={value}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {formatValue(value, format)}
      </motion.span>
    </motion.div>
  );
}
