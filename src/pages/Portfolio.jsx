import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lightbox from '../components/Lightbox';
import portfolioData from '../data/portfolio.json';
import './Portfolio.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const PortfolioScene = lazy(() => import('./PortfolioScene'));

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const categories = portfolioData.categories;

  const filteredPhotos = filter === 'All'
    ? portfolioData.photos
    : portfolioData.photos.filter(photo => photo.category === filter);

  const openLightbox = (index) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () => setLightboxIndex((prev) => (prev + 1) % filteredPhotos.length);
  const prevPhoto = () => setLightboxIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);

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
      <main className="page-wrapper section-padding portfolio-content-overlay">
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
                  onClick={() => setFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </motion.div>
          </header>

          <motion.div layout className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo, index) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                    layout: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
                  }}
                  key={photo.id}
                  className="masonry-item"
                  onClick={() => openLightbox(index)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(index); } }}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="portfolio-image"
                  />
                  <div className="image-overlay">
                    <span className="image-category">{photo.category}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <Lightbox
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextPhoto}
          onPrev={prevPhoto}
        />
      </main>
    </motion.div>
  );
}
