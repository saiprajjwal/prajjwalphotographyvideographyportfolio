import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './VideoLightbox.css';

export default function VideoLightbox({ video, onClose }) {
  const [controlsVisible, setControlsVisible] = useState(false);

  // Prevent body scroll when lightbox is open, and support closing via Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    // Fade in controls and iframe after expansion animation completes
    const t = setTimeout(() => setControlsVisible(true), 600);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t);
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
        onClick={onClose}
        style={{ 
          background: 'var(--bg-color)', 
          backdropFilter: 'none' 
        }}
      >
        <motion.button 
          className="video-lightbox-close"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: controlsVisible ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          aria-label="Close video"
          style={{ zIndex: 100 }}
        >
          <X size={28} />
        </motion.button>

        <motion.div 
          className="video-lightbox-content"
          layoutId={`video-container-${video.id}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
            {controlsVisible && (
               <iframe
                 src={`https://www.youtube.com/embed/${video.id}?autoplay=1&controls=1&rel=0&modestbranding=1`}
                 title={video.title}
                 frameBorder="0"
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                 allowFullScreen
                 style={{ width: '100%', height: '100%' }}
               ></iframe>
            )}
            {!controlsVisible && (
               <img 
                 src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`} 
                 alt={video.title} 
                 style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
               />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
