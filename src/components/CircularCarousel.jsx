import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import './CircularCarousel.css';

export default function CircularCarousel({ scrollYProgress }) {
  const [allAlbums, setAllAlbums] = useState([]);
  const [filter, setFilter] = useState('All');
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Motion values for scroll-driven rotation & manual drag
  const dragOffset = useMotionValue(0);
  const scrollRot = useTransform(scrollYProgress || useMotionValue(0), [0, 1], [0, -1080]);
  const rotation = useTransform([scrollRot, dragOffset], ([s, d]) => s + d);

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
        const PORTFOLIO_CATEGORIES = ['Portraits', 'Pets', 'Travel', 'Products', 'Behind The Scene'];
        // Only include photos that belong to a named session AND a known portfolio category.
        // This excludes the About headshot and any loose/miscellaneous uploads.
        const allPhotos = (data.photos || []).filter(p =>
          p.session &&
          PORTFOLIO_CATEGORIES.some(cat =>
            (p.category || '').toLowerCase() === cat.toLowerCase()
          )
        );

        // Group by session
        const sessionMap = {};
        allPhotos.forEach(p => {
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
            if (p.isCover) {
              sessionMap[p.session].coverSrc = p.src;
              sessionMap[p.session].isCover = true;
            }
            if ((p.albumOrder || 999) < sessionMap[p.session].albumOrder) {
              sessionMap[p.session].albumOrder = p.albumOrder;
            }
          }
        });

        const sortedAlbums = Object.values(sessionMap)
          .sort((a, b) => a.albumOrder - b.albumOrder)
          .slice(0, 16); // show up to 16 albums

        if (sortedAlbums.length > 0) {
          setAllAlbums(sortedAlbums);
        }
      })
      .catch(err => {
        console.warn('Carousel: API unavailable', err);
      });
  }, []);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Filter albums
  const filteredAlbums = filter === 'All' 
    ? allAlbums 
    : allAlbums.filter(a => a.category === filter);

  // 2. Clone albums to create a massive ring (minimum 28 items)
  let displayAlbums = [...filteredAlbums];
  if (displayAlbums.length > 0) {
    while (displayAlbums.length < 28) {
      displayAlbums = [...displayAlbums, ...filteredAlbums];
    }
    // Cap at exactly 28 for consistent massive radius geometry
    displayAlbums = displayAlbums.slice(0, 28);
  }

  const numItems = displayAlbums.length;
  if (numItems === 0) return null;

  const anglePerItem = 360 / numItems;
  
  // responsive radius: tighter on mobile to match smaller card width and maintain proper gaps
  const radius = windowWidth < 768 ? 1200 : 1500;

  // Update active card index in real-time as scroll/drag rotation changes
  useEffect(() => {
    const handleChange = (latest) => {
      if (numItems === 0) return;
      const rawIndex = -latest / anglePerItem;
      const snappedIndex = Math.round(rawIndex);
      const clamped = ((snappedIndex % numItems) + numItems) % numItems;
      setActiveIndex(clamped);
    };

    if (rotation.on) {
      return rotation.on('change', handleChange);
    } else if (rotation.onChange) {
      return rotation.onChange(handleChange);
    }
  }, [rotation, anglePerItem, numItems]);

  // Extract unique categories for filter pills
  const categories = ['All', ...new Set(allAlbums.map(a => a.category).filter(Boolean))];

  // Set up fading opacity for header and controls based on page scroll progress
  const controlsOpacity = useTransform(scrollYProgress || useMotionValue(0), [0.75, 0.82], [0, 1]);
  const controlsPointer = useTransform(scrollYProgress || useMotionValue(0), (v) => (v > 0.75 ? 'auto' : 'none'));

  const goToIndex = (idx) => {
    const clamped = ((idx % numItems) + numItems) % numItems;
    
    const currentScrollRot = scrollRot.get();
    const targetDragOffset = -clamped * anglePerItem - currentScrollRot;

    if (animControl.current) animControl.current.stop();
    animControl.current = animate(dragOffset, targetDragOffset, {
      type: 'spring',
      damping: 22,       // silkier, less abrupt
      stiffness: 55,     // slower, more cinematic
      mass: 0.8,
    });
  };

  const handlePanStart = () => {
    isDragging.current = true;
    startRotation.current = dragOffset.get();
    if (animControl.current) animControl.current.stop();
  };

  const handlePan = (_, info) => {
    // 0.14 degrees per px — deliberate but responsive
    dragOffset.set(startRotation.current + info.offset.x * 0.14);
  };

  const handlePanEnd = (_, info) => {
    isDragging.current = false;
    const velocity = info.velocity.x;
    const currentDragRot = dragOffset.get();
    const currentScrollRot = scrollRot.get();
    const totalRot = currentScrollRot + currentDragRot;

    // Nearest card snap, extended by momentum on a fast flick
    let rawIndex = -totalRot / anglePerItem;
    if (Math.abs(velocity) > 80) {
      const carry = Math.min(Math.abs(velocity) / 400, 2.5);
      rawIndex += velocity > 0 ? -carry : carry;
    }

    const snappedIndex = Math.round(rawIndex);
    const targetDragOffset = -snappedIndex * anglePerItem - currentScrollRot;

    if (animControl.current) animControl.current.stop();
    animControl.current = animate(dragOffset, targetDragOffset, {
      type: 'spring',
      damping: 22,
      stiffness: 55,
      mass: 0.8,
    });
  };

  return (
    <div className="cc-wrapper">
      {/* Section heading */}
      <motion.div 
        className="cc-header"
        style={{ opacity: controlsOpacity, pointerEvents: controlsPointer }}
      >
        <h2 className="cc-title">Photo Albums</h2>
      </motion.div>

      {/* 3D cylinder */}
      <div className="cc-stage">
        <motion.div
          className="cc-scene"
          style={{ rotateY: rotation, rotateX: '-2deg', z: -radius }}
          onPanStart={handlePanStart}
          onPan={handlePan}
          onPanEnd={handlePanEnd}
        >
          {displayAlbums.map((album, index) => {
            const angle = index * anglePerItem;
            const isActive = index === activeIndex;
            return (
              <div
                key={`${album.id}-${index}`}
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
      <motion.div 
        className="cc-controls"
        style={{ opacity: controlsOpacity, pointerEvents: controlsPointer }}
      >
        <button
          className="cc-arrow"
          onClick={() => goToIndex(activeIndex - 1)}
          aria-label="Previous album"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          className="cc-arrow"
          onClick={() => goToIndex(activeIndex + 1)}
          aria-label="Next album"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </motion.div>
    </div>
  );
}
