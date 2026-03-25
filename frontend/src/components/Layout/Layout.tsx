import React, { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher';
import { useTheme } from '../../context/ThemeContext';
import { useIntro } from '../../context/IntroContext';
import './Layout.css';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

// Spring config for sidebar slide-in
const sidebarSpring = { type: 'spring' as const, stiffness: 180, damping: 24 };

export function Layout({ sidebar, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();
  const { phase, sidebarReady, atmosphereReady, topbarReady, contentReady } = useIntro();
  const isFirstRender = useRef(true);
  const prevTheme = useRef(theme);
  const [flashKey, setFlashKey] = useState<number | null>(null);

  // Cursor-reactive glow
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { stiffness: 150, damping: 25 });
  const glowY = useSpring(mouseY, { stiffness: 150, damping: 25 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const main = e.currentTarget.querySelector('.main') as HTMLElement;
    if (!main) return;
    const rect = main.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevTheme.current = theme;
      return;
    }
    if (theme !== prevTheme.current) {
      prevTheme.current = theme;
      setFlashKey(Date.now());
    }
  }, [theme]);

  const introDone = phase === 'done';

  return (
    <div className="app-shell" onMouseMove={handleMouseMove}>
      {/* Theme sweep */}
      <AnimatePresence>
        {flashKey !== null && (
          <motion.div
            key={flashKey}
            className="theme-flash"
            initial={{ transform: 'translateX(-100%) skewX(-15deg)' }}
            animate={{ transform: 'translateX(100%) skewX(-15deg)' }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
            onAnimationComplete={() => setFlashKey(null)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}
        initial={introDone ? false : { x: -300, opacity: 0 }}
        animate={sidebarReady ? { x: 0, opacity: 1 } : { x: -300, opacity: 0 }}
        transition={sidebarSpring}
      >
        <div className="sidebar__header">
          <motion.div
            className="sidebar__brand"
            whileHover={{ x: 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <motion.div
              className="sidebar__logo"
              initial={introDone ? false : { scale: 0.3, opacity: 0 }}
              animate={sidebarReady ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: introDone ? 0 : 0.2 }}
              whileHover={{ scale: 1.08, rotate: -3 }}
            >
              <span className="sidebar__logo-mark">{'/'}{'/'}</span>
              {/* Gold glow burst — hero moment */}
              {!introDone && sidebarReady && (
                <motion.div
                  className="sidebar__logo-burst"
                  initial={{ scale: 0.3, opacity: 0.9 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              )}
            </motion.div>
            <div className="sidebar__brand-text">
              {/* Title: clipPath wipe left→right */}
              <motion.h1
                className="sidebar__title"
                initial={introDone ? false : { clipPath: 'inset(0 100% 0 0)' }}
                animate={sidebarReady ? { clipPath: 'inset(0 0% 0 0)' } : { clipPath: 'inset(0 100% 0 0)' }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: introDone ? 0 : 0.2 }}
              >
                Resolve
              </motion.h1>
              {/* Subtitle: fade + letter-spacing tighten */}
              <motion.p
                className="sidebar__subtitle"
                initial={introDone ? false : { opacity: 0, letterSpacing: '6px' }}
                animate={sidebarReady ? { opacity: 1, letterSpacing: '2px' } : { opacity: 0, letterSpacing: '6px' }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: introDone ? 0 : 0.3 }}
              >
                AI Support Console
              </motion.p>
            </div>
          </motion.div>
          {/* Accent bar: scaleX wipe */}
          <motion.div
            className="sidebar__accent-bar"
            style={{ transformOrigin: 'left' }}
            initial={introDone ? false : { scaleX: 0 }}
            animate={sidebarReady ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: introDone ? 0 : 0.35 }}
          />
        </div>

        <div className="sidebar__content">{sidebar}</div>

        {/* Footer: fade up */}
        <motion.div
          className="sidebar__footer"
          initial={introDone ? false : { opacity: 0, y: 10 }}
          animate={sidebarReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: introDone ? 0 : 0.4 }}
        >
          <div className="sidebar__status">
            <span className="sidebar__status-dot" />
            <span className="sidebar__status-label">Online</span>
          </div>
          <span className="sidebar__version">v0.1.0</span>
        </motion.div>
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="app-shell__overlay"
            onClick={() => setSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="main">
        {/* Cursor-reactive glow */}
        <motion.div
          className="main__cursor-glow"
          style={{ x: glowX, y: glowY }}
        />

        {/* Floating orbs — staggered scale+fade gated on atmosphereReady */}
        {[1, 2, 3].map((n) => (
          <motion.div
            key={n}
            className={`main__orb main__orb--${n}`}
            initial={introDone ? false : { scale: 0, opacity: 0 }}
            animate={atmosphereReady ? { scale: 1, opacity: n === 2 ? 0.8 : n === 3 ? 0.5 : 1 } : { scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, delay: introDone ? 0 : n * 0.08 }}
          />
        ))}

        {/* Ambient atmosphere — gated on atmosphereReady */}
        <motion.div
          className="main__glow"
          initial={introDone ? false : { opacity: 0 }}
          animate={atmosphereReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <motion.div
          className="main__mesh"
          initial={introDone ? false : { opacity: 0 }}
          animate={atmosphereReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: introDone ? 0 : 0.05 }}
        />
        <motion.div
          className="main__noise"
          initial={introDone ? false : { opacity: 0 }}
          animate={atmosphereReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: introDone ? 0 : 0.1 }}
        />
        <motion.div
          className="main__grid"
          initial={introDone ? false : { opacity: 0 }}
          animate={atmosphereReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: introDone ? 0 : 0.15 }}
        />

        {/* Topbar — slides down */}
        <motion.div
          className="main__topbar"
          initial={introDone ? false : { y: -20, opacity: 0 }}
          animate={topbarReady ? { y: 0, opacity: 1 } : { y: -20, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <button
            className="main__menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? '\u2715' : '\u2630'}
          </button>
          <span className="main__mobile-title">Resolve</span>
          <div className="main__topbar-right">
            <ThemeSwitcher />
          </div>
        </motion.div>

        {/* Content scroll area — opacity gated on contentReady */}
        <motion.div
          className="main__scroll"
          initial={introDone ? false : { opacity: 0 }}
          animate={contentReady ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="main__content">
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
