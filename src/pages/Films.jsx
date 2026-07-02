import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, X } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import VideoLightbox from '../components/VideoLightbox';
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

  useEffect(() => {
    sessionStorage.setItem('last_visited_page', 'Films');
  }, []);
  
  const videos = portfolioData.videos;
  const heroVideo = videos[0];
  const rowVideos = videos; // Don't slice, show all of them!

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
      className="films-wrapper-full netflix-layout"
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

      <main className="netflix-main-container" style={{ pointerEvents: activeVideo ? 'none' : 'auto' }}>
        
        {/* Massive Netflix Hero (Already loaded behind the black overlay) */}
        <div className="netflix-hero">
          <div className="netflix-hero-background">
            {/* Crossfade by rendering both images, fading between them */}
            <img
              key={(hoveredVideo || heroVideo).id}
              src={`https://img.youtube.com/vi/${(hoveredVideo || heroVideo).id}/maxresdefault.jpg`}
              alt={(hoveredVideo || heroVideo).title}
              className="netflix-hero-img"
            />
            <div className="netflix-hero-vignette-bottom"></div>
            <div className="netflix-hero-vignette-left"></div>
          </div>
          
          <div className="netflix-hero-content">
            <motion.h1 
              className="netflix-hero-title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 20 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {(hoveredVideo || heroVideo).title}
            </motion.h1>
            <motion.p 
              className="netflix-hero-description"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 20 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              A cinematic masterpiece exploring the boundaries of visual storytelling. Shot on Sony a7S III with breathtaking color science.
            </motion.p>
            <motion.div 
              className="netflix-hero-buttons"
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

        {/* Netflix Grid Rows */}
        <motion.div 
          className="netflix-row-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: doorsOpen ? 1 : 0, y: doorsOpen ? 0 : 30 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="netflix-row-title">Recent Masterpieces</h2>
          <div className="netflix-row-track">
            {rowVideos.map((video) => (
              <div
                key={video.id}
                className="netflix-thumbnail-wrapper"
                onMouseEnter={() => setHoveredVideo(video)}
                onMouseLeave={() => setHoveredVideo(null)}
              >
                <VideoCard video={video} onPlay={() => setActiveVideo(video)} />
              </div>
            ))}
          </div>
        </motion.div>
        
      </main>

      {/* Cinematic Fullscreen Lightbox Modal */}
      {activeVideo && (
        <VideoLightbox
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}

      {/* Netflix 'More Info' Modal */}
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
                  <span className="match-score">98% Match</span>
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
