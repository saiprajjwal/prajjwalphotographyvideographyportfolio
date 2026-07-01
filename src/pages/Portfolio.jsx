import { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import portfolioData from '../data/portfolio.json';
import './Portfolio.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const PortfolioScene = lazy(() => import('./PortfolioScene'));

const LOCAL_PLACEHOLDERS = [
  {
    id: 'placeholder-1',
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1000',
    alt: 'Portrait photography example',
    category: 'Portraits'
  },
  {
    id: 'placeholder-2',
    src: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000',
    alt: 'Golden retriever dog example',
    category: 'Pets'
  },
  {
    id: 'placeholder-3',
    src: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=1000',
    alt: 'Travel adventure scenery example',
    category: 'Travel'
  },
  {
    id: 'placeholder-4',
    src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000',
    alt: 'Minimalist product design example',
    category: 'Products'
  },
  {
    id: 'placeholder-5',
    src: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=1000',
    alt: 'Behind the scenes film crew set example',
    category: 'Behind The Scene'
  },
  {
    id: 'placeholder-6',
    src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=1000',
    alt: 'Male portrait photography example',
    category: 'Portraits'
  },
  {
    id: 'placeholder-7',
    src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=1000',
    alt: 'Cute puppy portrait example',
    category: 'Pets'
  },
  {
    id: 'placeholder-8',
    src: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=1000',
    alt: 'Desert road trip scenery example',
    category: 'Travel'
  }
];

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [canvasReady, setCanvasReady] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);

  const categories = portfolioData.categories;

  useEffect(() => {
    fetch('/api/photos')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (data.photos && data.photos.length > 0) {
          setPhotos(data.photos);
        } else {
          setPhotos(LOCAL_PLACEHOLDERS);
        }
      })
      .catch(() => {
        // Fallback to static local placeholders if API is offline/unavailable (e.g. running under Vite dev locally)
        setPhotos(LOCAL_PLACEHOLDERS);
      })
      .finally(() => setPhotosLoaded(true));
  }, []);

  const filteredPhotos = filter === 'All'
    ? photos
    : photos.filter(photo => photo.category === filter);

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

          {photosLoaded && filteredPhotos.length === 0 && (
            <p className="portfolio-empty-message">
              {photos.length === 0 ? 'No photos yet — check back soon.' : `No photos in "${filter}" yet.`}
            </p>
          )}

          <div className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo) => (
                <motion.div
                  layout="position"
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
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="card-badge">{photo.category}</div>
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
    </motion.div>
  );
}
