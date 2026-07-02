import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import './ReelViewer.css';

// Story-style TikTok viewer. `index` is the reel currently open (or null when
// closed). It autoplays (muted, per browser policy), auto-advances to the next
// reel when one ends, and supports side-tap / arrow-key navigation.

// 9:16 base box; scaled up to fill the viewport height.
const BASE_W = 300;
const BASE_H = 533;

const VIEWER_PLAYER_PARAMS =
  'autoplay=1&controls=0&progress_bar=1&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&loop=0';

export default function ReelViewer({ reels, index, onClose, onNavigate }) {
  const open = index !== null && index >= 0 && index < reels.length;

  const [scale, setScale] = useState(1);
  const [dir, setDir] = useState(0);
  const [muted, setMuted] = useState(true); // autoplay must start muted
  const iframeRef = useRef(null);

  const hasPrev = open && index > 0;
  const hasNext = open && index < reels.length - 1;

  const goPrev = useCallback(() => {
    if (index > 0) { setDir(-1); onNavigate(index - 1); }
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < reels.length - 1) { setDir(1); onNavigate(index + 1); }
  }, [index, reels.length, onNavigate]);

  // Send a command into the current TikTok player.
  const postToPlayer = useCallback((type, value) => {
    iframeRef.current?.contentWindow?.postMessage(
      { 'x-tiktok-player': true, type, value: value ?? '' },
      '*'
    );
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      postToPlayer(next ? 'mute' : 'unMute');
      return next;
    });
  }, [postToPlayer]);

  // Scale the 9:16 box to fit the viewport, leaving headroom for the top bar.
  useEffect(() => {
    if (!open) return;
    const calc = () => {
      setScale(Math.min((window.innerHeight * 0.86) / BASE_H, (window.innerWidth * 0.94) / BASE_W));
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

  // Listen for player events: apply mute + play on ready, auto-advance on end.
  useEffect(() => {
    if (!open) return;
    const onMessage = (e) => {
      const data = e.data;
      if (!data || data['x-tiktok-player'] !== true) return;
      if (e.source !== iframeRef.current?.contentWindow) return; // only the active player
      if (data.type === 'onPlayerReady') {
        postToPlayer(muted ? 'mute' : 'unMute');
        postToPlayer('play');
      } else if (data.type === 'onStateChange' && Number(data.value) === 0) {
        // 0 = ended → advance to the next reel, or close on the last one
        if (index < reels.length - 1) { setDir(1); onNavigate(index + 1); }
        else onClose();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, index, muted, reels.length, onNavigate, onClose, postToPlayer]);

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

          <button className="reel-viewer-mute" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>

          {/* Left / right tap zones for navigation. They sit behind the card so
              the player stays interactive in the center. */}
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
                <iframe
                  ref={iframeRef}
                  key={reels[index]}
                  src={`https://www.tiktok.com/player/v1/${reels[index]}?${VIEWER_PLAYER_PARAMS}`}
                  className="reel-viewer-frame"
                  allow="autoplay; encrypted-media; fullscreen"
                  title="TikTok reel"
                ></iframe>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
