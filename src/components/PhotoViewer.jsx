import { useRef, useState, useLayoutEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, useScroll } from 'framer-motion';
import { ArrowLeft, LayoutGrid, GalleryVertical } from 'lucide-react';
import { EASE, DUR } from '../utils/motion';
import './PhotoViewer.css';

// The WebGL layer that renders the actual photos on bendable planes. Lazy so
// three.js only loads when a viewer is opened, not on the Portfolio route.
const PhotoViewerScene = lazy(() => import('./PhotoViewerScene'));

// Full-screen scroll viewer for a single album's photos.
//   album = { name, categoryLabel, photos: [{ id, src, alt }], startId }
//
// Flow view is a DOM-synced WebGL gallery: the DOM lays out invisible image
// placeholders (which drive scroll + position), and PhotoViewerScene draws the
// real, texture-mapped planes on top — bending each plane's mesh with scroll
// velocity for the true cloth-curl from aikawakenichi.com/journey. Grid view is
// a plain DOM contact sheet.
export default function PhotoViewer({ album, onClose }) {
  const scrollRef = useRef(null);
  const [view, setView] = useState('flow');
  const thumb = album.photos[0]?.src;

  // Live scroll position of the viewer, fed to the WebGL cloth shader.
  const { scrollY } = useScroll({ container: scrollRef });

  // Open scrolled to whichever photo was tapped.
  useLayoutEffect(() => {
    if (!album.startId || view !== 'flow') return;
    const el = scrollRef.current?.querySelector(`[data-pv-id="${CSS.escape(album.startId)}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
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
      {/* WebGL cloth layer (flow view only). Fixed, pointer-events-none, so the
          scroll below still receives wheel/touch. */}
      {view === 'flow' && (
        <Suspense fallback={null}>
          <PhotoViewerScene photos={album.photos} scrollY={scrollY} />
        </Suspense>
      )}

      <div
        className={`pv-scroll pv-scroll--${view}`}
        ref={scrollRef}
        data-lenis-prevent
      >
        <div className="pv-inner">
          {view === 'flow'
            ? album.photos.map((p) => (
                // Invisible placeholder: gives the WebGL plane its size + scroll
                // position. The real pixels are drawn by PhotoViewerScene.
                <div className="pv-frame" key={p.id} data-pv-id={p.id}>
                  <img
                    id={`pv-img-${p.id}`}
                    className="pv-frame-img"
                    src={p.src}
                    alt={p.alt}
                    loading="lazy"
                    draggable="false"
                  />
                </div>
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
