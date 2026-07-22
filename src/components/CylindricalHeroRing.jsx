import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import PortfolioHeroScene from './PortfolioHeroScene';
import './CylindricalHeroRing.css';

// The displacement filter that makes the display word run like liquid.
// feTurbulence supplies a slowly drifting noise field; JS drives the
// feDisplacementMap's scale from 0 (crisp) up to full flow on hover.
function LiquidFilterDefs() {
  return (
    <svg className="liquid-defs" aria-hidden="true" focusable="false">
      <filter id="liquid-title" x="-12%" y="-30%" width="124%" height="160%" colorInterpolationFilters="sRGB">
        {/* Low frequency + a single octave keeps the noise field smooth, so
            the glyphs undulate like liquid rather than tearing into noise */}
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.008" numOctaves="1" seed="7" result="noise">
          <animate
            attributeName="baseFrequency"
            dur="16s"
            values="0.004 0.008; 0.009 0.004; 0.003 0.010; 0.004 0.008"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap
          id="liquid-title-map"
          in="SourceGraphic"
          in2="noise"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export default function CylindricalHeroRing({
  categories = [],
  activeCategory = '',
  onSelectCategory,
  photos = [],
  flatMode = false,
  onOpenCategory,
}) {
  const activeIndex = categories.indexOf(activeCategory);

  const stageRef = useRef(null);
  const titleRef = useRef(null);
  const chipRef = useRef(null);
  const [bandHover, setBandHover] = useState(false);

  const handleCategoryChange = (idx) => {
    const cat = categories[idx];
    if (cat && cat !== activeCategory) {
      onSelectCategory(cat);
    }
  };

  // ── Liquid title ────────────────────────────────────────────
  // Strength ramps with how close the pointer is to the word, so the letters
  // start flowing as you approach and settle again as you leave.
  useEffect(() => {
    const stage = stageRef.current;
    const title = titleRef.current;
    const map = document.getElementById('liquid-title-map');
    if (!stage || !title || !map) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let current = 0;
    let goal = 0;

    const onMove = (e) => {
      const r = title.getBoundingClientRect();
      // Distance from the word's box, in px, clamped to a falloff radius
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const dist = Math.hypot(dx, dy);
      goal = Math.max(0, 1 - dist / 220);
    };

    const onLeave = () => { goal = 0; };

    const tick = () => {
      current += (goal - current) * 0.09;
      if (current < 0.001) current = 0;
      map.setAttribute('scale', (current * 34).toFixed(2));
      title.style.filter = current > 0 ? 'url(#liquid-title)' : '';
      raf = requestAnimationFrame(tick);
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── "VIEW" chip trails the pointer while the band is hovered ──
  const handleHoverChange = useCallback((on, x, y) => {
    setBandHover(on);
    const chip = chipRef.current;
    if (chip && on && x != null) {
      const r = chip.parentElement.getBoundingClientRect();
      chip.style.transform = `translate3d(${x - r.left}px, ${y - r.top}px, 0) translate(-50%, -50%)`;
    }
  }, []);

  const handleTap = useCallback(() => {
    if (activeCategory) onOpenCategory?.(activeCategory);
  }, [activeCategory, onOpenCategory]);

  return (
    <div className="aikawa-hero-stage-wrapper" ref={stageRef}>
      <LiquidFilterDefs />

      {/* Massive editorial display word */}
      <div className="aikawa-backdrop-title" ref={titleRef} aria-hidden="true">
        PORTFOLIO
      </div>

      {/* 3D canvas: curved photo band + reflection */}
      <div className="aikawa-canvas-container">
        <Suspense
          fallback={
            <div className="aikawa-canvas-loading">
              <div className="aikawa-loading-spinner" />
            </div>
          }
        >
          <PortfolioHeroScene
            categories={categories}
            activeIndex={activeIndex >= 0 ? activeIndex : 0}
            photos={photos}
            flatMode={flatMode}
            onCategoryChange={handleCategoryChange}
            onHoverChange={handleHoverChange}
            onTap={handleTap}
          />
        </Suspense>

        <span
          ref={chipRef}
          className={`aikawa-view-chip ${bandHover ? 'is-visible' : ''}`}
          aria-hidden="true"
        >
          View
        </span>
      </div>
    </div>
  );
}
