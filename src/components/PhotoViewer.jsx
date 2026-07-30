import { useRef, useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, useScroll } from 'framer-motion';
import { ArrowLeft, LayoutGrid, GalleryVertical } from 'lucide-react';
import Lenis from 'lenis';
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
  // Which photo flow view should sit on. Starts at whatever was tapped in the
  // album, and is re-pointed when a filmstrip strip is chosen.
  const [focusId, setFocusId] = useState(album.startId);
  const thumb = album.photos[0]?.src;

  // Picking a strip in the filmstrip drops you into flow view on that photo.
  // This is also what makes the filmstrip usable on touch, where the hover
  // expand can never fire.
  const openFromStrip = (id) => {
    setFocusId(id);
    setView('flow');
  };

  // Live scroll position of the viewer, fed to the WebGL cloth shader.
  const { scrollY } = useScroll({ container: scrollRef });

  // Open scrolled to whichever photo was tapped.
  useLayoutEffect(() => {
    if (!focusId || view !== 'flow') return;
    const scroller = scrollRef.current;
    const el = scrollRef.current?.querySelector(`[data-pv-id="${CSS.escape(focusId)}"]`);
    if (el && scroller) {
      // Keep a little air above the selected frame, like the reference, rather
      // than pinning its first row directly under the browser edge.
      scroller.scrollTop = Math.max(0, el.offsetTop - window.innerHeight * 0.08);
    }
  }, [focusId, view]);

  // The site-wide Lenis instance is paused while an album is open. Give this
  // nested scroll surface its own slower, weightier interpolation so wheel
  // impulses become one continuous cloth pull instead of a series of jolts.
  useEffect(() => {
    if (view !== 'flow' || !scrollRef.current) return undefined;

    const wrapper = scrollRef.current;
    const content = wrapper.querySelector('.pv-inner');
    if (!content) return undefined;

    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -9 * t)),
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.25,
      wheelMultiplier: 0.88,
      overscroll: false,
    });

    let frame;
    const tick = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [view]);

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
      {/* Always render WebGL layer so it can animate between views */}
      <Suspense fallback={null}>
        <PhotoViewerScene photos={album.photos} scrollY={scrollY} view={view} />
      </Suspense>

      <motion.div
        layoutScroll
        className={`pv-scroll pv-scroll--${view}`}
        ref={scrollRef}
      >
        <motion.div layout className="pv-inner">
          {album.photos.map((p) => (
            <motion.div
              layout
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth FLIP animation
              className={view === 'flow' ? 'pv-frame' : 'pv-grid-item'}
              key={p.id}
              data-pv-id={p.id}
              onClick={view === 'grid' ? () => openFromStrip(p.id) : undefined}
              role={view === 'grid' ? 'button' : undefined}
              tabIndex={view === 'grid' ? 0 : undefined}
              aria-label={view === 'grid' ? `Open ${p.alt || 'photograph'}` : undefined}
              onKeyDown={
                view === 'grid'
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFromStrip(p.id);
                      }
                    }
                  : undefined
              }
            >
              <img
                id={`pv-img-${p.id}`}
                className={view === 'flow' ? 'pv-frame-img' : 'pv-grid-img'}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                draggable="false"
              />
            </motion.div>
          ))}
          <div className="pv-end" aria-hidden="true" />
        </motion.div>
      </motion.div>

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
