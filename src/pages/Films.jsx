import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, X, ChevronLeft, ChevronRight } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import VideoLightbox from '../components/VideoLightbox';
import InstagramReel from '../components/InstagramReel';
import ReelViewer from '../components/ReelViewer';
import ParticleIntro from './ParticleIntro';
import portfolioData from '../data/portfolio.json';
import './Films.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const FilmsScene = lazy(() => import('./FilmsScene'));

export default function Films() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [introDone, setIntroDone] = useState(() => sessionStorage.getItem('last_visited_page') === 'Films');
  const [doorsOpen, setDoorsOpen] = useState(() => sessionStorage.getItem('last_visited_page') === 'Films');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState(null);
  const [activeReelIndex, setActiveReelIndex] = useState(null);

  const reelsTrackRef = useRef(null);

  const scrollReels = (direction) => {
    if (reelsTrackRef.current) {
      const scrollAmount = 350; // Approximately the width of one reel + gap
      reelsTrackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Drag-to-scroll for the reels track (mouse only — touch scrolls natively)
  const reelsDragRef = useRef({ down: false, startX: 0, scrollLeft: 0, dragged: false });

  const onReelsPointerDown = (e) => {
    if (e.pointerType !== 'mouse') return;
    reelsDragRef.current = {
      down: true,
      startX: e.clientX,
      scrollLeft: reelsTrackRef.current.scrollLeft,
      dragged: false
    };
  };

  const onReelsPointerMove = (e) => {
    const drag = reelsDragRef.current;
    if (!drag.down) return;
    const track = reelsTrackRef.current;
    const dx = e.clientX - drag.startX;
    if (!drag.dragged) {
      if (Math.abs(dx) < 6) return; // Below this it's a click, not a drag
      drag.dragged = true;
      track.setPointerCapture(e.pointerId);
      // Smooth behavior and snap fight direct scrollLeft writes mid-drag
      track.style.scrollBehavior = 'auto';
      track.style.scrollSnapType = 'none';
      track.style.cursor = 'grabbing';
    }
    track.scrollLeft = drag.scrollLeft - dx;
  };

  const endReelsDrag = (e) => {
    const drag = reelsDragRef.current;
    if (!drag.down) return;
    drag.down = false;
    const track = reelsTrackRef.current;
    track.style.scrollBehavior = '';
    track.style.scrollSnapType = '';
    track.style.cursor = '';
    if (drag.dragged && track.hasPointerCapture?.(e.pointerId)) {
      track.releasePointerCapture(e.pointerId);
    }
  };

  const onReelsClickCapture = (e) => {
    // Swallow the click that lands right after a drag release
    if (reelsDragRef.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      reelsDragRef.current.dragged = false;
    }
  };

  useEffect(() => {
    sessionStorage.setItem('last_visited_page', 'Films');
  }, []);
  
  const videos = portfolioData.videos;
  const heroVideo = videos[0];
  const rowVideos = videos;
  const reels = portfolioData.reels || [];

  const t1Ref = useRef(null);
  const t2Ref = useRef(null);

  // Lock scroll during intro — pad right to prevent scrollbar layout shift
  useEffect(() => {
    if (!introDone) {
      const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow   = 'hidden';
      document.body.style.paddingRight = `${scrollbarW}px`;
    } else {
      document.body.style.overflow    = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow    = '';
      document.body.style.paddingRight = '';
    };
  }, [introDone]);

  const handleIntroDone = () => {
    // Short pause so the page fade-in feels intentional
    t1Ref.current = setTimeout(() => setDoorsOpen(true), 50);
    t2Ref.current = setTimeout(() => setIntroDone(true), 650);
  };

  const handleIntroSkip = () => {
    clearTimeout(t1Ref.current);
    clearTimeout(t2Ref.current);
    setDoorsOpen(true);
    setTimeout(() => setIntroDone(true), 400);
  };

  // Handle Escape key for info modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showInfoModal) {
        setShowInfoModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfoModal]);

  return (
    <motion.div
      className="films-wrapper-full showcase-layout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* Particle Dust Intro */}
      {!introDone && (
        <ParticleIntro
          onDone={handleIntroDone}
          onSkip={handleIntroSkip}
        />
      )}

      {/* 3D Background Canvas */}
      <div
        className="films-canvas-fixed"
        style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 1s ease-out' }}
      >
        <Suspense fallback={null}>
          <FilmsScene onReady={() => setCanvasReady(true)} />
        </Suspense>
      </div>

      <main className="showcase-main-container" style={{ pointerEvents: activeVideo ? 'none' : 'auto' }}>
        
        {/* Massive Showcase Hero (Already loaded behind the black overlay) */}
        <div className="showcase-hero">
          <div className="showcase-hero-background">
            {/* Crossfade by rendering both images, fading between them */}
            <img
              key={(hoveredVideo || heroVideo).id}
              src={`https://img.youtube.com/vi/${(hoveredVideo || heroVideo).id}/maxresdefault.jpg`}
              alt={(hoveredVideo || heroVideo).title}
              className="showcase-hero-img"
            />
            <div className="showcase-hero-vignette-bottom"></div>
            <div className="showcase-hero-vignette-left"></div>
          </div>
          
          <div className="showcase-hero-content">
            <motion.h1 
              className="showcase-hero-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 20 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {(hoveredVideo || heroVideo).title}
            </motion.h1>
            <motion.p 
              className="showcase-hero-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 20 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              A cinematic masterpiece exploring the boundaries of visual storytelling. Shot on Sony a7S III with breathtaking color science.
            </motion.p>
            <motion.div 
              className="showcase-hero-buttons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 20 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <button className="btn-play" onClick={() => setActiveVideo(hoveredVideo || heroVideo)}>
                <Play size={24} fill="currentColor" />
                <span>Play</span>
              </button>
              <button className="btn-info" onClick={() => setShowInfoModal(true)}>
                <Info size={24} />
                <span>More Info</span>
              </button>
            </motion.div>
          </div>
        </div>

        {/* Showcase Grid Rows */}
        <motion.div 
          className="showcase-row-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 30 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="showcase-row-title">Recent Masterpieces</h2>
          <div className="showcase-row-track">
            {rowVideos.map((video) => (
              <div
                key={video.id}
                className="showcase-thumbnail-wrapper"
                onMouseEnter={() => setHoveredVideo(video)}
                onMouseLeave={() => setHoveredVideo(null)}
              >
                <VideoCard video={video} onPlay={() => setActiveVideo(video)} />
              </div>
            ))}
          </div>
        </motion.div>

        {reels.length > 0 && (
          <motion.div 
            className="showcase-row-section"
            style={{ marginTop: '3rem' }} /* Override the negative margin used for the first row */
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 30 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="showcase-row-title">Short Form & Reels</h2>
            <div className="showcase-scroll-container">
              <button className="scroll-arrow scroll-left" onClick={() => scrollReels('left')} aria-label="Scroll left">
                <ChevronLeft size={32} />
              </button>
              <div
                className="showcase-scroll-track"
                ref={reelsTrackRef}
                onPointerDown={onReelsPointerDown}
                onPointerMove={onReelsPointerMove}
                onPointerUp={endReelsDrag}
                onPointerCancel={endReelsDrag}
                onPointerLeave={endReelsDrag}
                onClickCapture={onReelsClickCapture}
              >
                {reels.map((shortcode, i) => (
                  <InstagramReel
                    key={shortcode}
                    shortcode={shortcode}
                    onOpen={() => setActiveReelIndex(i)}
                  />
                ))}
              </div>
              <button className="scroll-arrow scroll-right" onClick={() => scrollReels('right')} aria-label="Scroll right">
                <ChevronRight size={32} />
              </button>
            </div>
          </motion.div>
        )}
        
      </main>

      {/* Cinematic Fullscreen Lightbox Modal */}
      {activeVideo && (
        <VideoLightbox
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}

      {/* Instagram-story-style reel viewer */}
      <ReelViewer
        reels={reels}
        index={activeReelIndex}
        onClose={() => setActiveReelIndex(null)}
        onNavigate={setActiveReelIndex}
      />

      {/* Showcase 'More Info' Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            className="info-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              className="info-modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="info-modal-close" onClick={() => setShowInfoModal(false)}>
                <X size={20} />
              </button>

              <div className="info-modal-header">
                <img
                  src={`https://img.youtube.com/vi/${heroVideo.id}/maxresdefault.jpg`}
                  alt={heroVideo.title}
                />
                <div className="info-modal-header-fade"></div>
                <h2 className="info-modal-title">{heroVideo.title}</h2>
              </div>

              <div className="info-modal-body">
                <div className="info-meta">
                  <span className="match-score">Featured</span>
                  <span>2026</span>
                  <span className="rating">4K Ultra HD</span>
                </div>
                <p className="info-synopsis">
                  A breathtaking cinematic journey capturing the raw essence of motion and light — pushing the boundaries of modern visual storytelling.
                </p>
                <p className="info-gear">
                  <span>Camera & Gear: </span>{portfolioData.about.gear.join(' • ')}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
