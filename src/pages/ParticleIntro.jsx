import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

export default function GlassShatterIntro({ onDone, onSkip }) {
  const overlayRef = useRef(null);
  const timers     = useRef([]);
  const [phase, setPhase] = useState('in');

  const fadeOverlay = useCallback(() => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    el.style.opacity    = '0';
    timers.current.push(setTimeout(() => onDone?.(), 280));
  }, [onDone]);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    const el = overlayRef.current;
    if (el) { el.style.transition = 'opacity 0.3s ease-out'; el.style.opacity = '0'; }
    setTimeout(() => { onSkip?.(); onDone?.(); }, 330);
  }, [onDone, onSkip]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 2200);
    const t2 = setTimeout(() => fadeOverlay(),   2700);
    timers.current.push(t1, t2);
    return () => timers.current.forEach(clearTimeout);
  }, [fadeOverlay]);

  const fadeOut = { duration: 0.35, ease: [0.4, 0, 1, 1] };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: '#000', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
      onClick={skip}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') skip(); }}
      role="button" tabIndex={0} aria-label="Skip intro"
    >
      {/* ── Top label ─────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0, y: -8 }}
        animate={phase === 'in' ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={phase === 'in'
          ? { duration: 0.5, delay: 0.05, ease: 'easeOut' }
          : fadeOut}
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
          fontSize: 'clamp(0.65rem, 1vw, 0.8rem)',
          color: 'rgba(160,210,255,0.45)',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          marginBottom: '1.6rem',
        }}
      >
        Prajjwal Pandey &mdash; Storyteller
      </motion.p>

      {/* ── IN MOTION — big chrome gradient title ─────────────────────── */}
      <div style={{ overflow: 'hidden' }}>
        <motion.h1
          initial={{ y: '105%' }}
          animate={phase === 'in' ? { y: 0 } : { y: '-105%', filter: 'blur(8px)' }}
          transition={phase === 'in'
            ? { duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }
            : { duration: 0.4, ease: [0.4, 0, 1, 1] }}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(3.5rem, 10vw, 8rem)',
            background: 'linear-gradient(160deg, #fff 5%, #c8e6ff 40%, #fff 55%, #8ec5fc 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
            filter: 'drop-shadow(0 0 20px rgba(140,200,255,0.5))',
          }}
        >
          In Motion
        </motion.h1>
      </div>

      {/* ── Thin divider ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={phase === 'in' ? { scaleX: 1, opacity: 0.22 } : { scaleX: 0, opacity: 0 }}
        transition={phase === 'in'
          ? { duration: 0.5, delay: 0.85, ease: 'easeOut' }
          : { duration: 0.2 }}
        style={{
          height: '1px',
          width: 'clamp(100px, 18vw, 260px)',
          background: 'linear-gradient(to right, transparent, rgba(140,200,255,0.6), transparent)',
          margin: '1.8rem 0 1.6rem',
          transformOrigin: 'center',
        }}
      />

      {/* ── Quote ────────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={phase === 'in' ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={phase === 'in'
          ? { duration: 0.6, delay: 1.1, ease: 'easeOut' }
          : fadeOut}
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          fontStyle: 'italic',
          fontSize: 'clamp(0.75rem, 1.3vw, 0.95rem)',
          color: 'rgba(160,210,255,0.4)',
          letterSpacing: '0.04em',
        }}
      >
        Every frame has a story waiting to be discovered.
      </motion.p>
    </div>
  );
}
