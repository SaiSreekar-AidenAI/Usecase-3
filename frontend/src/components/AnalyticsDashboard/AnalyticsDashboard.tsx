import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OverviewTab } from './OverviewTab';
import { AuditLogTab } from './AuditLogTab';
import { SessionsSecurityTab } from './SessionsSecurityTab';
import { TokenUsageTab } from './TokenUsageTab';
import './AnalyticsDashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'sessions', label: 'Sessions & Security' },
  { id: 'tokens', label: 'Token Usage' },
] as const;

type TabId = typeof TABS[number]['id'];

const tabContent: Record<TabId, React.FC> = {
  overview: OverviewTab,
  audit: AuditLogTab,
  sessions: SessionsSecurityTab,
  tokens: TokenUsageTab,
};

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const ActiveComponent = tabContent[activeTab];

  return (
    <div className="analytics">
      <div className="analytics__header">
        <div>
          <h2 className="analytics__title">Analytics</h2>
          <p className="analytics__subtitle">Audit trails, sessions, and usage metrics</p>
        </div>
      </div>

      <div className="analytics__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`analytics__tab ${activeTab === tab.id ? 'analytics__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                className="analytics__tab-indicator"
                layoutId="tab-indicator"
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className="analytics__content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <ActiveComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
