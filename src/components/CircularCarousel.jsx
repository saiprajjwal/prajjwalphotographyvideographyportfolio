import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import portfolioData from '../data/portfolio.json';
import './CircularCarousel.css';

export default function CircularCarousel() {
  const [photos, setPhotos] = useState([]);
  
  // We'll track the total rotation in degrees.
  const rotation = useMotionValue(0);
  
  // For dragging, we store the start rotation
  const [isDragging, setIsDragging] = useState(false);
  const startRotation = React.useRef(0);

  useEffect(() => {
    // Pick ~10-12 random photos from the portfolio to show in the carousel
    // Or just take the first 10 for consistency
    const allPhotos = portfolioData.photos.filter(p => !p.isVideo);
    const selected = allPhotos.slice(0, 10);
    setPhotos(selected);
  }, []);

  const numItems = photos.length || 10; // Fallback to avoid div by zero
  const anglePerItem = 360 / numItems;
  
  // Calculate radius based on a 320px wide card
  // radius = (width / 2) / tan(PI / numItems)
  // For 10 items, 320px width: 160 / tan(18deg) = 160 / 0.3249 = 492px
  // We add a bit of padding so cards don't touch
  const radius = Math.round(180 / Math.tan(Math.PI / numItems)) + 20;

  // Handle Dragging
  const handlePanStart = () => {
    setIsDragging(true);
    startRotation.current = rotation.get();
  };

  const handlePan = (event, info) => {
    // 1 pixel of drag = roughly 0.25 degrees of rotation
    const dragDelta = info.offset.x;
    rotation.set(startRotation.current + dragDelta * 0.25);
  };

  const handlePanEnd = (event, info) => {
    setIsDragging(false);
    // Add momentum based on drag velocity
    const velocity = info.velocity.x;
    if (Math.abs(velocity) > 50) {
      animate(rotation, rotation.get() + velocity * 0.5, {
        type: 'spring',
        damping: 40,
        stiffness: 100,
      });
    }
  };

  if (photos.length === 0) return null;

  return (
    <div className="circular-carousel-container">
      <motion.div 
        className="circular-scene"
        style={{ rotateY: rotation }}
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
      >
        {photos.map((photo, index) => {
          // Each item is rotated by its index * angle, then pushed outward by the radius
          const itemRotation = index * anglePerItem;
          return (
            <motion.div
              key={photo.id || index}
              className="circular-card"
              style={{
                transform: `rotateY(${itemRotation}deg) translateZ(${radius}px)`
              }}
            >
              <img src={photo.thumbnailUrl || photo.url} alt={photo.title || "Portfolio photo"} loading="lazy" />
              {photo.title && (
                <div className="circular-card-label">
                  {photo.title}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
