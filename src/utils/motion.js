// The site's motion vocabulary for framer-motion, mirroring the CSS custom
// properties in index.css so JS and CSS animations share one feel.
//
//   EASE.out    → cubic-bezier(0.16, 1, 0.3, 1)   entrances, reveals, hovers
//   EASE.inOut  → cubic-bezier(0.64, 0, 0.13, 1)  symmetric moves, page shutter
//   EASE.spring → cubic-bezier(0.34, 1.56, 0.64, 1) playful overshoot, sparing
//
// Reach for these instead of hand-typing a bezier array, so a new page can't
// quietly introduce a tenth easing curve.
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.64, 0, 0.13, 1],
  spring: [0.34, 1.56, 0.64, 1],
};

export const DUR = {
  fast: 0.25,
  base: 0.45,
  slow: 0.7,
  slower: 1.1,
};

// Common reveal variants, ready to spread onto a motion element.
export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.slow, ease: EASE.out },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DUR.base, ease: EASE.out },
};

// Parent + child pair for staggered lists.
export const staggerParent = {
  animate: { transition: { staggerChildren: 0.08 } },
};

export const staggerChild = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE.out } },
};
