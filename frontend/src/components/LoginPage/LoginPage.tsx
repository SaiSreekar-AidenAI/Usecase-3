import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher';
import { Button } from '../common/Button';
import './LoginPage.css';

type LoginStep = 'email' | 'password' | 'logging-in';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const slideTransition = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const };

const FEATURES = [
  { icon: '\u26A1', title: 'AI-Powered Responses', desc: 'Instant, context-aware support answers' },
  { icon: '\uD83D\uDD12', title: 'Secure & Audited', desc: 'Full session tracking and activity logs' },
  { icon: '\uD83D\uDCCA', title: 'Real-Time Analytics', desc: 'Usage metrics and performance insights' },
];

export function LoginPage() {
  const { checkEmail, login } = useAuth();

  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      const result = await checkEmail(email.trim());
      setUserName(result.user_name);

      if (result.requires_password) {
        setDirection(1);
        setStep('password');
      } else {
        setStep('logging-in');
        await login(email.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      setStep('logging-in');
      await login(email.trim(), password);
    } catch (err: any) {
      setStep('password');
      setError(err.message || 'Invalid credentials');
    }
  };

  const goBack = () => {
    setDirection(-1);
    setPassword('');
    setError(null);
    setStep('email');
  };

  return (
    <div className="login-page">
      {/* ═══ LEFT — Hero Panel ═══ */}
      <motion.div
        className="login-page__hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Atmospheric layers */}
        <div className="login-page__hero-bg" />
        <div className="login-page__hero-orb login-page__hero-orb--1" />
        <div className="login-page__hero-orb login-page__hero-orb--2" />
        <div className="login-page__hero-orb login-page__hero-orb--3" />
        <div className="login-page__hero-grid" />
        <div className="login-page__hero-noise" />
        {/* Accent edge glow */}
        <div className="login-page__hero-edge" />

        <div className="login-page__hero-content">
          {/* Brand */}
          <motion.div
            className="login-page__hero-brand"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              className="login-page__hero-logo"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.3 }}
            >
              <span className="login-page__hero-logo-mark">{'/'}{'/'}</span>
              {/* Burst glow on load */}
              <motion.div
                className="login-page__hero-logo-burst"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
              />
            </motion.div>

            <motion.h1
              className="login-page__hero-title"
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
            >
              Email Composer
            </motion.h1>
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="login-page__hero-tagline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            AI-Powered Support Console
          </motion.p>

          {/* Divider */}
          <motion.div
            className="login-page__hero-divider"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.65 }}
          />

          {/* Feature pills */}
          <div className="login-page__hero-features">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="login-page__hero-feature"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.75 + i * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span className="login-page__hero-feature-icon">{feat.icon}</span>
                <div>
                  <span className="login-page__hero-feature-title">{feat.title}</span>
                  <span className="login-page__hero-feature-desc">{feat.desc}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer inside hero */}
          <motion.div
            className="login-page__hero-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.1 }}
          >
            <div className="login-page__hero-status">
              <span className="login-page__hero-status-dot" />
              <span>System Online</span>
            </div>
            <span className="login-page__hero-version">v0.1.0</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══ RIGHT — Login Panel ═══ */}
      <div className="login-page__right">
        {/* Subtle atmosphere on right side */}
        <div className="login-page__right-glow" />
        <div className="login-page__right-noise" />

        <motion.div
          className="login-page__card"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        >
          {/* Mini brand for mobile (hidden on desktop) */}
          <div className="login-page__card-brand-mobile">
            <div className="login-page__card-logo-sm">
              <span className="login-page__card-logo-sm-mark">{'/'}{'/'}</span>
            </div>
            <span className="login-page__card-brand-name">Email Composer</span>
          </div>

          <div className="login-page__card-header">
            <h2 className="login-page__card-title">Welcome back</h2>
            <p className="login-page__card-subtitle">Sign in to your console</p>
          </div>

          <div className="login-page__accent-bar" />

          {/* Step content */}
          <AnimatePresence mode="wait" custom={direction}>
            {step === 'email' && (
              <motion.form
                key="email"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="login-page__form"
                onSubmit={handleEmailSubmit}
              >
                <div className="login-page__input-group">
                  <label className="login-page__label" htmlFor="login-email">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    className="login-page__input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="login-page__error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button type="submit" variant="primary">
                  Continue
                </Button>
              </motion.form>
            )}

            {step === 'password' && (
              <motion.form
                key="password"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={slideTransition}
                className="login-page__form"
                onSubmit={handlePasswordSubmit}
              >
                <p className="login-page__welcome">
                  Welcome back, <span className="login-page__welcome-name">{userName}</span>
                </p>

                <div className="login-page__input-group">
                  <label className="login-page__label" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    className="login-page__input"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="login-page__error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button type="submit" variant="primary">
                  Sign In
                </Button>

                <button type="button" className="login-page__back" onClick={goBack}>
                  &larr; Back to email
                </button>
              </motion.form>
            )}

            {step === 'logging-in' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="login-page__loading-wrap"
              >
                <p className="login-page__heading">Signing in...</p>
                <div className="login-page__loading">
                  <div className="login-page__loading-dot" />
                  <div className="login-page__loading-dot" />
                  <div className="login-page__loading-dot" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Theme switcher pinned bottom-right */}
        <motion.div
          className="login-page__footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          <ThemeSwitcher />
        </motion.div>
      </div>
    </div>
  );
}
