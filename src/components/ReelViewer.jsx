import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './InstagramReel.css';
import './ReelViewer.css';

// Instagram-story-style viewer. `index` is the reel currently open (or null when
// closed); tapping the side zones — or arrow keys — moves between reels.
export default function ReelViewer({ reels, index, onClose, onNavigate }) {
  const open = index !== null && index >= 0 && index < reels.length;

  const [scale, setScale] = useState(1);
  // Track slide direction so the card animates in from the correct side.
  const [dir, setDir] = useState(0);

  const goPrev = useCallback(() => {
    if (index > 0) { setDir(-1); onNavigate(index - 1); }
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < reels.length - 1) { setDir(1); onNavigate(index + 1); }
  }, [index, reels.length, onNavigate]);

  // Scale the fixed-size cropped card up to fill the available height, leaving
  // headroom for the progress bar and close button.
  useEffect(() => {
    if (!open) return;
    const calc = () => {
      setScale(Math.min((window.innerHeight * 0.82) / 395, (window.innerWidth * 0.9) / 318));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [open]);

  // Keyboard: arrows navigate, Escape closes. Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, goPrev, goNext]);

  const hasPrev = open && index > 0;
  const hasNext = open && index < reels.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="reel-viewer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {/* Progress segments, one per reel */}
          <div className="reel-viewer-progress">
            {reels.map((code, i) => (
              <div key={code} className={`reel-progress-seg ${i <= index ? 'is-filled' : ''}`}>
                <span />
              </div>
            ))}
          </div>

          <button className="reel-viewer-close" onClick={onClose} aria-label="Close">
            <X size={26} />
          </button>

          {/* Left / right tap zones for navigation. They sit behind the card so
              the reel's own play button stays clickable in the center. */}
          <button
            className="reel-nav-zone reel-nav-left"
            onClick={goPrev}
            disabled={!hasPrev}
            aria-label="Previous reel"
          >
            {hasPrev && <ChevronLeft size={40} />}
          </button>
          <button
            className="reel-nav-zone reel-nav-right"
            onClick={goNext}
            disabled={!hasNext}
            aria-label="Next reel"
          >
            {hasNext && <ChevronRight size={40} />}
          </button>

          <div className="reel-viewer-stage">
            <AnimatePresence mode="wait">
              <motion.div
                key={reels[index]}
                className="reel-viewer-card"
                initial={{ opacity: 0, x: dir * 60, scale }}
                animate={{ opacity: 1, x: 0, scale }}
                exit={{ opacity: 0, x: dir * -60, scale }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="instagram-reel-container">
                  <div className="instagram-reel-glass-wrapper">
                    <iframe
                      src={`https://www.instagram.com/reel/${reels[index]}/embed/`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      allowTransparency="true"
                      allow="encrypted-media"
                      className="instagram-reel-iframe"
                    ></iframe>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
