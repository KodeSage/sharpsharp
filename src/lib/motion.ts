import type { Transition, Variants } from 'motion/react';

export const easeOutExpo: number[] = [0.2, 0.9, 0.1, 1];

export const spring: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 32,
};

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const itemDropVariants: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: prefersReducedMotion()
      ? { duration: 0 }
      : { ...spring, delay: i * 0.06 },
  }),
};
