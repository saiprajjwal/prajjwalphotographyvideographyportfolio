import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import './InstagramLightbox.css';

export default function InstagramLightbox({ shortcode, onClose }) {
  // Prevent body scroll when lightbox is open, and support closing via Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <motion.div 
      className="instagram-lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClose}
    >
      <motion.button 
        className="instagram-lightbox-close"
        onClick={onClose}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        aria-label="Back to Films"
      >
        <ChevronLeft size={20} />
        Back to Films
      </motion.button>

      <motion.div 
        className="instagram-lightbox-content"
        initial={{ scale: 0.95, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 40 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the video
      >
        <iframe
          src={`https://www.instagram.com/reel/${shortcode}/embed/`}
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          allowTransparency="true"
          allow="encrypted-media"
          className="instagram-lightbox-iframe"
        ></iframe>
      </motion.div>
    </motion.div>
  );
}
