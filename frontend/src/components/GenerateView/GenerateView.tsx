import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../../context/AppContext';
import { useIntro } from '../../context/IntroContext';
import { Card } from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { QueryInput } from '../QueryInput/QueryInput';
import { PromptInput } from '../PromptInput/PromptInput';
import { ActionBar } from '../ActionBar/ActionBar';
import { ResponsePanel } from '../ResponsePanel/ResponsePanel';
import './GenerateView.css';

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function GenerateView() {
  const { promptModeEnabled, isLoading, response } = useAppState();
  const { contentReady } = useIntro();
  const responsePanelRef = useRef<HTMLDivElement>(null);

  const resizeResponseTextarea = useCallback(() => {
    const textarea = responsePanelRef.current?.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, []);

  return (
    <motion.div
      className="generate-view"
      variants={stagger}
      initial="hidden"
      animate={contentReady ? "visible" : "hidden"}
    >
      {/* Hero section */}
      <motion.div className="generate-view__hero" variants={fadeUp}>
        <div className="generate-view__hero-accent" />
        <h2 className="generate-view__hero-title">
          Craft The Perfect<br />
          <span className="generate-view__hero-highlight">Support Response</span>
        </h2>
        <p className="generate-view__hero-desc">
          Paste a customer query below. AI generates a tailored, human-quality response in seconds.
        </p>
      </motion.div>

      {/* Input card */}
      <motion.div variants={fadeUp}>
        <Card className="generate-view__input-card">
          <div className="generate-view__card-header">
            <span className="generate-view__card-tag">Input</span>
            <span className="generate-view__card-line" />
          </div>
          <QueryInput />
          <AnimatePresence>
            {promptModeEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const }}
                style={{ overflow: 'hidden' }}
              >
                <PromptInput />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="generate-view__actions">
            <ActionBar />
          </div>
        </Card>
      </motion.div>

      {/* Loading / Response */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loader"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4 }}
          >
            <LoadingSpinner />
          </motion.div>
        )}

        {!isLoading && response && (
          <motion.div
            key="response"
            ref={responsePanelRef}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            onAnimationComplete={resizeResponseTextarea}
          >
            <Card className="generate-view__response-card">
              <div className="generate-view__card-header">
                <span className="generate-view__card-tag generate-view__card-tag--output">Output</span>
                <span className="generate-view__card-line" />
              </div>
              <ResponsePanel />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
