import { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  useScroll,
  useVelocity,
  useSpring,
  useTransform,
  useMotionTemplate,
} from 'framer-motion';
import { ArrowLeft, LayoutGrid, GalleryVertical } from 'lucide-react';
import { EASE, DUR } from '../utils/motion';
import './PhotoViewer.css';

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One frame in the flow view. The whole effect is the CLOTH CURL from
// aikawakenichi.com/journey: while you SCROLL, each photo's top and bottom
// edges bow into a wide draped curve — like fabric dragging as it's pulled —
// and the faster you scroll the deeper the drape. The moment you stop, the
// edges settle back to straight. The image itself never squashes or scales
// (that earlier "wiggle" was wrong); only the edges curl.
// `arch` is a shared motion value (px depth of the drape) fed from the whole
// viewer's scroll velocity.
function FlowFrame({ photo, arch }) {
  // Elliptical radius: horizontal held at 50% so the two corners of an edge
  // merge into one smooth drape; vertical = the live arch depth.
  const radius = useMotionTemplate`50% ${arch}px`;
  const style = prefersReduced
    ? undefined
    : {
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
      };

  return (
    <div className="pv-frame" data-pv-id={photo.id}>
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

  // Scroll velocity → drape depth. Springed so the curl eases in and settles
  // smoothly. Symmetric: fast scrolling in either direction deepens the arch;
  // at rest it returns to 0 (straight edges). Clamped so it can't over-round.
  const { scrollY } = useScroll({ container: scrollRef });
  const rawVelocity = useVelocity(scrollY);
  const velocity = useSpring(rawVelocity, { stiffness: 200, damping: 38, mass: 0.6 });
  // Shallow + wide: the arch depth tops out low (a gentle drape, not a dome),
  // and reaches it at a modest scroll speed so ordinary scrolling shows it.
  const arch = useTransform(velocity, [-1400, 0, 1400], [58, 0, 58], { clamp: true });

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
          {view === 'flow'
            ? album.photos.map((p) => (
                <FlowFrame key={p.id} photo={p} arch={arch} />
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
          {view === 'flow' ? <LayoutGrid size={19} strokeWidth={1.9} /> : <GalleryVertical size={19} strokeWidth={1.9} />}
        </button>
      </div>
    </motion.div>,
    document.body
  );
}
