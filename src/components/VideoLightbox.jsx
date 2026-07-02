import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './VideoLightbox.css';

export default function VideoLightbox({ video, onClose }) {
  // Prevent body scroll when lightbox is open, and support closing via Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!video) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="video-lightbox-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        onClick={onClose}
        style={{ background: '#000000', backdropFilter: 'none' }}
      >
        <motion.button 
          className="video-lightbox-close"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          aria-label="Close video"
          style={{ zIndex: 100 }}
        >
          <X size={28} />
        </motion.button>

        <motion.div 
          className="video-lightbox-content"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{ 
             width: '100vw', 
             height: '100vh', 
             maxWidth: '100%', 
             maxHeight: '100%',
             borderRadius: '0px', 
             padding: '0' 
          }}
        >
          <div className="video-lightbox-iframe-wrapper" style={{ height: '100%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1&controls=1&rel=0&modestbranding=1`}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%' }}
            ></iframe>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
