import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import './CircularCarousel.css';

const FALLBACK_ALBUMS = [
  {
    id: "fb-1",
    title: "Summer Bloom",
    category: "Portraits",
    description: "Atmospheric, sun-drenched portraits capturing the warmth of golden hour in Georgia.",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "fb-2",
    title: "Neon Nights",
    category: "Travel",
    description: "Vibrant, cyberpunk-inspired street and urban photography of night landscapes.",
    url: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "fb-3",
    title: "Furry Friends",
    category: "Pets",
    description: "Heartwarming pet portraits that capture unique character and playfulness.",
    url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "fb-4",
    title: "Minimal Objects",
    category: "Products",
    description: "Sleek, product-focused commercial shots with strong shadows and clean composition.",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop"
  },
  {
    id: "fb-5",
    title: "Studio Behind The Scene",
    category: "Behind The Scene",
    description: "A candid look behind the camera, featuring setups, lighting, and workflow.",
    url: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=600&auto=format&fit=crop"
  }
];

export default function CircularCarousel() {
  const [albums, setAlbums] = useState([]);
  
  // Track the current active item index (for button navigation)
  const [activeIndex, setActiveIndex] = useState(0);

  // We'll track the total rotation in degrees.
  const rotation = useMotionValue(0);
  
  // For dragging, we store the start rotation
  const [isDragging, setIsDragging] = useState(false);
  const startRotation = useRef(0);

  useEffect(() => {
    fetch('/api/photos')
      .then(res => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then(data => {
        const allPhotos = (data.photos || []).filter(p => !p.isVideo);
        
        // Group photos by session/album
        const sessions = {};
        allPhotos.forEach(p => {
          if (p.session) {
            if (!sessions[p.session]) {
              sessions[p.session] = {
                id: `session-${p.session}`,
                title: p.session,
                category: p.category || 'Portraits',
                description: p.description || `Explore our session gallery for ${p.session}.`,
                url: p.url
              };
            } else if (p.isCover) {
              sessions[p.session].url = p.url;
              if (p.description) sessions[p.session].description = p.description;
            }
          }
        });
        
        const groupedAlbums = Object.values(sessions);
        if (groupedAlbums.length > 0) {
          setAlbums(groupedAlbums);
        } else {
          setAlbums(FALLBACK_ALBUMS);
        }
      })
      .catch(() => {
        setAlbums(FALLBACK_ALBUMS);
      });
  }, []);

  const numItems = albums.length || 5;
  const anglePerItem = 360 / numItems;
  
  // Larger radius to give a gentle curve matching the reference (approx 650px)
  const radius = Math.round(200 / Math.tan(Math.PI / numItems)) + 60;

  // Handle Dragging
  const handlePanStart = () => {
    setIsDragging(true);
    startRotation.current = rotation.get();
  };

  const handlePan = (event, info) => {
    // 1 pixel of drag = roughly 0.15 degrees of rotation for smoother control
    const dragDelta = info.offset.x;
    rotation.set(startRotation.current + dragDelta * 0.15);
  };

  const handlePanEnd = (event, info) => {
    setIsDragging(false);
    const velocity = info.velocity.x;
    
    // Snap to the nearest card index
    let currentRot = rotation.get();
    let currentAngleIndex = -Math.round(currentRot / anglePerItem);
    
    // Apply momentum if dragged quickly
    if (Math.abs(velocity) > 100) {
      const snapDirection = velocity > 0 ? -1 : 1;
      currentAngleIndex += snapDirection;
    }
    
    // Keep it in bounds
    currentAngleIndex = (currentAngleIndex % numItems + numItems) % numItems;
    setActiveIndex(currentAngleIndex);
    
    animate(rotation, -currentAngleIndex * anglePerItem, {
      type: 'spring',
      damping: 30,
      stiffness: 80,
    });
  };

  // Nav Button handlers
  const handlePrev = () => {
    const nextIndex = (activeIndex - 1 + numItems) % numItems;
    setActiveIndex(nextIndex);
    animate(rotation, -nextIndex * anglePerItem, {
      type: 'spring',
      damping: 25,
      stiffness: 70
    });
  };

  const handleNext = () => {
    const nextIndex = (activeIndex + 1) % numItems;
    setActiveIndex(nextIndex);
    animate(rotation, -nextIndex * anglePerItem, {
      type: 'spring',
      damping: 25,
      stiffness: 70
    });
  };

  if (albums.length === 0) return null;

  return (
    <div className="circular-carousel-wrapper">
      {/* Background Gradient Blobs matching Google reference */}
      <div className="carousel-blob-bg green-blob"></div>
      <div className="carousel-blob-bg blue-blob"></div>

      <div className="carousel-header">
        <h2 className="carousel-heading-title">Be the first to experiment</h2>
      </div>

      <div className="circular-carousel-container">
        <motion.div 
          className="circular-scene"
          style={{ rotateY: rotation }}
          onPanStart={handlePanStart}
          onPan={handlePan}
          onPanEnd={handlePanEnd}
        >
          {albums.map((album, index) => {
            const itemRotation = index * anglePerItem;
            // Highlight card if it's the active index
            const isActive = index === activeIndex;
            return (
              <motion.div
                key={album.id || index}
                className={`circular-card ${isActive ? 'active' : ''}`}
                style={{
                  transform: `rotateY(${itemRotation}deg) translateZ(${radius}px)`
                }}
              >
                <div className="card-image-wrapper">
                  <img src={album.url} alt={album.title} loading="lazy" />
                  {album.category && <span className="card-badge">{album.category}</span>}
                </div>
                <div className="card-content">
                  <h3 className="card-title">{album.title}</h3>
                  <p className="card-desc">{album.description}</p>
                  <Link 
                    to={`/portfolio?category=${encodeURIComponent(album.category)}`}
                    className="card-cta"
                  >
                    View Album <span className="cta-arrow">→</span>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Navigation arrows at the bottom */}
      <div className="carousel-nav-controls">
        <button className="carousel-nav-btn prev" onClick={handlePrev} aria-label="Previous card">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button className="carousel-nav-btn next" onClick={handleNext} aria-label="Next card">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  );
}
