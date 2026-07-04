import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import './Preloader.css';

const NAME = 'PRAJJWAL PANDEY';

// Read the OS setting directly — more reliable than framer's hook, which can
// mis-report and skip the intro for users who never asked to reduce motion.
const PREFERS_REDUCED = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Branded landing intro: a 0→100 counter while the name assembles, then the
// black curtain lifts to reveal the site. Once per session, click to skip.
export default function Preloader({ onDone }) {
  const reduce = PREFERS_REDUCED;
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    setLeaving(true);
    // Let the curtain animation play before unmounting
    setTimeout(onDone, reduce ? 200 : 900);
  }, [onDone, reduce]);

  useEffect(() => {
    if (reduce) { setCount(100); const t = setTimeout(finish, 350); return () => clearTimeout(t); }
    const duration = 2000;
    const start = performance.now();
    let raf;
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setCount(Math.round(easeOutExpo(p) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(finish, 450);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, finish]);

  return (
    <motion.div
      className="pl-root"
      onClick={finish}
      initial={{ opacity: 1 }}
      animate={leaving ? { clipPath: 'inset(0% 0% 100% 0%)' } : { clipPath: 'inset(0% 0% 0% 0%)' }}
      transition={{ duration: reduce ? 0.2 : 0.9, ease: [0.76, 0, 0.24, 1] }}
      exit={{ opacity: 0 }}
      aria-hidden="true"
    >
      <div className="pl-center">
        <div className="pl-name">
          {NAME.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="pl-letter"
              initial={{ y: reduce ? 0 : '110%', opacity: reduce ? 1 : 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.15 + i * 0.035, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </div>
        <motion.p
          className="pl-tag"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ delay: reduce ? 0 : 0.7, duration: 0.8 }}
        >
          PHOTOGRAPHER · STORYTELLER
        </motion.p>
      </div>

      <div className="pl-count">{count.toString().padStart(3, '0')}</div>
      <div className="pl-progress">
        <motion.span
          className="pl-progress-bar"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: count / 100 }}
          transition={{ ease: 'linear', duration: 0.1 }}
        />
      </div>
      <span className="pl-skip">click to skip</span>
    </motion.div>
  );
}
