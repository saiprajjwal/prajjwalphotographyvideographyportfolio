import { useState, useRef, useEffect } from 'react';
import { getOptimizedUrl } from '../utils/imageOptimizer';
import './BeforeAfterSlider.css';

export default function BeforeAfterSlider({ beforeImage, afterImage }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);

  const imagesLoaded = beforeLoaded && afterLoaded;

  // Reset loaded states when images change
  useEffect(() => {
    setBeforeLoaded(false);
    setAfterLoaded(false);
  }, [beforeImage, afterImage]);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleMouseMove = (e) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    // One stable reference per listener. The previous version passed a fresh
    // arrow function to removeEventListener, which removes nothing — so every
    // drag left another mouseup and touchend handler attached to window for
    // the life of the page.
    const stopDragging = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    // The handler never calls preventDefault, so it can be passive: the browser
    // no longer has to wait on it before scrolling.
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging]);

  const optimizedBefore = getOptimizedUrl(beforeImage, 800, 70);
  const optimizedAfter = getOptimizedUrl(afterImage, 800, 70);

  return (
    <div 
      className="before-after-container" 
      ref={containerRef}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {!imagesLoaded && (
        <div className="slider-loading">
          <div className="spinner"></div>
        </div>
      )}

      <img 
        src={optimizedBefore} 
        alt="Before" 
        className={`slider-image before-image ${imagesLoaded ? 'loaded' : ''}`} 
        onLoad={() => setBeforeLoaded(true)}
      />
      
      <img 
        src={optimizedAfter} 
        alt="After" 
        className={`slider-image after-image ${imagesLoaded ? 'loaded' : ''}`} 
        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
        onLoad={() => setAfterLoaded(true)}
      />

      {imagesLoaded && (
        <>
          <div 
            className="slider-handle"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="slider-line"></div>
            <div className="slider-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
          
          <div className="slider-labels">
            <span className="slider-label before-label">Before</span>
            <span className="slider-label after-label">After</span>
          </div>
        </>
      )}
    </div>
  );
}
