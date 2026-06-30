import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lightbox from '../components/Lightbox';
import portfolioData from '../data/portfolio.json';
import './Portfolio.css';

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const categories = portfolioData.categories;
  
  // Filter photos based on selected category
  const filteredPhotos = filter === 'All' 
    ? portfolioData.photos 
    : portfolioData.photos.filter(photo => photo.category === filter);

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const nextPhoto = () => {
    setLightboxIndex((prev) => (prev + 1) % filteredPhotos.length);
  };

  const prevPhoto = () => {
    setLightboxIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  return (
    <motion.main 
      className="page-wrapper section-padding"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="container">
        <header className="page-header">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
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
          <AnimatePresence>
            {filteredPhotos.map((photo, index) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4 }}
                key={photo.id} 
                className="masonry-item"
                onClick={() => openLightbox(index)}
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
    </motion.main>
  );
}
