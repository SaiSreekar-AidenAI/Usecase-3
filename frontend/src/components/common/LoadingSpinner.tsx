import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingSpinner.css';

const STATUS_WORDS = [
  'Thinking',
  'Analyzing Query',
  'Searching Knowledge Base',
  'Retrieving Sources',
  'Generating Response',
  'Crafting Reply',
];

const CYCLE_MS = 2400;

const NUM_ORBS = 5;
const orbs = Array.from({ length: NUM_ORBS }, (_, i) => i);
const NUM_PARTICLES = 8;
const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => i);

export function LoadingSpinner() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % STATUS_WORDS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="loader" role="status" aria-label="Generating response">
      {/* Ambient glow behind everything */}
      <div className="loader__ambient" />

      {/* Orbital ring system */}
      <div className="loader__orb-system">
        {/* Outer ring */}
        <motion.div
          className="loader__ring loader__ring--outer"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
        />

        {/* Inner ring — counter-rotate */}
        <motion.div
          className="loader__ring loader__ring--inner"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, ease: 'linear', repeat: Infinity }}
        />

        {/* Floating orbs on the outer ring */}
        {orbs.map((i) => (
          <motion.div
            key={i}
            className="loader__orb-wrapper"
            animate={{ rotate: 360 }}
            transition={{
              duration: 4 + i * 0.8,
              ease: 'linear',
              repeat: Infinity,
              delay: i * 0.3,
            }}
          >
            <motion.div
              className="loader__orb"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2 + i * 0.4,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: i * 0.2,
              }}
              style={{
                width: 4 + (i % 3) * 2,
                height: 4 + (i % 3) * 2,
              }}
            />
          </motion.div>
        ))}

        {/* Center pulse */}
        <motion.div
          className="loader__center"
          animate={{
            scale: [1, 1.2, 1],
            boxShadow: [
              '0 0 20px var(--color-accent-glow), 0 0 40px var(--color-accent-subtle)',
              '0 0 30px var(--color-accent-intense), 0 0 60px var(--color-accent-glow)',
              '0 0 20px var(--color-accent-glow), 0 0 40px var(--color-accent-subtle)',
            ],
          }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Sparkle particles */}
        {particles.map((i) => {
          const angle = (i / NUM_PARTICLES) * 360;
          const radius = 44 + (i % 3) * 8;
          return (
            <motion.div
              key={`p-${i}`}
              className="loader__particle"
              style={{
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [
                  Math.cos((angle * Math.PI) / 180) * radius,
                  Math.cos(((angle + 60) * Math.PI) / 180) * (radius + 10),
                  Math.cos(((angle + 120) * Math.PI) / 180) * radius,
                ],
                y: [
                  Math.sin((angle * Math.PI) / 180) * radius,
                  Math.sin(((angle + 60) * Math.PI) / 180) * (radius + 10),
                  Math.sin(((angle + 120) * Math.PI) / 180) * radius,
                ],
                opacity: [0, 0.8, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3 + (i % 3),
                ease: 'easeInOut',
                repeat: Infinity,
                delay: i * 0.4,
              }}
            />
          );
        })}
      </div>

      {/* Status text with word cycling */}
      <div className="loader__status">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIndex}
            className="loader__word"
            initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {STATUS_WORDS[wordIndex]}
          </motion.span>
        </AnimatePresence>

        {/* Animated dots */}
        <span className="loader__dots">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="loader__dot-char"
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 1.2,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              .
            </motion.span>
          ))}
        </span>
      </div>

      {/* Shimmer progress bar */}
      <div className="loader__progress">
        <motion.div
          className="loader__progress-fill"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            ease: [0.25, 0.46, 0.45, 0.94],
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
        />
      </div>
    </div>
  );
}
