import { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE, DUR } from '../utils/motion';
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

// One frame in the flow view. The effect is the "slithes" or drape effect
// from aikawakenichi.com/journey: while you SCROLL, the image inside moves
// slower than its container, creating a parallax slit reveal.
function FlowFrame({ photo }) {
  const ref = useRef(null);
  
  // Track this specific frame's position in the viewport
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Image shifts vertically by 15% as it scrolls past, creating the slit effect
  const y = useTransform(scrollYProgress, [0, 1], ['-15%', '15%']);

  const style = prefersReduced
    ? undefined
    : { y, scale: 1.15 };

  return (
    <div className="pv-frame" ref={ref} data-pv-id={photo.id}>
      <motion.img
        src={photo.src}
        srcSet={`
          ${photo.src.replace('w_1200', 'w_800')} 800w,
          ${photo.src.replace('w_1200', 'w_1200')} 1200w,
          ${photo.src.replace('w_1200', 'w_1600')} 1600w,
          ${photo.src.replace('w_1200', 'w_2000')} 2000w
        `}
        sizes="(max-width: 1100px) 100vw, 1100px"
        alt={photo.alt}
        loading="lazy"
        draggable="false"
        style={style}
      />
    </div>
  );
}

// Full-screen scroll viewer for a single album's photos.
//   album = { name, categoryLabel, photos: [{ id, src, alt }], startId }
export default function PhotoViewer({ album, onClose }) {
  const scrollRef = useRef(null);
  // 'flow' = single-column cloth-curl scroll (default, like the reference),
  // 'grid' = denser two-column contact sheet.
  const [view, setView] = useState('flow');

  const thumb = album.photos[0]?.src;

  // Rendered through a portal to <body> so it escapes the Portfolio page's
  // animated stacking context — otherwise the site nav would paint over it.

  // Dynamic mesh deformation (cloth pull) effect based on scroll velocity.
  // Instead of border-radius, we use an animated SVG clip-path with quadratic
  // bezier curves to create perfect parabolic domes/U-shapes on the top and bottom edges.
  const { scrollY } = useScroll({ container: scrollRef });
  const rawVelocity = useVelocity(scrollY);
  const velocity = useSpring(rawVelocity, { stiffness: 200, damping: 38, mass: 0.6 });

  const pathString = useTransform(velocity, (v) => {
    if (prefersReduced) return 'M 0,0 L 1,0 L 1,1 L 0,1 Z';
    
    // Clamp velocity and map to a bend amount (max 14% of the image height)
    const clampedV = Math.max(-2500, Math.min(2500, v));
    const c = (clampedV / 2500) * 0.14;

    // Pulling UP (v > 0, c > 0): Top edge is a dome (center higher), Bottom is a U-shape (center higher).
    // Pulling DOWN (v < 0, c < 0): Top edge is a U-shape (center lower), Bottom is a dome (center lower).
    const topCorners = Math.max(0, c);
    const topCenter = Math.max(0, -c);
    const topCY = 2 * topCenter - topCorners;

    const bottomCorners = 1 - Math.max(0, -c);
    const bottomCenter = 1 - Math.max(0, c);
    const bottomCY = 2 * bottomCenter - bottomCorners;

    return `M 0,${topCorners} Q 0.5,${topCY} 1,${topCorners} L 1,${bottomCorners} Q 0.5,${bottomCY} 0,${bottomCorners} Z`;
  });

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
      {/* SVG Clip Path Definitions for the Cloth Effect */}
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <clipPath id="pv-cloth-clip" clipPathUnits="objectBoundingBox">
          <motion.path d={pathString} />
        </clipPath>
      </svg>

      <div
        className={`pv-scroll pv-scroll--${view}`}
        ref={scrollRef}
        data-lenis-prevent
      >
        <div className="pv-inner">
          {view === 'flow'
            ? album.photos.map((p) => (
                <FlowFrame key={p.id} photo={p} />
              ))
            : album.photos.map((p) => (
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
              ))}
          <div className="pv-end" aria-hidden="true" />
        </div>
      </div>

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

