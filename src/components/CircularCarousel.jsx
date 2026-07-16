import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import './CircularCarousel.css';

let audioCtx = null;
const playTick = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.03);
  } catch(e) {
    // Ignore if audio context is blocked
  }
};

export default function CircularCarousel() {
  const [allAlbums, setAllAlbums] = useState([]);
  const [filter, setFilter] = useState('All');
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
  
  // Responsive radius: tighter on mobile to match smaller card width and maintain proper gaps
  const radius = windowWidth < 768 ? 1200 : 1500;

  const lastTickIndex = useRef(0);

  // Trigger Apple-style tick sound on crossing halfway points
  useEffect(() => {
    if (!rotation) return;
    const handleChange = (latest) => {
      const rawIndex = -latest / anglePerItem;
      const nearestIndex = Math.round(rawIndex);
      if (nearestIndex !== lastTickIndex.current) {
        lastTickIndex.current = nearestIndex;
        // Don't play on initial load when it settles
        if (isDragging.current || animControl.current) {
          playTick();
        }
      }
    };
    if (rotation.on) {
      return rotation.on('change', handleChange);
    } else if (rotation.onChange) {
      return rotation.onChange(handleChange);
    }
  }, [rotation, anglePerItem]);

  // Extract unique categories for filter pills
  const categories = ['All', ...new Set(allAlbums.map(a => a.category).filter(Boolean))];

  const goToIndex = (idx) => {
    const clamped = ((idx % numItems) + numItems) % numItems;
    setActiveIndex(clamped);
    if (animControl.current) animControl.current.stop();
    animControl.current = animate(rotation, -clamped * anglePerItem, {
      type: 'spring',
      damping: 22,       // silkier, less abrupt
      stiffness: 55,     // slower, more cinematic
      mass: 0.8,
    });
  };

  const handlePanStart = () => {
    isDragging.current = true;
    startRotation.current = rotation.get();
    if (animControl.current) animControl.current.stop();
  };

  const handlePan = (_, info) => {
    // 0.14 degrees per px — deliberate but responsive
    rotation.set(startRotation.current + info.offset.x * 0.14);
  };

  const handlePanEnd = (_, info) => {
    isDragging.current = false;
    const velocity = info.velocity.x;
    const currentRot = rotation.get();

    // Nearest card snap, extended by momentum on a fast flick
    let rawIndex = -currentRot / anglePerItem;
    if (Math.abs(velocity) > 80) {
      const carry = Math.min(Math.abs(velocity) / 400, 2.5);
      rawIndex += velocity > 0 ? -carry : carry;
    }

    const snappedIndex = Math.round(rawIndex);
    goToIndex(snappedIndex);
  };

  return (
    <div className="cc-wrapper">
      {/* Section heading */}
      <div className="cc-header">
        <h2 className="cc-title">Photo Albums</h2>
      </div>

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
      <div className="cc-controls">
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
      </div>
    </div>
  );
}
