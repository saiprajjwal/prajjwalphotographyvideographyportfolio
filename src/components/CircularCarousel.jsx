import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import './CircularCarousel.css';

export default function CircularCarousel() {
  const [albums, setAlbums] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useMotionValue(0);
  const isDragging = useRef(false);
  const startRotation = useRef(0);
  const animControl = useRef(null);

  useEffect(() => {
    fetch('/api/photos')
      .then(res => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then(data => {
        const allPhotos = (data.photos || []);

        // Group by session
        const sessionMap = {};
        allPhotos.forEach(p => {
          if (!p.session) return;
          if (!sessionMap[p.session]) {
            sessionMap[p.session] = {
              id: `session-${p.session}`,
              title: p.session,
              category: p.category || '',
              coverSrc: p.src,
              isCover: p.isCover,
              albumOrder: p.albumOrder || 999,
            };
          } else {
            // Prefer the designated cover image
            if (p.isCover) {
              sessionMap[p.session].coverSrc = p.src;
              sessionMap[p.session].isCover = true;
            }
            // Use lowest albumOrder
            if ((p.albumOrder || 999) < sessionMap[p.session].albumOrder) {
              sessionMap[p.session].albumOrder = p.albumOrder;
            }
          }
        });

        const sortedAlbums = Object.values(sessionMap)
          .sort((a, b) => a.albumOrder - b.albumOrder)
          .slice(0, 12); // cap at 12 for the 3D circle

        if (sortedAlbums.length > 0) {
          setAlbums(sortedAlbums);
        }
      })
      .catch(err => {
        console.warn('Carousel: API unavailable', err);
      });
  }, []);

  const numItems = albums.length;
  if (numItems === 0) return null;

  const anglePerItem = 360 / numItems;
  // Formula: radius so that adjacent cards have ~40px gap
  // card width = 260px, so half = 130px
  const radius = Math.round(140 / Math.tan(Math.PI / numItems)) + 30;

  const goToIndex = (idx) => {
    const clamped = ((idx % numItems) + numItems) % numItems;
    setActiveIndex(clamped);
    if (animControl.current) animControl.current.stop();
    animControl.current = animate(rotation, -clamped * anglePerItem, {
      type: 'spring',
      damping: 28,
      stiffness: 70,
    });
  };

  const handlePanStart = () => {
    isDragging.current = true;
    startRotation.current = rotation.get();
    if (animControl.current) animControl.current.stop();
  };

  const handlePan = (_, info) => {
    rotation.set(startRotation.current + info.offset.x * 0.18);
  };

  const handlePanEnd = (_, info) => {
    isDragging.current = false;
    const velocity = info.velocity.x;
    const currentRot = rotation.get();

    // Calculate which card we're closest to
    let rawIndex = -currentRot / anglePerItem;
    if (Math.abs(velocity) > 120) {
      rawIndex += velocity > 0 ? -0.8 : 0.8;
    }

    const snappedIndex = Math.round(rawIndex);
    goToIndex(snappedIndex);
  };

  return (
    <div className="cc-wrapper">
      {/* Section heading */}
      <div className="cc-header">
        <p className="cc-eyebrow">My Work</p>
        <h2 className="cc-title">Photo Albums</h2>
      </div>

      {/* 3D cylinder */}
      <div className="cc-stage">
        <motion.div
          className="cc-scene"
          style={{ rotateY: rotation }}
          onPanStart={handlePanStart}
          onPan={handlePan}
          onPanEnd={handlePanEnd}
        >
          {albums.map((album, index) => {
            const angle = index * anglePerItem;
            const isActive = index === activeIndex;
            return (
              <div
                key={album.id}
                className={`cc-card ${isActive ? 'cc-card--active' : ''}`}
                style={{
                  transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                }}
              >
                {/* Photo fills the card */}
                <div className="cc-card-img-wrap">
                  <img
                    src={album.coverSrc}
                    alt={album.title}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                {/* Glass label at bottom */}
                <div className="cc-card-label">
                  {album.category && (
                    <span className="cc-card-cat">{album.category}</span>
                  )}
                  <span className="cc-card-name">{album.title}</span>
                  <Link
                    to={`/portfolio?category=${encodeURIComponent(album.category)}`}
                    className="cc-card-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Arrow controls */}
      <div className="cc-controls">
        <button
          className="cc-btn"
          onClick={() => goToIndex(activeIndex - 1)}
          aria-label="Previous album"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="cc-dots">
          {albums.map((_, i) => (
            <button
              key={i}
              className={`cc-dot ${i === activeIndex ? 'cc-dot--active' : ''}`}
              onClick={() => goToIndex(i)}
              aria-label={`Go to album ${i + 1}`}
            />
          ))}
        </div>

        <button
          className="cc-btn"
          onClick={() => goToIndex(activeIndex + 1)}
          aria-label="Next album"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
