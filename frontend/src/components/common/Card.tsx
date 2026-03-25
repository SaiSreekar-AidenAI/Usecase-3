import React, { ReactNode, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import './Card.css';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glowX = useMotionValue(0.5);
  const glowY = useMotionValue(0.5);
  const springX = useSpring(glowX, { stiffness: 300, damping: 30 });
  const springY = useSpring(glowY, { stiffness: 300, damping: 30 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    glowX.set((e.clientX - rect.left) / rect.width);
    glowY.set((e.clientY - rect.top) / rect.height);
  }, [glowX, glowY]);

  return (
    <motion.div
      ref={ref}
      className={`card ${className}`}
      onMouseMove={handleMouseMove}
      style={{
        '--glow-x': springX,
        '--glow-y': springY,
      } as React.CSSProperties}
    >
      <div className="card__glow" />
      {children}
    </motion.div>
  );
}
