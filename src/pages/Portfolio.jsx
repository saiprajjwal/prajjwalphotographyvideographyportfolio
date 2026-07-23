import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import portfolioData from '../data/portfolio.json';
import { lenisInstance } from '../utils/lenisInstance';
import CylindricalHeroRing from '../components/CylindricalHeroRing';
import FloatingNavPill from '../components/FloatingNavPill';
import { pickCategoryCover } from '../utils/categoryCover';
import { EASE, DUR } from '../utils/motion';
import './Portfolio.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const PortfolioScene = lazy(() => import('./PortfolioScene'));

// Admin-set sequence numbers (1, 2, 3…) lead in ascending order
const rank = (v) => (v > 0 ? v : Infinity);
const byPhotoOrder = (a, b) => rank(a.photoOrder) - rank(b.photoOrder);
const byAlbumOrder = (a, b) => rank(a.albumOrder) - rank(b.albumOrder);

export default function Portfolio() {
  // Seeded from the bundled list so the first paint has filters, then replaced
  // by whatever is saved in admin once /api/photos responds.
  const [categories, setCategories] = useState(
    portfolioData.categories || ['Portraits', 'Pets', 'Travel', 'Products', 'Behind The Scene']
  );

  const gridRef = useRef(null);

  // Category lives in the URL (?category=Travel) so a refresh / share keeps selected category
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category');
  const filter = categories.includes(urlCategory) ? urlCategory : (categories[0] || 'Portraits');
  
  const setFilter = (cat) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', cat);
        return next;
      },
      { replace: true }
    );

  const [activeSession, setActiveSession] = useState(null);
  // Hero band layout: curved arc (default) or flattened plane
  const [flatMode, setFlatMode] = useState(false);
  // Full-screen category view opened by clicking the hero band, plus the
  // album drilled into from within it
  const [openCategory, setOpenCategory] = useState(null);
  const [overlayAlbum, setOverlayAlbum] = useState(null);
  // Viewport rect of the band panel that was clicked — the cinematic category
  // view flies its cover out of exactly this spot (shared-element open).
  const [originRect, setOriginRect] = useState(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('last_visited_page') === 'Portfolio');
  const [doorsOpen, setDoorsOpen] = useState(() => sessionStorage.getItem('last_visited_page') === 'Portfolio');

  useEffect(() => {
    sessionStorage.setItem('last_visited_page', 'Portfolio');
  }, []);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        // null until the list has been saved in admin — keep the bundled default
        if (Array.isArray(data.categories) && data.categories.length) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        setPhotos([]);
      })
      .finally(() => setPhotosLoaded(true));
  }, []);

  const scrollToGrid = () => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const categoryPhotos = photos.filter((photo) => photo.category === filter);
  const distinctSessions = [...new Set(categoryPhotos.map((p) => p.session).filter(Boolean))];

  const shouldShowTiers = distinctSessions.length >= 1;

  let displayItems = [];

  if (shouldShowTiers) {
    const sessionCovers = distinctSessions
      .map((sessionName) => {
        const sessionPhotos = categoryPhotos.filter((p) => p.session === sessionName);
        const firstPhoto = sessionPhotos.find((p) => p.isCover) || sessionPhotos[0];
        return {
          ...firstPhoto,
          isSessionCover: true,
          id: `session-${sessionName}`,
          sessionName,
        };
      })
      .sort(byAlbumOrder);
    const noSessionPhotos = categoryPhotos.filter((p) => !p.session).sort(byPhotoOrder);
    displayItems = [...sessionCovers, ...noSessionPhotos];
  } else {
    displayItems = [...categoryPhotos].sort(byPhotoOrder);
  }

  // Active session photos for overlay modal
  const activeSessionPhotos = activeSession
    ? categoryPhotos.filter((p) => p.session === activeSession).sort(byPhotoOrder)
    : [];

  // ── Full-screen category view (opened from the hero band) ──
  // Same album-cover-then-photos shape as the grid, scoped to one category.
  const overlayPhotos = openCategory
    ? photos.filter((p) => p.category === openCategory)
    : [];

  const overlayItems = (() => {
    if (!openCategory) return [];
    if (overlayAlbum) {
      return overlayPhotos.filter((p) => p.session === overlayAlbum).sort(byPhotoOrder);
    }
    const sessions = [...new Set(overlayPhotos.map((p) => p.session).filter(Boolean))];
    const covers = sessions
      .map((sessionName) => {
        const inSession = overlayPhotos.filter((p) => p.session === sessionName);
        const cover = inSession.find((p) => p.isCover) || inSession[0];
        return { ...cover, isSessionCover: true, id: `ov-${sessionName}`, sessionName };
      })
      .sort(byAlbumOrder);
    const loose = overlayPhotos.filter((p) => !p.session).sort(byPhotoOrder);
    return [...covers, ...loose];
  })();

  // The cover that flies out of the band and anchors the category hero.
  // Same helper the band uses, so the image matches what was clicked.
  const overlayCover = pickCategoryCover(overlayPhotos);

  // Resting rect of the pinned hero, in pixels. Keeping the flight in one unit
  // (px) lets framer interpolate cleanly from the band's rect; mixing px with
  // vw/svh would snap. Recomputed only while the view is open.
  const heroRect = openCategory
    ? { left: 0, top: 0, width: window.innerWidth, height: Math.round(window.innerHeight * 0.52) }
    : null;

  const closeCategory = useCallback(() => {
    setOpenCategory(null);
    setOverlayAlbum(null);
    // Keep originRect until the exit animation has run its course
  }, []);

  // Lock scroll while either overlay is open
  useEffect(() => {
    if (activeSession || openCategory) {
      document.body.style.overflow = 'hidden';
      lenisInstance.current?.stop();
    } else {
      document.body.style.overflow = '';
      lenisInstance.current?.start();
    }
    return () => {
      document.body.style.overflow = '';
      lenisInstance.current?.start();
    };
  }, [activeSession, openCategory]);

  // ESC steps back out one level at a time
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (activeSession) setActiveSession(null);
      else if (overlayAlbum) setOverlayAlbum(null);
      else if (openCategory) closeCategory();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, overlayAlbum, openCategory, closeCategory]);

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pctX = x / rect.width - 0.5;
    const pctY = y / rect.height - 0.5;

    const moveX = pctX * 16;
    const moveY = pctY * 16;

    const img = card.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = `scale(1.08) translate(${moveX}px, ${moveY}px)`;
    }
  };

  const handleMouseLeave = (e) => {
    const img = e.currentTarget.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = '';
    }
  };

  // Find cover for current category to pass to floating nav pill
  const activeCategoryPhoto = categoryPhotos.find((p) => p.isCover) || categoryPhotos[0];

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

      {/* Ambient 3D Canvas Background */}
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

      {/* TOP HERO SECTION (aikawakenichi.com inspired) */}
      <section className="portfolio-hero-section">
        {/* Byline, set quietly above the display word */}
        <div className="portfolio-top-tagline-bar">
          <p className="tagline-text">
            <Link to="/about" className="tagline-link">Prajjwal Pandey</Link>
            {' '}is a storyteller &amp; photographer based in Atlanta, Georgia.
          </p>
        </div>

        {/* Curved photo band + giant display word */}
        <CylindricalHeroRing
          categories={categories}
          activeCategory={filter}
          onSelectCategory={(cat) => {
            setFilter(cat);
            setActiveSession(null);
          }}
          photos={photos}
          flatMode={flatMode}
          onOpenCategory={(cat, rect) => {
            setOverlayAlbum(null);
            setOriginRect(rect);
            setOpenCategory(cat);
          }}
        />

        {/* Floating glass dock, anchored to the bottom of the hero */}
        <FloatingNavPill
          categories={categories}
          activeCategory={filter}
          onSelectCategory={(cat) => {
            setFilter(cat);
            setActiveSession(null);
          }}
          activePhotoSrc={activeCategoryPhoto?.src}
          flatMode={flatMode}
          onToggleMode={setFlatMode}
        />

        {/* Quiet scroll affordance, opposite the byline */}
        <button type="button" className="portfolio-scroll-cue" onClick={scrollToGrid}>
          <span>Albums</span>
          <span className="portfolio-scroll-cue__rule" aria-hidden="true" />
        </button>
      </section>

      {/* BOTTOM MASONRY ALBUM GRID SECTION (Current album layout preserved) */}
      <main
        ref={gridRef}
        className="page-wrapper section-padding portfolio-content-overlay"
        style={{ pointerEvents: activeSession ? 'none' : 'auto' }}
      >
        <div className="container">
          <header className="page-header">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Selected Works
            </motion.h1>

            {/* Category Filter Pills */}
            <motion.div
              className="filter-nav"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {categories.map((cat) => (
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
              {photos.length === 0
                ? 'No photos yet — check back soon.'
                : `No photos in "${filter}" yet.`}
            </p>
          )}

          <div className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {displayItems.map((photo, i) => (
                <motion.div
                  key={photo.id}
                  layout="position"
                  initial={{ opacity: 0, y: 20 }}
                  animate={
                    activeSession
                      ? lightMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            x: i % 2 === 0 ? '-100vw' : '100vw',
                            y: (i % 3) * 50,
                            rotate: i % 2 === 0 ? -15 : 15,
                          }
                      : { opacity: 1, y: 0, x: 0, rotate: 0 }
                  }
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: activeSession ? (lightMotion ? 0.3 : 0.8) : 0.5,
                    ease: [0.16, 1, 0.3, 1],
                    layout: { duration: lightMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] },
                  }}
                  className="masonry-item"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={photo.isSessionCover ? () => setActiveSession(photo.sessionName) : undefined}
                  style={photo.isSessionCover ? { cursor: 'pointer' } : {}}
                >
                  <div className="card-badge">
                    {photo.isSessionCover ? photo.sessionName : photo.category}
                  </div>
                  <img
                    src={photo.src}
                    srcSet={`
                      ${photo.src.replace('w_1200', 'w_400')} 400w,
                      ${photo.src.replace('w_1200', 'w_800')} 800w,
                      ${photo.src.replace('w_1200', 'w_1200')} 1200w,
                      ${photo.src.replace('w_1200', 'w_1600')} 1600w
                    `}
                    sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
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

      {/* Signature moment — the clicked cover flies out of the band into a
          full-bleed category hero, then the collection rises over it. */}
      <AnimatePresence onExitComplete={() => setOriginRect(null)}>
        {openCategory && (
          <div className="cat-view" data-lenis-prevent role="dialog" aria-modal="true" aria-label={`${openCategory} collection`}>
            {/* Dark base */}
            <motion.div
              className="cat-view__scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.base }}
              onClick={closeCategory}
            />

            {/* Flying cover: animates from the band's exact viewport rect to a
                pinned full-width hero. Falls back to a plain fade if we never
                got a rect (e.g. opened by means other than a band tap). */}
            <motion.div
              className="cat-view__cover"
              initial={
                lightMotion
                  ? { ...heroRect, borderRadius: 0, opacity: 0 }
                  : originRect
                    ? { ...originRect, borderRadius: 14, opacity: 1 }
                    : { ...heroRect, borderRadius: 0, opacity: 0 }
              }
              animate={{ ...heroRect, borderRadius: 0, opacity: 1 }}
              exit={
                lightMotion || !originRect
                  ? { ...heroRect, borderRadius: 0, opacity: 0 }
                  : { ...originRect, borderRadius: 14, opacity: 0 }
              }
              transition={{ duration: lightMotion ? 0.3 : DUR.slow, ease: EASE.out }}
            >
              {overlayCover && (
                <motion.img
                  className="cat-view__cover-img"
                  src={overlayCover.src}
                  alt={overlayCover.alt || `${openCategory} cover`}
                  initial={{ scale: 1.12 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 8, ease: 'linear' }}
                />
              )}
              <div className="cat-view__cover-scrim" />
              <div className="cat-view__cover-caption">
                <motion.span
                  className="cat-view__eyebrow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: DUR.base, ease: EASE.out }}
                >
                  {overlayAlbum ? openCategory : 'The Archive'}
                </motion.span>
                <motion.h2
                  className="cat-view__title"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: DUR.slow, ease: EASE.out }}
                >
                  {overlayAlbum || openCategory}
                </motion.h2>
                <motion.span
                  className="cat-view__count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: DUR.base }}
                >
                  {overlayAlbum
                    ? `${overlayItems.length} photograph${overlayItems.length === 1 ? '' : 's'}`
                    : `${overlayItems.length} album${overlayItems.length === 1 ? '' : 's'}`}
                </motion.span>
              </div>
            </motion.div>

            {/* Top controls */}
            <div className="cat-view__bar">
              {overlayAlbum && (
                <button className="cat-view__back" onClick={() => setOverlayAlbum(null)}>
                  &larr; {openCategory}
                </button>
              )}
              <button className="cat-view__close" onClick={closeCategory} aria-label="Close collection">
                Close &times;
              </button>
            </div>

            {/* The collection sheet slides up over the hero */}
            <motion.div
              className="cat-view__sheet"
              data-lenis-prevent
              style={{ marginTop: heroRect ? heroRect.height - 26 : '48svh' }}
              initial={{ opacity: 0, y: lightMotion ? 0 : 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: lightMotion ? 0 : 40 }}
              transition={{ delay: lightMotion ? 0 : 0.3, duration: lightMotion ? 0.25 : DUR.slow, ease: EASE.out }}
            >
              <div className="cat-view__sheet-inner container">
                {overlayItems.length === 0 ? (
                  <p className="portfolio-empty-message">
                    No photos in &ldquo;{openCategory}&rdquo; yet.
                  </p>
                ) : (
                  <div className="masonry-grid">
                    {overlayItems.map((photo, i) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, y: 34 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: lightMotion ? 0 : 0.42 + Math.min(i, 10) * 0.045,
                          duration: DUR.base,
                          ease: EASE.out,
                        }}
                        className="masonry-item"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={
                          photo.isSessionCover
                            ? () => setOverlayAlbum(photo.sessionName)
                            : undefined
                        }
                        style={photo.isSessionCover ? { cursor: 'pointer' } : {}}
                      >
                        {photo.isSessionCover && (
                          <div className="card-badge">{photo.sessionName}</div>
                        )}
                        <img
                          src={photo.src}
                          srcSet={`
                            ${photo.src.replace('w_1200', 'w_400')} 400w,
                            ${photo.src.replace('w_1200', 'w_800')} 800w,
                            ${photo.src.replace('w_1200', 'w_1200')} 1200w,
                            ${photo.src.replace('w_1200', 'w_1600')} 1600w
                          `}
                          sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          alt={photo.alt}
                          loading="lazy"
                          className="portfolio-image"
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Glassy Album Modal Overlay */}
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
              data-lenis-prevent
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
                        srcSet={`
                          ${photo.src.replace('w_1200', 'w_400')} 400w,
                          ${photo.src.replace('w_1200', 'w_800')} 800w,
                          ${photo.src.replace('w_1200', 'w_1200')} 1200w,
                          ${photo.src.replace('w_1200', 'w_1600')} 1600w
                        `}
                        sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
