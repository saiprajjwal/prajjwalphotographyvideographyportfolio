import React from 'react';
import { motion } from 'framer-motion';
import './InstagramReel.css';

export default function InstagramReel({ shortcode }) {
  return (
    <motion.div 
      className="instagram-reel-container"
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="instagram-reel-glass-wrapper">
        <iframe
          src={`https://www.instagram.com/reel/${shortcode}/embed/`}
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          allowTransparency="true"
          allow="encrypted-media"
          className="instagram-reel-iframe"
        ></iframe>
      </div>
    </motion.div>
  );
}
