import { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useScroll } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE, DUR } from '../utils/motion';
import PhotoViewerScene from './PhotoViewerScene';
import './PhotoViewer.css';

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Arc ⇄ flat glyph matching the reference site's layout button
function ModeGlyph({ flat }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="20" height="20">
      <motion.path
        d={flat ? 'M4 12 H20' : 'M4 15 Q12 6 20 15'}
        animate={{ d: flat ? 'M4 12 H20' : 'M4 15 Q12 6 20 15' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy={flat ? 8 : 9.6} r="1.5" fill="currentColor" />
    </svg>
  );
}

// Replaced DOM FlowFrame with WebGL scene in flow mode.

// Full-screen scroll viewer for a single album's photos.
//   album = { name, categoryLabel, photos: [{ id, src, alt }], startId }
export default function PhotoViewer({ album, onClose }) {
  const scrollRef = useRef(null);
  const [view, setView] = useState('flow');
  const { scrollYProgress } = useScroll({ container: scrollRef });

  const thumb = album.photos[0]?.src;

  // Rendered through a portal to <body> so it escapes the Portfolio page's
  // animated stacking context — otherwise the site nav would paint over it.

  // Open scrolled to whichever photo was tapped, so it feels like that photo
  // opened (not always the first). Jump instantly before paint.
  useLayoutEffect(() => {
    if (!album.startId || view !== 'flow') return;
    const el = scrollRef.current?.querySelector(`[data-pv-id="${CSS.escape(album.startId)}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.startId]);

  return createPortal(
    <motion.div
      className="pv-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.base, ease: EASE.out }}
      role="dialog"
      aria-modal="true"
      aria-label={`${album.name} photographs`}
    >
      <div
        className={`pv-scroll pv-scroll--${view}`}
        ref={scrollRef}
        data-lenis-prevent
      >
        <div className="pv-inner">
          {view === 'flow' ? (
            <div style={{ height: `calc(${album.photos.length} * 130vh)` }} />
          ) : (
            album.photos.map((p) => (
              <div className="pv-grid-item" key={p.id}>
                <img
                  src={p.src}
                  srcSet={`
                    ${p.src.replace('w_1200', 'w_400')} 400w,
                    ${p.src.replace('w_1200', 'w_800')} 800w,
                    ${p.src.replace('w_1200', 'w_1200')} 1200w
                  `}
                  sizes="(max-width: 700px) 50vw, 33vw"
                  alt={p.alt}
                  loading="lazy"
                  draggable="false"
                />
              </div>
            ))
          )}
          <div className="pv-end" aria-hidden="true" />
        </div>
      </div>

      {/* Render WebGL canvas behind UI when in flow mode */}
      {view === 'flow' && (
        <PhotoViewerScene photos={album.photos} scrollYProgress={scrollYProgress} />
      )}

      {/* Fixed control bar — back, album-name pill, view toggle (reference layout) */}
      <div className="pv-bar">
        <button className="pv-btn" onClick={onClose} aria-label="Back to album">
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>

        <div className="pv-pill">
          {thumb && <img className="pv-pill-thumb" src={thumb} alt="" aria-hidden="true" />}
          <div className="pv-pill-text">
            <span className="pv-pill-label">{album.categoryLabel || 'Album'}</span>
            <strong className="pv-pill-name">{album.name}</strong>
          </div>
        </div>

        <button
          className="pv-btn"
          onClick={() => setView((v) => (v === 'flow' ? 'grid' : 'flow'))}
          aria-label={view === 'flow' ? 'Switch to grid view' : 'Switch to flow view'}
          title={view === 'flow' ? 'Grid view' : 'Flow view'}
        >
          <ModeGlyph flat={view === 'grid'} />
        </button>
      </div>
    </motion.div>,
    document.body
  );
}

