import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import portfolioData from '../data/portfolio.json';
import './Portfolio.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const PortfolioScene = lazy(() => import('./PortfolioScene'));

// Admin-set sequence numbers (1, 2, 3…) lead in ascending order; anything still
// unset (0) sorts to the end and keeps its original API position. Array.sort is
// stable, so equal keys preserve the incoming created_at-desc order — meaning a
// portfolio with no manual ordering yet looks exactly as it did before.
const rank = (v) => (v > 0 ? v : Infinity);
const byPhotoOrder = (a, b) => rank(a.photoOrder) - rank(b.photoOrder);
const byAlbumOrder = (a, b) => rank(a.albumOrder) - rank(b.albumOrder);

export default function Portfolio() {
  const categories = portfolioData.categories;
  const [filter, setFilter] = useState(categories[0] || 'Portraits');
  const [activeSession, setActiveSession] = useState(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('last_visited_page') === 'Portfolio');
  const [doorsOpen, setDoorsOpen] = useState(() => sessionStorage.getItem('last_visited_page') === 'Portfolio');
  const [hoveredPhotoId, setHoveredPhotoId] = useState(null);

  useEffect(() => {
    sessionStorage.setItem('last_visited_page', 'Portfolio');
  }, []);
  
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Weaker devices drop frames when every grid photo flies off-screen at once,
  // so the transition feels slow/janky. Detect low-power hardware (or a
  // reduced-motion preference) and swap the heavy fly-off for a cheap fade.
  const lightMotion = reducedMotion || (navigator.hardwareConcurrency || 8) <= 4;

  useEffect(() => {
    if (introDone) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [introDone]);

  const finishIntro = useCallback(() => {
    setDoorsOpen(true);
    setTimeout(() => setIntroDone(true), reducedMotion ? 250 : 1400);
  }, [reducedMotion]);

  useEffect(() => {
    if (introDone || !photosLoaded) return;
    const t = setTimeout(finishIntro, reducedMotion ? 900 : 3000);
    return () => clearTimeout(t);
  }, [introDone, photosLoaded, finishIntro, reducedMotion]);

  useEffect(() => {
    fetch('/api/photos')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        setPhotos(data.photos || []);
      })
      .catch(() => {
        // API unavailable (e.g. running under plain Vite dev) — show the
        // branded empty state rather than stock placeholder photos.
        setPhotos([]);
      })
      .finally(() => setPhotosLoaded(true));
  }, []);

  const categoryPhotos = photos.filter(photo => photo.category === filter);
  const distinctSessions = [...new Set(categoryPhotos.map(p => p.session).filter(Boolean))];

  const shouldShowTiers = distinctSessions.length >= 1;

  let displayItems = [];

  if (shouldShowTiers) {
    const sessionCovers = distinctSessions.map(sessionName => {
      const sessionPhotos = categoryPhotos.filter(p => p.session === sessionName);
      const firstPhoto = sessionPhotos.find(p => p.isCover) || sessionPhotos[0];
      return {
        ...firstPhoto,
        isSessionCover: true,
        id: `session-${sessionName}`, // Use unique id to avoid collisions
        sessionName
      };
    }).sort(byAlbumOrder);
    const noSessionPhotos = categoryPhotos.filter(p => !p.session).sort(byPhotoOrder);
    displayItems = [...sessionCovers, ...noSessionPhotos];
  } else {
    displayItems = [...categoryPhotos].sort(byPhotoOrder);
  }

  // Active session photos for the overlay modal
  const activeSessionPhotos = activeSession
    ? categoryPhotos.filter(p => p.session === activeSession).sort(byPhotoOrder)
    : [];

  // Lock body scroll when overlay is active
  useEffect(() => {
    if (activeSession) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeSession]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeSession) {
        setActiveSession(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession]);

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pctX = (x / rect.width) - 0.5;
    const pctY = (y / rect.height) - 0.5;

    // Pan the image inside its crop window to follow mouse movement
    const moveX = pctX * 16; // up to 8px horizontal translation
    const moveY = pctY * 16; // up to 8px vertical translation

    const img = card.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = `scale(1.08) translate(${moveX}px, ${moveY}px)`;
    }
  };

  const handleMouseLeave = (e) => {
    const img = e.currentTarget.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = ''; // Return smoothly via CSS transition
    }
  };

  return (
    <motion.div
      className="portfolio-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* Landing: THE ARCHIVE doors */}
      <AnimatePresence>
        {!introDone && (
          <motion.div
            className="archive-intro"
            onClick={finishIntro}
            exit={{ opacity: 0, transition: { duration: 0.9, ease: 'easeInOut' } }}
          >
            <div className={`archive-door archive-door-left ${doorsOpen ? 'open' : ''}`} aria-hidden="true" />
            <div className={`archive-door archive-door-right ${doorsOpen ? 'open' : ''}`} aria-hidden="true" />
            <div className={`archive-intro-text ${doorsOpen ? 'leaving' : ''}`}>
              <motion.p
                className="archive-eyebrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 1.2 }}
              >
                Prajjwal Pandey — Photography
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 30, letterSpacing: '0.35em' }}
                animate={{ opacity: 1, y: 0, letterSpacing: '0.18em' }}
                transition={{ delay: 0.6, duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              >
                The Archive
              </motion.h1>
              <motion.p
                className="archive-tagline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1.4 }}
              >
                Every frame has a story waiting to be discovered.
              </motion.p>
              {!photosLoaded && <p className="archive-loading">Opening the vault…</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Background Canvas */}
      <div
        className="portfolio-canvas-fixed"
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }}
      >
        <Suspense fallback={null}>
          <PortfolioScene onReady={() => setCanvasReady(true)} />
        </Suspense>
      </div>

      {/* Main Content Overlay */}
      <main className="page-wrapper section-padding portfolio-content-overlay" style={{ pointerEvents: activeSession ? 'none' : 'auto' }}>
        <div className="container">
          <header className="page-header">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Portfolio
            </motion.h1>

            <motion.div
              className="filter-nav"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-btn ${filter === cat ? 'active' : ''}`}
                  onClick={() => {
                    setFilter(cat);
                    setActiveSession(null);
                  }}
                >
                  {cat}
                </button>
              ))}
            </motion.div>
          </header>

          {photosLoaded && categoryPhotos.length === 0 && (
            <p className="portfolio-empty-message">
              {photos.length === 0 ? 'No photos yet — check back soon.' : `No photos in "${filter}" yet.`}
            </p>
          )}

          <div className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {displayItems.map((photo, i) => (
                  <motion.div
                    key={photo.id}
                    layout="position"
                    initial={{ opacity: 0, y: 20 }}
                    animate={activeSession ? (lightMotion ? {
                      opacity: 0
                    } : {
                      opacity: 0,
                      x: i % 2 === 0 ? '-100vw' : '100vw',
                      y: (i % 3) * 50,
                      rotate: i % 2 === 0 ? -15 : 15
                    }) : { opacity: 1, y: 0, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      duration: activeSession ? (lightMotion ? 0.3 : 0.8) : 0.5,
                      ease: [0.16, 1, 0.3, 1],
                      layout: { duration: lightMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }
                    }}
                    className="masonry-item"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    onClick={photo.isSessionCover ? () => setActiveSession(photo.sessionName) : undefined}
                    style={photo.isSessionCover ? { cursor: 'pointer' } : {}}
                  >
                  <div className="card-badge">{photo.isSessionCover ? photo.sessionName : photo.category}</div>
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="portfolio-image"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Glassy Album Overlay */}
      <AnimatePresence>
        {activeSession && (
          <motion.div
            className="album-modal-backdrop"
            initial={{ opacity: 0, backdropFilter: lightMotion ? undefined : 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: lightMotion ? undefined : 'blur(4px)' }}
            exit={{ opacity: 0, backdropFilter: lightMotion ? undefined : 'blur(0px)' }}
            transition={{ duration: lightMotion ? 0.25 : 0.4 }}
            onClick={() => setActiveSession(null)}
          >
            <motion.div
              className="album-overlay"
              initial={{ y: lightMotion ? 0 : 40, opacity: 0, scale: lightMotion ? 1 : 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: lightMotion ? 0 : 20, opacity: 0, scale: lightMotion ? 1 : 0.98 }}
              transition={{ duration: lightMotion ? 0.3 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="album-overlay-header container">
                <h2>{activeSession}</h2>
                <button className="album-overlay-close" onClick={() => setActiveSession(null)}>
                  Close &times;
                </button>
              </div>
              
              <div className="album-overlay-content container">
                <div className="masonry-grid">
                  {activeSessionPhotos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="masonry-item"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        className="portfolio-image"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
